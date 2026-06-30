let sharedAudioContext;
let activeAudio;
let activeAudioDone;

export function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("This browser does not expose the Web Audio API.");
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
}

export async function playLessonTarget(lesson, variant = "natural", speaker = null) {
  const src = resolveAudioSource(lesson.audio?.[variant], speaker);

  if (src) {
    try {
      await playAudioFile(src);
      return;
    } catch (error) {
      // Fall back to the contour tone if a referenced static asset is unavailable.
    }
  }

  await playSynthContour(lesson.contour, variant);
}

function resolveAudioSource(src, speaker) {
  if (!src || !speaker?.root) {
    return src;
  }

  return `${speaker.root}/${src.split("/").pop()}`;
}

async function playAudioFile(src) {
  stopActiveAudio();
  const audio = new Audio(src);
  activeAudio = audio;
  audio.preload = "auto";
  const ended = new Promise((resolve, reject) => {
    activeAudioDone = resolve;
    audio.addEventListener("ended", resolve, { once: true });
    audio.addEventListener("error", () => reject(new Error("Audio playback failed.")), { once: true });
  });

  try {
    await audio.play();
    await ended;
  } finally {
    if (activeAudio === audio) {
      activeAudio = null;
      activeAudioDone = null;
    }
  }
}

async function playSynthContour(points, variant) {
  stopActiveAudio();
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

  await new Promise((resolve) => {
    oscillator.addEventListener("ended", resolve, { once: true });
  });
}

function stopActiveAudio() {
  if (!activeAudio) {
    return;
  }

  const done = activeAudioDone;
  activeAudio.pause();
  activeAudio = null;
  activeAudioDone = null;
  done?.();
}

function normalizedPitchToHz(y) {
  const semitones = (clamp(y, 0, 1) - 0.5) * 14;
  return 185 * 2 ** (semitones / 12);
}

export async function decodeBlobToAudioBuffer(blob) {
  const context = getAudioContext();
  if (context.state !== "running") {
    await context.resume();
  }

  const arrayBuffer = await blob.arrayBuffer();
  return context.decodeAudioData(arrayBuffer.slice(0));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
