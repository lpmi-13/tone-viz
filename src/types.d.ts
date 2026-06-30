export type ToneId = "mid" | "low" | "falling" | "high" | "rising";
export type CalibrationKey = "low" | "normal" | "high";
export type RecordingKind = "practice" | "explore" | `calibration-${CalibrationKey}`;
export type PlaybackVariant = "natural" | "exaggerated" | "phrase" | "phraseSlow";
export type Direction = "up" | "down";
export type SpeakerProfileSource = "manual" | "passive" | "hybrid" | string;

export interface TonePoint {
  t: number;
  y: number;
  rawY?: number;
  outOfRange?: "above" | "below" | null;
  hz?: number;
  confidence?: number;
}

export interface RegisterBand {
  id: "low" | "mid" | "high";
  label: string;
  from: number;
  to: number;
}

export interface ToneTemplate {
  label: string;
  color: string;
  points: TonePoint[];
}

export type ToneTemplateMap = Record<ToneId, ToneTemplate>;

export interface AudioMap {
  natural?: string;
  exaggerated?: string;
  phrase?: string;
  phraseSlow?: string;
}

export interface ContextThai {
  before: string;
  target: string;
  after: string;
}

export interface TargetWordTiming {
  start: number;
  end: number;
}

export interface PhraseVariant {
  id: string;
  contextThai: ContextThai;
  contextTranslation: string;
  targetWordTiming: TargetWordTiming | null;
  audio: AudioMap;
  sourceId: string | null;
}

export interface Word {
  id: string;
  thai: string;
  translation: string;
  audio?: AudioMap;
  phraseVariants: PhraseVariant[];
  contour?: TonePoint[];
  sourceId?: string | null;
}

export interface ToneGroup {
  id: ToneId;
  tone: ToneId;
  toneLabelEnglish: string;
  contour: TonePoint[];
  words: Word[];
}

export interface Lesson {
  id: string;
  tone: ToneId;
  toneId: ToneId;
  toneLabelEnglish: string;
  thai: string;
  translation: string;
  wordId: string;
  phraseVariantId: string | null;
  phraseVariantIndex: number;
  phraseVariantCount: number;
  contextThai: ContextThai | null;
  contextTranslation: string;
  targetWordTiming: TargetWordTiming | null;
  audio: AudioMap;
  contour: TonePoint[];
  sourceId: string | null;
}

export interface AudioSpeaker {
  id: string;
  label: string;
  voice: string;
  root: string;
}

export interface PitchFrame {
  time: number;
  timeSec: number;
  f0: number;
  confidence: number;
  rms: number;
}

export interface PitchStats {
  voicedFrameCount: number;
  minHz: number | null;
  maxHz: number | null;
  medianHz: number | null;
  meanConfidence: number;
  voicedDurationSec: number;
}

export interface NormalizationExcursions {
  aboveFrameCount: number;
  belowFrameCount: number;
  maxAboveSemitones: number;
  maxBelowSemitones: number;
  hasExcursion?: boolean;
}

export interface PitchNormalization {
  mode: string;
  calibrated: boolean;
  source?: SpeakerProfileSource;
  midSemitone?: number | null;
  rangeLowSemitone?: number;
  rangeHighSemitone?: number;
  spanSemitones?: number;
  excursions?: NormalizationExcursions;
}

export interface AudioAnalysis {
  frames: PitchFrame[];
  points: TonePoint[];
  stats: PitchStats;
  normalization: PitchNormalization;
  error?: string | null;
}

export type CalibrationSamples = Record<CalibrationKey, AudioAnalysis | null>;

export interface SpeakerProfile {
  version?: number;
  source?: SpeakerProfileSource;
  createdAt?: string;
  floorHz?: number;
  midHz?: number;
  ceilingHz?: number;
  floorSemitone?: number;
  midSemitone?: number | null;
  ceilingSemitone?: number;
  lowSemitone?: number;
  normalSemitone?: number;
  highSemitone?: number;
  rangeLowSemitone: number;
  rangeHighSemitone: number;
  spanSemitones?: number;
  passiveReady?: boolean;
  samples?: Record<CalibrationKey, {
    voicedFrameCount: number;
    voicedDurationSec: number;
    medianHz: number | null;
  }>;
  frameCount?: number;
  observedSeconds?: number;
}

export interface CalibrationResult {
  calibration: SpeakerProfile | null;
  error: string | null;
}

export interface PassiveRange {
  version: 1;
  pitches: number[];
  totalVoicedSeconds: number;
  profile: SpeakerProfile | null;
  updatedAt: string | null;
}

export interface ComparisonCue {
  t: number;
  direction: Direction;
  label: string;
}

export interface ComparisonSegment {
  start: number;
  end: number;
}

export interface TemplateToneDiagnostic {
  toneId: ToneId;
  meanAbs: number;
  startDiff: number;
  endDiff: number;
  registerDiff: number;
  deltaDiff: number;
  motionDiff: number;
}

export interface TemplateDiagnostic {
  target: TemplateToneDiagnostic | null;
  closest: TemplateToneDiagnostic | null;
  closestOther: TemplateToneDiagnostic | null;
}

export interface ContourComparison {
  feedback: string;
  cues: ComparisonCue[];
  segments: ComparisonSegment[];
  diagnostic: TemplateDiagnostic | null;
}

export interface DrawToneChartOptions {
  target?: TonePoint[] | null;
  learner?: TonePoint[] | null;
  toneId?: ToneId | null;
  showTemplates?: boolean;
  segments?: ComparisonSegment[];
  cues?: ComparisonCue[];
  freeform?: boolean;
  emptyText?: string;
}
