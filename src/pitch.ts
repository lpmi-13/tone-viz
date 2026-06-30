import type {
  AudioAnalysis,
  CalibrationResult,
  CalibrationSamples,
  PitchFrame,
  PitchStats,
  SpeakerProfile,
  TonePoint
} from "./types.js";

const DEFAULT_MIN_F0 = 75;
const DEFAULT_MAX_F0 = 520;
const YIN_THRESHOLD = 0.14;
const MIN_CALIBRATION_FRAMES = 70;
const MIN_CALIBRATION_VOICED_SECONDS = 0.9;
const MIN_CALIBRATION_SPAN_SEMITONES = 5;

interface AnalyzeOptions {
  calibration?: SpeakerProfile | null;
}

interface YinPitch {
  frequency: number;
  confidence: number;
}

interface NormalizationRange {
  mode: string;
  source?: string;
  low: number;
  mid: number | null;
  high: number;
}

export function analyzeAudioBuffer(audioBuffer: AudioBuffer, options: AnalyzeOptions = {}): AudioAnalysis {
  const samples = mixToMono(audioBuffer);
  const frames = extractPitchFrames(samples, audioBuffer.sampleRate);
  const normalized = normalizePitchFrames(frames, options.calibration);

  return {
    frames,
    points: normalized.points,
    stats: normalized.stats,
    normalization: normalized.normalization,
    error: normalized.error
  };
}

export function buildCalibration(samples: CalibrationSamples): CalibrationResult {
  const required = ["low", "normal", "high"];
  const missing = required.filter((key) => !samples?.[key]?.frames?.length);
  if (missing.length) {
    return {
      calibration: null,
      error: "Record low, normal, and high normalization samples before saving calibration."
    };
  }

  const sampleStats = Object.fromEntries(
    required.map((key) => [key, buildStats(samples[key].frames)])
  );

  for (const key of required) {
    const stats = sampleStats[key];
    if (
      stats.voicedFrameCount < MIN_CALIBRATION_FRAMES ||
      stats.voicedDurationSec < MIN_CALIBRATION_VOICED_SECONDS
    ) {
      return {
        calibration: null,
        error: `${capitalize(key)} sample was too short or unclear. Hold the vowel longer and keep the room quiet.`
      };
    }
  }

  const lowSemitone = quantile(samples.low.frames.map((frame) => hzToSemitone(frame.f0)), 0.25);
  const normalSemitone = quantile(samples.normal.frames.map((frame) => hzToSemitone(frame.f0)), 0.5);
  const highSemitone = quantile(samples.high.frames.map((frame) => hzToSemitone(frame.f0)), 0.75);
  const spanSemitones = highSemitone - lowSemitone;

  if (spanSemitones < MIN_CALIBRATION_SPAN_SEMITONES) {
    return {
      calibration: null,
      error: "The normalization samples were too close together. Make the low and high samples more distinct."
    };
  }

  if (normalSemitone <= lowSemitone || normalSemitone >= highSemitone) {
    return {
      calibration: null,
      error: "The normal sample should sit between the low and high samples."
    };
  }

  const calibration = {
    version: 1,
    source: "manual",
    createdAt: new Date().toISOString(),
    floorHz: semitoneToHz(lowSemitone),
    midHz: semitoneToHz(normalSemitone),
    ceilingHz: semitoneToHz(highSemitone),
    floorSemitone: lowSemitone,
    midSemitone: normalSemitone,
    ceilingSemitone: highSemitone,
    lowSemitone,
    normalSemitone,
    highSemitone,
    rangeLowSemitone: lowSemitone,
    rangeHighSemitone: highSemitone,
    spanSemitones,
    samples: Object.fromEntries(
      required.map((key) => [
        key,
        {
          voicedFrameCount: sampleStats[key].voicedFrameCount,
          voicedDurationSec: sampleStats[key].voicedDurationSec,
          medianHz: sampleStats[key].medianHz
        }
      ])
    ) as SpeakerProfile["samples"]
  };

  return { calibration, error: null };
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const output = new Float32Array(length);

  for (let channel = 0; channel < channelCount; channel += 1) {
    const input = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      output[index] += input[index] / channelCount;
    }
  }

  return output;
}

