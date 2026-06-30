import type {
  AudioSpeaker,
  Lesson,
  PlaybackOptions,
  PlaybackProgress,
  PlaybackVariant,
  TonePoint
} from "./types.js";

type AudioContextConstructor = new () => AudioContext;

let sharedAudioContext: AudioContext | null = null;
let activeAudio: HTMLAudioElement | null = null;
let activeAudioDone: (() => void) | null = null;
let activeSynthStop: (() => void) | null = null;

export function getAudioContext(): AudioContext {
  const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext) as AudioContextConstructor | undefined;
  if (!AudioContextClass) {
    throw new Error("This browser does not expose the Web Audio API.");
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
}

export async function playLessonTarget(
  lesson: Lesson,
  variant: PlaybackVariant = "natural",
  speaker: AudioSpeaker | null = null,
  options: PlaybackOptions = {}
): Promise<void> {
  const src = resolveAudioSource(lesson.audio?.[variant], speaker);

  if (src) {
    try {
      await playAudioSource(src, options);
      return;
    } catch (error) {
      // Fall back to the contour tone if a referenced static asset is unavailable.
    }
  }

  await playSynthContour(lesson.contour, variant, options);
}

function resolveAudioSource(src: string | undefined, speaker: AudioSpeaker | null): string | undefined {
  if (!src || !speaker?.root) {
    return src;
  }

  return `${speaker.root}/${src.split("/").pop()}`;
}

export async function playAudioSource(src: string, options: PlaybackOptions = {}): Promise<void> {
  stopActivePlayback();
  const audio = new Audio(src);
  activeAudio = audio;
  audio.preload = "auto";
  const ended = new Promise<void>((resolve, reject) => {
    let stopProgress = () => {};
    let settled = false;
    const finish = (done: boolean, error: Error | null = null) => {
      if (settled) {
        return;
      }

      settled = true;
      stopProgress();
      emitAudioProgress(audio, options, done);
      if (activeAudio === audio) {
        activeAudio = null;
        activeAudioDone = null;
      }

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    activeAudioDone = () => finish(false);
    audio.addEventListener("ended", () => finish(true), { once: true });
    audio.addEventListener("error", () => finish(false, new Error("Audio playback failed.")), { once: true });
    stopProgress = startAudioProgress(audio, options);
  });

  try {
    try {
      await audio.play();
    } catch (error) {
      activeAudioDone?.();
      throw error;
    }
    await ended;
  } finally {
    if (activeAudio === audio) {
      activeAudio = null;
      activeAudioDone = null;
    }
  }
}

async function playSynthContour(points: TonePoint[], variant: PlaybackVariant, options: PlaybackOptions = {}): Promise<void> {
  stopActivePlayback();
  const context = getAudioContext();
  if (context.state !== "running") {
    await context.resume();
  }

  const duration = variant === "exaggerated" ? 1.35 : 0.9;
  const now = context.currentTime + 0.025;
  const oscillator = new OscillatorNode(context, { type: "sine" });
  const overtone = new OscillatorNode(context, { type: "triangle" });
  const gain = new GainNode(context);
  const overtoneGain = new GainNode(context);

  oscillator.connect(gain);
  overtone.connect(overtoneGain);
  overtoneGain.connect(gain);
  gain.connect(context.destination);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
  gain.gain.setValueAtTime(0.18, now + Math.max(0.05, duration - 0.12));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  overtoneGain.gain.setValueAtTime(0.035, now);

  const firstFreq = normalizedPitchToHz(points[0]?.y ?? 0.5);
  oscillator.frequency.setValueAtTime(firstFreq, now);
  overtone.frequency.setValueAtTime(firstFreq * 2, now);

  for (const point of points) {
    const time = now + point.t * duration;
    const freq = normalizedPitchToHz(point.y);
    oscillator.frequency.linearRampToValueAtTime(freq, time);
    overtone.frequency.linearRampToValueAtTime(freq * 2, time);
  }

  oscillator.start(now);
  overtone.start(now);
  oscillator.stop(now + duration + 0.02);
  overtone.stop(now + duration + 0.02);

  await new Promise<void>((resolve) => {
    let frameId = 0;
    let settled = false;
    const finish = (done: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      window.cancelAnimationFrame(frameId);
      emitProgress(options, {
        progress: done ? 1 : clamp((context.currentTime - now) / duration, 0, 1),
        currentTime: clamp(context.currentTime - now, 0, duration),
        duration,
        done
      });
      if (activeSynthStop === stopSynth) {
        activeSynthStop = null;
      }
      resolve();
    };
    const tick = () => {
      emitProgress(options, {
        progress: clamp((context.currentTime - now) / duration, 0, 1),
        currentTime: clamp(context.currentTime - now, 0, duration),
        duration,
        done: false
      });

      if (!settled) {
        frameId = window.requestAnimationFrame(tick);
      }
    };
    const stopSynth = () => {
      try {
        oscillator.stop();
        overtone.stop();
      } catch (error) {
        // Oscillators may already be stopped by the scheduled end time.
      }
      finish(false);
    };

    activeSynthStop = stopSynth;
    frameId = window.requestAnimationFrame(tick);
    oscillator.addEventListener("ended", () => finish(true), { once: true });
  });
}

export function stopActivePlayback(): void {
  if (activeSynthStop) {
    const stopSynth = activeSynthStop;
    activeSynthStop = null;
    stopSynth();
  }

  if (activeAudio) {
    const done = activeAudioDone;
    activeAudio.pause();
    activeAudio = null;
    activeAudioDone = null;
    done?.();
  }
}

function startAudioProgress(audio: HTMLAudioElement, options: PlaybackOptions): () => void {
  if (!options.onProgress) {
    return () => {};
  }

  let frameId = 0;
  let stopped = false;
  let startedAt = performance.now();
  const syncStartedAt = () => {
    startedAt = performance.now() - (audio.currentTime || 0) * 1000;
  };
  const tick = () => {
    emitAudioProgress(audio, options, false, startedAt);

    if (!stopped) {
      frameId = window.requestAnimationFrame(tick);
    }
  };

  audio.addEventListener("playing", syncStartedAt);
  emitAudioProgress(audio, options, false);
  frameId = window.requestAnimationFrame(tick);

  return () => {
    stopped = true;
    audio.removeEventListener("playing", syncStartedAt);
    window.cancelAnimationFrame(frameId);
  };
}

function emitAudioProgress(
  audio: HTMLAudioElement,
  options: PlaybackOptions,
  done: boolean,
  startedAt: number | null = null
): void {
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  const mediaTime = duration ? clamp(audio.currentTime || 0, 0, duration) : 0;
  const elapsedTime = duration && startedAt && !audio.paused
    ? clamp((performance.now() - startedAt) / 1000, 0, duration)
    : 0;
  const currentTime = !done && duration && mediaTime < 0.05 && elapsedTime > 0.12
    ? elapsedTime
    : mediaTime;
  emitProgress(options, {
    progress: done ? 1 : duration ? clamp(currentTime / duration, 0, 1) : 0,
    currentTime: done && duration ? duration : currentTime,
    duration,
    done
  });
}

function emitProgress(options: PlaybackOptions, progress: PlaybackProgress): void {
  options.onProgress?.(progress);
}

function normalizedPitchToHz(y: number): number {
  const semitones = (clamp(y, 0, 1) - 0.5) * 14;
  return 185 * 2 ** (semitones / 12);
}

export async function decodeBlobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const context = getAudioContext();
  if (context.state !== "running") {
    await context.resume();
  }

  const arrayBuffer = await blob.arrayBuffer();
  return context.decodeAudioData(arrayBuffer.slice(0));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