function extractPitchFrames(samples: Float32Array, sampleRate: number): PitchFrame[] {
  const windowSize = sampleRate >= 44100 ? 2048 : 1536;
  const hopSize = Math.floor(windowSize / 4);
  const frames = [];

  for (let start = 0; start + windowSize < samples.length; start += hopSize) {
    const frame = samples.subarray(start, start + windowSize);
    const rms = getRms(frame);
    if (rms < 0.01) {
      continue;
    }

    const pitch = yinPitch(frame, sampleRate, DEFAULT_MIN_F0, DEFAULT_MAX_F0);
    if (!pitch || pitch.confidence < 0.72) {
      continue;
    }

    frames.push({
      time: (start + windowSize / 2) / samples.length,
      timeSec: (start + windowSize / 2) / sampleRate,
      f0: pitch.frequency,
      confidence: pitch.confidence,
      rms
    });
  }

  return removePitchOutliers(frames);
}

function yinPitch(frame: Float32Array, sampleRate: number, minF0: number, maxF0: number): YinPitch | null {
  const tauMin = Math.max(2, Math.floor(sampleRate / maxF0));
  const tauMax = Math.min(Math.floor(sampleRate / minF0), frame.length - 2);
  const comparisonLength = frame.length - tauMax;
  const difference = new Float32Array(tauMax + 1);
  const cmnd = new Float32Array(tauMax + 1);

  for (let tau = 1; tau <= tauMax; tau += 1) {
    let sum = 0;
    for (let index = 0; index < comparisonLength; index += 1) {
      const delta = frame[index] - frame[index + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }

  let runningSum = 0;
  cmnd[0] = 1;
  for (let tau = 1; tau <= tauMax; tau += 1) {
    runningSum += difference[tau];
    cmnd[tau] = runningSum === 0 ? 1 : (difference[tau] * tau) / runningSum;
  }

  let tauEstimate = -1;
  for (let tau = tauMin; tau <= tauMax; tau += 1) {
    if (cmnd[tau] < YIN_THRESHOLD) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) {
        tau += 1;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate < 0) {
    return null;
  }

  const refinedTau = refineTau(cmnd, tauEstimate);
  const frequency = sampleRate / refinedTau;
  if (!Number.isFinite(frequency) || frequency < minF0 || frequency > maxF0) {
    return null;
  }

  return {
    frequency,
    confidence: clamp(1 - cmnd[tauEstimate], 0, 1)
  };
}

function refineTau(cmnd: Float32Array, tau: number): number {
  const left = cmnd[tau - 1];
  const center = cmnd[tau];
  const right = cmnd[tau + 1];
  const divisor = left + right - 2 * center;

  if (!Number.isFinite(divisor) || Math.abs(divisor) < 0.000001) {
    return tau;
  }

  return tau + (left - right) / (2 * divisor);
}

function normalizePitchFrames(frames: PitchFrame[], calibration: SpeakerProfile | null = null): Omit<AudioAnalysis, "frames"> {
  if (frames.length < 4) {
    return {
      points: [],
      stats: buildStats(frames),
      normalization: { mode: "none", calibrated: false },
      error: "Pitch was unclear. Try recording in a quieter room or holding the vowel longer."
    };
  }

  const semitones = frames.map((frame) => hzToSemitone(frame.f0));
  const range = getNormalizationRange(semitones, calibration);
  const firstTime = frames[0].time;
  const lastTime = frames[frames.length - 1].time;
  const duration = Math.max(0.001, lastTime - firstTime);
  const excursions = {
    aboveFrameCount: 0,
    belowFrameCount: 0,
    maxAboveSemitones: 0,
    maxBelowSemitones: 0
  };

  const points = frames.map((frame) => {
    const semitone = hzToSemitone(frame.f0);
    const rawY = (semitone - range.low) / (range.high - range.low);

    if (rawY > 1) {
      excursions.aboveFrameCount += 1;
      excursions.maxAboveSemitones = Math.max(excursions.maxAboveSemitones, semitone - range.high);
    } else if (rawY < 0) {
      excursions.belowFrameCount += 1;
      excursions.maxBelowSemitones = Math.max(excursions.maxBelowSemitones, range.low - semitone);
    }

    const outOfRange: TonePoint["outOfRange"] = rawY > 1 ? "above" : rawY < 0 ? "below" : null;

    return {
      t: clamp((frame.time - firstTime) / duration, 0, 1),
      y: clamp(rawY, 0, 1),
      rawY,
      outOfRange,
      hz: frame.f0,
      confidence: frame.confidence
    };
  });

  return {
    points: smoothPoints(points),
    stats: buildStats(frames),
    normalization: {
      mode: range.mode,
      calibrated: range.mode !== "current-recording" && range.mode !== "none",
      source: range.source,
      midSemitone: range.mid,
      rangeLowSemitone: range.low,
      rangeHighSemitone: range.high,
      spanSemitones: range.high - range.low,
      excursions: {
        ...excursions,
        hasExcursion: excursions.aboveFrameCount > 0 || excursions.belowFrameCount > 0
      }
    }
  };
}

function getNormalizationRange(semitones: number[], calibration: SpeakerProfile | null): NormalizationRange {
  if (
    calibration &&
    Number.isFinite(calibration.rangeLowSemitone) &&
    Number.isFinite(calibration.rangeHighSemitone) &&
    calibration.rangeHighSemitone > calibration.rangeLowSemitone
  ) {
    return {
      mode: "calibrated",
      source: calibration.source || "manual",
      low: calibration.rangeLowSemitone,
      mid: calibration.midSemitone ?? calibration.normalSemitone ?? null,
      high: calibration.rangeHighSemitone
    };
  }

  const low = quantile(semitones, 0.1);
  const high = quantile(semitones, 0.9);
  const median = quantile(semitones, 0.5);
  const observedSpan = high - low;
  const span = Math.max(observedSpan, 7);

  return {
    mode: "current-recording",
    low: observedSpan >= 7 ? low : median - span / 2,
    mid: median,
    high: observedSpan >= 7 ? high : median + span / 2
  };
}

function removePitchOutliers(frames: PitchFrame[]): PitchFrame[] {
  if (frames.length < 6) {
    return frames;
  }

  const semitones = frames.map((frame) => hzToSemitone(frame.f0));
  const median = quantile(semitones, 0.5);
  return frames.filter((frame) => Math.abs(hzToSemitone(frame.f0) - median) <= 16);
}

function smoothPoints(points: TonePoint[]): TonePoint[] {
  if (points.length < 5) {
    return points;
  }

  return points.map((point, index) => {
    const neighbors = points
      .slice(Math.max(0, index - 1), Math.min(points.length, index + 2))
      .map((neighbor) => neighbor.y)
      .sort((a, b) => a - b);

    return {
      ...point,
      y: neighbors[Math.floor(neighbors.length / 2)]
    };
  });
}

function buildStats(frames: PitchFrame[]): PitchStats {
  if (frames.length === 0) {
    return {
      voicedFrameCount: 0,
      minHz: null,
      maxHz: null,
      medianHz: null,
      meanConfidence: 0,
      voicedDurationSec: 0
    };
  }

  const pitches = frames.map((frame) => frame.f0).sort((a, b) => a - b);
  const confidence = frames.reduce((sum, frame) => sum + frame.confidence, 0) / frames.length;
  const firstTime = frames[0].timeSec ?? frames[0].time;
  const lastTime = frames[frames.length - 1].timeSec ?? frames[frames.length - 1].time;

  return {
    voicedFrameCount: frames.length,
    minHz: pitches[0],
    maxHz: pitches[pitches.length - 1],
    medianHz: quantile(pitches, 0.5),
    meanConfidence: confidence,
    voicedDurationSec: Math.max(0, lastTime - firstTime)
  };
}

function getRms(frame: Float32Array): number {
  let sum = 0;
  for (const sample of frame) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / frame.length);
}

function hzToSemitone(hz: number): number {
  return 12 * Math.log2(hz / 440);
}

function semitoneToHz(semitone: number): number {
  return 440 * 2 ** (semitone / 12);
}

function quantile(values: number[], position: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
