import {
  audioSpeakers,
  defaultSelection,
  defaultAudioSpeakerId,
  getLessonSelection,
  getQuizLessonById,
  getToneGroupById,
  getWordTextForSpeaker,
  getWordById,
  quizLessons,
  toneGroups,
  toneTemplates
} from "./data.js";
import { playLessonTarget, decodeBlobToAudioBuffer } from "./audio.js";
import { analyzeAudioBuffer, buildCalibration } from "./pitch.js";
import { compareContours } from "./compare.js";
import { drawToneChart } from "./visualizer.js";
import type {
  AudioAnalysis,
  AudioSpeaker,
  CalibrationKey,
  Lesson,
  PassiveRange,
  PitchNormalization,
  PitchStats,
  PlaybackVariant,
  RecordingKind,
  SpeakerProfile,
  ToneId
} from "./types.js";

const CALIBRATION_STORAGE_KEY = "thai-tone-visualizer-calibration-v1";
const PASSIVE_RANGE_STORAGE_KEY = "thai-tone-visualizer-passive-range-v1";
const NORMALIZATION_DISMISSED_STORAGE_KEY = "thai-tone-visualizer-normalization-dismissed-v1";
const FIRST_USE_STORAGE_KEY = "thai-tone-visualizer-first-use-dismissed-v1";
const PASSIVE_READY_SECONDS = 30;
const PASSIVE_READY_FRAMES = 500;
const PASSIVE_MAX_PITCHES = 4000;
const HOLD_RECORDING_THRESHOLD_MS = 260;
const CALIBRATION_LABELS: Record<CalibrationKey, string> = {
  low: "Low",
  normal: "Normal",
  high: "High"
};
const CALIBRATION_PROMPTS: Record<CalibrationKey, string> = {
  low: "Hold อา on a comfortable low pitch for 2 to 3 seconds.",
  normal: "Hold อา at your normal speaking pitch for 2 to 3 seconds.",
  high: "Hold อา on a comfortable high pitch for 2 to 3 seconds."
};
const TONE_OPTIONS: Array<{ id: ToneId; label: string }> = Object.entries(toneTemplates).map(([id, template]) => ({
  id: id as ToneId,
  label: template.label
}));

const state: any = {
  mode: "practice",
  selectedToneId: defaultSelection.toneId,
  selectedWordId: defaultSelection.wordId,
  selectedPhraseVariantId: defaultSelection.phraseVariantId,
  selectedSpeakerId: defaultAudioSpeakerId,
  practiceAttempt: null,
  practiceComparison: null,
  exploreAttempt: null,
  calibration: null,
  passiveRange: null,
  normalizationActive: false,
  calibrationSamples: {
    low: null,
    normal: null,
    high: null
  },
  recording: null,
  processingKind: null,
  holdGesture: null,
  suppressRecordClick: false,
  quizLessonId: quizLessons[0].id,
  quizAnsweredTone: null,
  quizStats: {
    answered: 0,
    correct: 0
  },
  history: []
};

const elements: any = {
  topbar: document.querySelector("#topbar"),
  privacyNote: document.querySelector("#privacyNote"),
  firstUseNote: document.querySelector("#firstUseNote"),
  dismissFirstUse: document.querySelector("#dismissFirstUse"),
  normalizationMode: document.querySelector("#normalizationMode"),
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  practiceMode: document.querySelector("#practiceMode"),
  quizMode: document.querySelector("#quizMode"),
  exploreMode: document.querySelector("#exploreMode"),
  lessonList: document.querySelector("#lessonList"),
  wordVariantList: document.querySelector("#wordVariantList"),
  selectedTone: document.querySelector("#selectedTone"),
  selectedWord: document.querySelector("#selectedWord"),
  selectedTranslation: document.querySelector("#selectedTranslation"),
  toneChip: document.querySelector("#toneChip"),
  targetSpeaker: document.querySelector("#targetSpeaker"),
  contextLine: document.querySelector("#contextLine"),
  previousWord: document.querySelector("#previousWord"),
  nextWord: document.querySelector("#nextWord"),
  previousPhrase: document.querySelector("#previousPhrase"),
  nextPhrase: document.querySelector("#nextPhrase"),
  phraseVariantLabel: document.querySelector("#phraseVariantLabel"),
  menuButton: document.querySelector("#menuButton"),
  appMenu: document.querySelector("#appMenu"),
  voiceRangeMenuItem: document.querySelector("#voiceRangeMenuItem"),
  calibrationPanel: document.querySelector("#calibrationPanel"),
  playNatural: document.querySelector("#playNatural"),
  playSlow: document.querySelector("#playSlow"),
  playPhrase: document.querySelector("#playPhrase"),
  playPhraseSlow: document.querySelector("#playPhraseSlow"),
  recordPractice: document.querySelector("#recordPractice"),
  recordExplore: document.querySelector("#recordExplore"),
  playQuizClip: document.querySelector("#playQuizClip"),
  nextQuizItem: document.querySelector("#nextQuizItem"),
  quizPrompt: document.querySelector("#quizPrompt"),
  quizOptions: document.querySelector("#quizOptions"),
  quizFeedback: document.querySelector("#quizFeedback"),
  quizCount: document.querySelector("#quizCount"),
  calibrationButtons: [...document.querySelectorAll("[data-calibration]")],
  calibrationLowStatus: document.querySelector("#calibrationLowStatus"),
  calibrationNormalStatus: document.querySelector("#calibrationNormalStatus"),
  calibrationHighStatus: document.querySelector("#calibrationHighStatus"),
  saveCalibration: document.querySelector("#saveCalibration"),
  resetCalibration: document.querySelector("#resetCalibration"),
  dismissCalibration: document.querySelector("#dismissCalibration"),
  calibrationSummary: document.querySelector("#calibrationSummary"),
  calibrationBadge: document.querySelector("#calibrationBadge"),
  calibrationStatus: document.querySelector("#calibrationStatus"),
  passiveRangePercent: document.querySelector("#passiveRangePercent"),
  passiveRangeBar: document.querySelector("#passiveRangeBar"),
  passiveRangeStatus: document.querySelector("#passiveRangeStatus"),
  practiceUpload: document.querySelector("#practiceUpload"),
  exploreUpload: document.querySelector("#exploreUpload"),
  showPracticeTemplates: document.querySelector("#showPracticeTemplates"),
  showExploreTemplates: document.querySelector("#showExploreTemplates"),
  practiceStatus: document.querySelector("#practiceStatus"),
  exploreStatus: document.querySelector("#exploreStatus"),
  practiceCanvas: document.querySelector("#practiceCanvas"),
  exploreCanvas: document.querySelector("#exploreCanvas"),
  feedback: document.querySelector("#feedback"),
  exploreFeedback: document.querySelector("#exploreFeedback"),
  historyList: document.querySelector("#historyList")
};

function init() {
  state.calibration = loadCalibration();
  state.passiveRange = loadPassiveRange();
  state.normalizationActive = shouldShowNormalizationOnLoad();
  renderLessonList();
  renderSpeakerOptions();
  bindEvents();
  render();
}

function bindEvents() {
  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }

  elements.playNatural.addEventListener("click", () => playSelectedTarget("natural"));
  elements.playSlow.addEventListener("click", () => playSelectedTarget("exaggerated"));
  elements.playPhrase.addEventListener("click", () => playSelectedTarget("phrase"));
  elements.playPhraseSlow.addEventListener("click", () => playSelectedTarget("phraseSlow"));
  elements.targetSpeaker.addEventListener("change", () => {
    state.selectedSpeakerId = elements.targetSpeaker.value;
    renderLessonList();
    render();
  });
  elements.previousWord.addEventListener("click", () => cycleSelectedWord(-1));
  elements.nextWord.addEventListener("click", () => cycleSelectedWord(1));
  elements.previousPhrase.addEventListener("click", () => cycleSelectedPhrase(-1));
  elements.nextPhrase.addEventListener("click", () => cycleSelectedPhrase(1));
  elements.playQuizClip.addEventListener("click", playQuizClip);
  elements.nextQuizItem.addEventListener("click", nextQuizItem);
  bindRecordControl(elements.recordPractice, () => "practice");
  bindRecordControl(elements.recordExplore, () => "explore");
  elements.menuButton.addEventListener("click", toggleAppMenu);
  elements.voiceRangeMenuItem.addEventListener("click", openNormalizationFlow);
  elements.dismissFirstUse.addEventListener("click", dismissFirstUse);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.appMenu.classList.contains("is-hidden")) {
      closeAppMenu();
    }
  });
  document.addEventListener("click", (event) => {
    if (!elements.appMenu.classList.contains("is-hidden") && !(event.target instanceof Element && event.target.closest(".menu-wrap"))) {
      closeAppMenu();
    }
  });
  for (const button of elements.calibrationButtons) {
    bindRecordControl(button, () => `calibration-${button.dataset.calibration}`);
  }
  elements.saveCalibration.addEventListener("click", saveCalibration);
  elements.resetCalibration.addEventListener("click", resetCalibration);
  elements.dismissCalibration.addEventListener("click", dismissNormalizationFlow);
  elements.practiceUpload.addEventListener("change", (event) => handleUpload(event, "practice"));
  elements.exploreUpload.addEventListener("change", (event) => handleUpload(event, "explore"));
  elements.showPracticeTemplates.addEventListener("change", renderCharts);
  elements.showExploreTemplates.addEventListener("change", renderCharts);
  window.addEventListener("resize", renderCharts);
}

function bindRecordControl(button, getKind) {
  button.addEventListener("click", (event) => {
    if (state.suppressRecordClick) {
      event.preventDefault();
      return;
    }

    toggleRecording(getKind());
  });

  button.addEventListener("pointerdown", (event) => startHoldGesture(event, button, getKind()));
  button.addEventListener("pointerup", finishHoldGesture);
  button.addEventListener("pointercancel", finishHoldGesture);
  button.addEventListener("lostpointercapture", finishHoldGesture);
  button.addEventListener("contextmenu", (event) => {
    if (state.holdGesture?.active) {
      event.preventDefault();
    }
  });
}

function startHoldGesture(event, button, kind) {
  if (button.disabled || event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  clearHoldTimer();
  const gesture: any = {
    pointerId: event.pointerId,
    kind,
    active: false,
    released: false,
    timerId: window.setTimeout(() => {
      if (state.holdGesture !== gesture || state.recording) {
        return;
      }

      gesture.active = true;
      state.suppressRecordClick = true;
      setStatus(kind, "Starting microphone. Keep holding while you speak, then release to stop.");
      gesture.startPromise = startRecording(kind).finally(() => {
        if (gesture.released && state.recording?.kind === kind) {
          stopRecording();
        }
      });
    }, HOLD_RECORDING_THRESHOLD_MS)
  };

  state.holdGesture = gesture;
  button.setPointerCapture?.(event.pointerId);
}

function finishHoldGesture(event) {
  const gesture = state.holdGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) {
    return;
  }

  clearHoldTimer();

  if (gesture.active) {
    event.preventDefault();
    gesture.released = true;
    state.suppressRecordClick = true;

    if (state.recording?.kind === gesture.kind) {
      stopRecording();
    }

    window.setTimeout(() => {
      state.suppressRecordClick = false;
    }, 450);
  }

  state.holdGesture = null;
}

function clearHoldTimer() {
  if (state.holdGesture?.timerId) {
    clearTimeout(state.holdGesture.timerId);
  }
}

function setMode(mode: "practice" | "quiz" | "explore") {
  state.mode = mode;
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  renderVisibility();
  renderCharts();
}

function renderLessonList() {
  elements.lessonList.innerHTML = "";

  for (const group of toneGroups) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lesson-card";
    button.dataset.toneId = group.id;
    const preview = group.words.map((word) => getWordTextForSpeaker(word, state.selectedSpeakerId).thai).join(" ");
    button.innerHTML = `
      <span class="tone-name">${group.toneLabelEnglish}</span>
      <span class="meta"><strong>${group.words.length} words</strong><span>${preview}</span></span>
    `;
    button.addEventListener("click", () => {
      selectTone(group.id);
    });
    elements.lessonList.append(button);
  }
}

function renderSpeakerOptions() {
  elements.targetSpeaker.replaceChildren();

  for (const speaker of audioSpeakers) {
    const option = document.createElement("option");
    option.value = speaker.id;
    option.textContent = speaker.label;
    elements.targetSpeaker.append(option);
  }

  elements.targetSpeaker.value = state.selectedSpeakerId;
}

function renderWordVariants() {
  const group = getToneGroupById(state.selectedToneId);
  elements.wordVariantList.innerHTML = "";

  for (const word of group.words) {
    const wordText = getWordTextForSpeaker(word, state.selectedSpeakerId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-variant";
    button.dataset.wordId = word.id;
    button.innerHTML = `
      <span class="thai">${wordText.thai}</span>
      <span>${wordText.translation}</span>
    `;
    button.classList.toggle("is-active", word.id === state.selectedWordId);
    button.addEventListener("click", () => {
      selectWord(word.id);
    });
    elements.wordVariantList.append(button);
  }
}

function selectTone(toneId: string) {
  const group = getToneGroupById(toneId);
  const word = group.words[0];
  state.selectedToneId = group.id;
  state.selectedWordId = word.id;
  state.selectedPhraseVariantId = word.phraseVariants[0]?.id || null;
  resetPracticeAttempt();
  render();
}

function selectWord(wordId: string) {
  const word = getWordById(state.selectedToneId, wordId);
  state.selectedWordId = word.id;
  state.selectedPhraseVariantId = word.phraseVariants[0]?.id || null;
  resetPracticeAttempt();
  render();
}

function cycleSelectedWord(direction: number) {
  const group = getToneGroupById(state.selectedToneId);
  const currentIndex = group.words.findIndex((word) => word.id === state.selectedWordId);
  const nextIndex = wrapIndex(currentIndex + direction, group.words.length);
  selectWord(group.words[nextIndex].id);
}

function cycleSelectedPhrase(direction: number) {
  const word = getWordById(state.selectedToneId, state.selectedWordId);
  if (word.phraseVariants.length < 2) {
    return;
  }

  const currentIndex = word.phraseVariants.findIndex((variant) => variant.id === state.selectedPhraseVariantId);
  const nextIndex = wrapIndex(currentIndex + direction, word.phraseVariants.length);
  state.selectedPhraseVariantId = word.phraseVariants[nextIndex].id;
  resetPracticeAttempt();
  render();
}

function resetPracticeAttempt() {
  state.practiceAttempt = null;
  state.practiceComparison = null;
  elements.feedback.value = "Record or upload a short syllable to compare your contour with the target.";
}

function wrapIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return (index % length + length) % length;
}

function renderCycleControls() {
  const group = getToneGroupById(state.selectedToneId);
  const word = getWordById(group.id, state.selectedWordId);
  const phraseCount = word.phraseVariants.length;
  const phraseIndex = Math.max(0, word.phraseVariants.findIndex((variant) => variant.id === state.selectedPhraseVariantId));

  elements.phraseVariantLabel.textContent = phraseCount > 1
    ? `Phrase ${phraseIndex + 1} of ${phraseCount}`
    : "Phrase 1 of 1";
  updateCycleButtons();
}

function updateCycleButtons() {
  const group = getToneGroupById(state.selectedToneId);
  const word = getWordById(group.id, state.selectedWordId);
  const busy = Boolean(state.processingKind || state.recording);
  const wordDisabled = busy || group.words.length < 2;
  const phraseDisabled = busy || word.phraseVariants.length < 2;

  elements.previousWord.disabled = wordDisabled;
  elements.nextWord.disabled = wordDisabled;
  elements.previousPhrase.disabled = phraseDisabled;
  elements.nextPhrase.disabled = phraseDisabled;
}

function render() {
  const lesson = getSelectedLesson();
  elements.selectedTone.textContent = `${lesson.toneLabelEnglish} tone`;
  elements.selectedWord.textContent = lesson.thai;
  elements.selectedTranslation.textContent = lesson.translation;
  elements.toneChip.textContent = lesson.tone;
  elements.targetSpeaker.value = state.selectedSpeakerId;
  renderWordVariants();
  renderContext(lesson);
  renderCycleControls();

  for (const button of elements.lessonList.querySelectorAll(".lesson-card")) {
    button.classList.toggle("is-active", button.dataset.toneId === lesson.toneId);
  }

  renderCharts();
  renderHistory();
  renderQuiz();
  renderCalibration();
  renderVisibility();
}

function renderContext(lesson: Lesson) {
  elements.contextLine.replaceChildren();
  appendContextLine(elements.contextLine, lesson);
}

function renderQuiz() {
  const lesson = getQuizLesson();
  elements.quizPrompt.replaceChildren();
  appendContextLine(elements.quizPrompt, lesson);
  elements.quizCount.textContent = `${state.quizStats.correct} / ${state.quizStats.answered}`;
  elements.quizOptions.replaceChildren();

  for (const option of TONE_OPTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button quiz-option";
    button.textContent = option.label;
    button.disabled = Boolean(state.quizAnsweredTone);
    button.classList.toggle("is-correct", state.quizAnsweredTone && option.id === lesson.tone);
    button.classList.toggle("is-wrong", state.quizAnsweredTone === option.id && option.id !== lesson.tone);
    button.addEventListener("click", () => answerQuiz(option.id));
    elements.quizOptions.append(button);
  }

  if (!state.quizAnsweredTone) {
    elements.quizFeedback.value = "Play the phrase, then choose the tone of the highlighted word.";
  }
}

function appendContextLine(container: HTMLElement, lesson: Lesson) {
  const context = lesson.contextThai;

  if (!context) {
    container.textContent = lesson.thai;
    return;
  }

  container.append(document.createTextNode(context.before || ""));
  const mark = document.createElement("mark");
  mark.textContent = context.target;
  container.append(mark);
  container.append(document.createTextNode(context.after || ""));

  if (lesson.contextTranslation) {
    container.append(document.createTextNode(` - ${lesson.contextTranslation}`));
  }
}

function renderVisibility() {
  const normalizing = state.normalizationActive;
  elements.topbar.classList.toggle("is-hidden", normalizing);
  elements.privacyNote.classList.toggle("is-hidden", normalizing);
  elements.firstUseNote.classList.toggle("is-hidden", normalizing || hasDismissedFirstUse());
  elements.normalizationMode.classList.toggle("is-hidden", !normalizing);
  elements.practiceMode.classList.toggle("is-hidden", normalizing || state.mode !== "practice");
  elements.quizMode.classList.toggle("is-hidden", normalizing || state.mode !== "quiz");
  elements.exploreMode.classList.toggle("is-hidden", normalizing || state.mode !== "explore");

  if (normalizing) {
    closeAppMenu();
  }

  updateRecordingButtons();
}

function renderCharts() {
  const lesson = getSelectedLesson();

  drawToneChart(elements.practiceCanvas, {
    target: lesson.contour,
    learner: state.practiceAttempt?.points || null,
    toneId: lesson.tone,
    showTemplates: elements.showPracticeTemplates.checked,
    segments: state.practiceComparison?.segments || [],
    cues: state.practiceComparison?.cues || [],
    emptyText: "Target contour"
  });

  drawToneChart(elements.exploreCanvas, {
    learner: state.exploreAttempt?.points || null,
    showTemplates: elements.showExploreTemplates.checked,
    freeform: true,
    emptyText: "Record or upload audio"
  });
}

async function playSelectedTarget(variant: PlaybackVariant) {
  const lesson = getSelectedLesson();
  const speaker = getSelectedSpeaker();
  const messages = {
    natural: `Playing isolated target word with ${speaker.label}.`,
    exaggerated: `Playing slow isolated target word with ${speaker.label}.`,
    phrase: `Playing phrase with ${speaker.label}.`,
    phraseSlow: `Playing slow phrase with ${speaker.label}.`
  };
  setPracticeStatus(messages[variant] || "Playing target audio.");

  try {
    await playLessonTarget(lesson, variant, speaker);
    setPracticeStatus("Ready for an attempt.");
  } catch (error) {
    setPracticeStatus(error.message || "Target playback failed.");
  }
}

async function playQuizClip() {
  const lesson = getQuizLesson();
  const speaker = getSelectedSpeaker();
  elements.quizFeedback.value = `Playing ${speaker.label}. Listen for the highlighted word.`;

  try {
    await playLessonTarget(lesson, "phrase", speaker);
    if (!state.quizAnsweredTone) {
      elements.quizFeedback.value = "Choose the tone of the highlighted word.";
    }
  } catch (error) {
    elements.quizFeedback.value = error.message || "Quiz clip playback failed.";
  }
}

function answerQuiz(toneId: ToneId) {
  if (state.quizAnsweredTone) {
    return;
  }

  const lesson = getQuizLesson();
  const correct = toneId === lesson.tone;
  state.quizAnsweredTone = toneId;
  state.quizStats.answered += 1;

  if (correct) {
    state.quizStats.correct += 1;
    elements.quizFeedback.value = `Correct. ${lesson.thai} is ${lesson.toneLabelEnglish.toLowerCase()} tone.`;
  } else {
    const selected = TONE_OPTIONS.find((option) => option.id === toneId)?.label || toneId;
    elements.quizFeedback.value = `${selected} is not right here. ${lesson.thai} is ${lesson.toneLabelEnglish.toLowerCase()} tone.`;
  }

  renderQuiz();
}

function nextQuizItem() {
  const currentIndex = quizLessons.findIndex((lesson) => lesson.id === state.quizLessonId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % quizLessons.length;
  state.quizLessonId = quizLessons[nextIndex].id;
  state.quizAnsweredTone = null;
  renderQuiz();
}

async function toggleRecording(kind: RecordingKind) {
  if (state.recording) {
    stopRecording();
    return;
  }

  await startRecording(kind);
}

async function startRecording(kind: RecordingKind) {
  if (state.processingKind) {
    setStatus(kind, "Finish the current analysis before starting another recording.");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus(kind, "Live recording is unavailable in this browser. Upload an audio file instead.");
    return;
  }

  try {
    setStatus(kind, "Requesting microphone access.");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const recorder = new MediaRecorder(stream, getRecorderOptions());
    const chunks = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      stream.getTracks().forEach((track) => track.stop());
      clearTimeout(state.recording?.timeoutId);
      state.recording = null;
      updateRecordingButtons();
      await processBlob(blob, kind);
    }, { once: true });

    recorder.start();
    state.recording = {
      kind,
      recorder,
      timeoutId: window.setTimeout(stopRecording, getRecordingLimitMs(kind))
    };
    updateRecordingButtons();
    setStatus(kind, getRecordingMessage(kind));
  } catch (error) {
    setStatus(kind, error.name === "NotAllowedError"
      ? "Microphone permission was blocked. Upload an audio file instead."
      : error.name === "NotFoundError"
        ? "No microphone was found. Upload an audio file instead."
        : "Could not start microphone recording.");
  }
}

function stopRecording() {
  if (!state.recording) {
    return;
  }

  const { recorder } = state.recording;
  if (recorder.state !== "inactive") {
    recorder.stop();
  }
}

function getRecorderOptions() {
  if (MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus" };
  }
  if (MediaRecorder.isTypeSupported?.("audio/mp4")) {
    return { mimeType: "audio/mp4" };
  }
  return {};
}

async function handleUpload(event: Event, kind: RecordingKind) {
  const input = event.currentTarget as HTMLInputElement;
  const [file] = input.files || [];
  input.value = "";

  if (!file) {
    return;
  }

  await processBlob(file, kind);
}

async function processBlob(blob: Blob, kind: RecordingKind) {
  setStatus(kind, "Analyzing pitch contour.");
  setProcessing(kind, true);

  try {
    const audioBuffer = await decodeBlobToAudioBuffer(blob);
    const analysis = analyzeAudioBuffer(audioBuffer, {
      calibration: isCalibrationKind(kind) ? null : getActiveSpeakerProfile()
    });

    if (analysis.error) {
      setStatus(kind, analysis.error);
      if (kind === "practice") {
        elements.feedback.value = analysis.error;
      } else if (kind === "explore") {
        elements.exploreFeedback.value = analysis.error;
      }
      return;
    }

    if (isCalibrationKind(kind)) {
      handleCalibrationAnalysis(getCalibrationKey(kind), analysis);
    } else if (kind === "practice") {
      handlePracticeAnalysis(analysis);
    } else {
      handleExploreAnalysis(analysis);
    }
  } catch (error) {
    setStatus(kind, "Could not decode this audio file. Try a short WAV, MP3, M4A, or WebM recording.");
  } finally {
    setProcessing(kind, false);
  }
}

function handlePracticeAnalysis(analysis: AudioAnalysis) {
  const lesson = getSelectedLesson();
  const comparison = compareContours(lesson.contour, analysis.points, lesson.tone);
  const calibrationNote = analysis.normalization?.calibrated
    ? ""
    : " Using current-recording normalization, so register feedback is rough until manual normalization is saved or passive range is ready.";
  const rangeWarning = getRangeWarning(analysis.normalization);
  state.practiceAttempt = analysis;
  state.practiceComparison = comparison;
  updatePassiveRange(analysis);
  elements.feedback.value = `${comparison.feedback}${calibrationNote}${rangeWarning}`;
  setPracticeStatus(formatStats(analysis.stats, analysis.normalization));
  state.history.unshift({
    lessonId: lesson.id,
    thai: lesson.thai,
    tone: lesson.toneLabelEnglish,
    feedback: `${comparison.feedback}${analysis.normalization?.calibrated ? "" : " (fallback normalization)"}`
  });
  state.history = state.history.slice(0, 4);
  render();
}

function handleExploreAnalysis(analysis: AudioAnalysis) {
  state.exploreAttempt = analysis;
  updatePassiveRange(analysis);
  elements.exploreFeedback.value = `${formatStats(analysis.stats, analysis.normalization)}${getRangeWarning(analysis.normalization)} Free-form mode does not grade tone correctness.`;
  setExploreStatus("Contour rendered.");
  renderCharts();
}

function handleCalibrationAnalysis(key: CalibrationKey, analysis: AudioAnalysis) {
  state.calibrationSamples[key] = analysis;
  const stats = analysis.stats;
  const nextKey = ["low", "normal", "high"].find((candidate) => !state.calibrationSamples[candidate]);
  const nextInstruction = nextKey
    ? ` Next: ${CALIBRATION_LABELS[nextKey]}, ${CALIBRATION_PROMPTS[nextKey]}`
    : " All three samples are ready. Save normalization.";
  setCalibrationStatus(`${CALIBRATION_LABELS[key]} sample captured: ${formatStats(stats, null)}${nextInstruction}`);
  renderCalibration();
}

function renderHistory() {
  elements.historyList.innerHTML = "";

  if (state.history.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No attempts yet.";
    elements.historyList.append(item);
    return;
  }

  for (const attempt of state.history) {
    const item = document.createElement("li");
    item.textContent = `${attempt.thai} - ${attempt.tone}: ${attempt.feedback}`;
    elements.historyList.append(item);
  }
}

function renderCalibration() {
  const completeKeys = Object.entries(state.calibrationSamples)
    .filter(([, sample]) => sample)
    .map(([key]) => key);
  const isSaved = Boolean(state.calibration);
  const passiveReady = isPassiveRangeReady(state.passiveRange);
  const activeProfile = getActiveSpeakerProfile();
  const busy = Boolean(state.processingKind);

  elements.calibrationBadge.textContent = activeProfile
    ? activeProfile.source === "hybrid"
      ? "Hybrid range"
      : activeProfile.source === "passive"
        ? "Passive range"
        : "Calibrated"
    : "Not calibrated";
  elements.calibrationBadge.classList.toggle("is-ready", Boolean(activeProfile));
  elements.saveCalibration.disabled = busy || completeKeys.length < 3 || Boolean(state.recording);
  elements.resetCalibration.disabled = busy || Boolean(state.recording);
  elements.dismissCalibration.disabled = busy || Boolean(state.recording);

  elements.calibrationLowStatus.textContent = getCalibrationSampleStatus("low");
  elements.calibrationNormalStatus.textContent = getCalibrationSampleStatus("normal");
  elements.calibrationHighStatus.textContent = getCalibrationSampleStatus("high");

  for (const button of elements.calibrationButtons) {
    const key = button.dataset.calibration;
    const isComplete = Boolean(state.calibrationSamples[key]);
    const isRecording = state.recording?.kind === `calibration-${key}`;
    button.classList.toggle("is-complete", isComplete);
    button.classList.toggle("is-recording", isRecording);
    button.disabled = busy || Boolean(state.recording && !isRecording);
    button.querySelector("span").textContent = isRecording ? "Stop" : CALIBRATION_LABELS[key];
  }

  if (isSaved) {
    const createdAt = new Date(state.calibration.createdAt);
    const dateLabel = Number.isNaN(createdAt.getTime()) ? "saved" : createdAt.toLocaleDateString();
    const lowHz = state.calibration.samples?.low?.medianHz ?? state.calibration.floorHz;
    const highHz = state.calibration.samples?.high?.medianHz ?? state.calibration.ceilingHz;
    const refinement = activeProfile?.source === "hybrid" ? " Passive practice data has expanded this range." : "";
    elements.calibrationSummary.textContent = `Saved speaker range from ${Math.round(lowHz)}-${Math.round(highHz)} Hz samples. Practice uses calibrated register bands.${refinement}`;
    const currentStatus = elements.calibrationStatus.textContent;
    if (!state.recording && (!currentStatus || currentStatus.startsWith("Start with Low:"))) {
      setCalibrationStatus(`Normalization saved ${dateLabel}.`);
    }
  } else if (passiveReady) {
    elements.calibrationSummary.textContent = `Passive range is ready from ${Math.round(state.passiveRange.profile.floorHz)}-${Math.round(state.passiveRange.profile.ceilingHz)} Hz. Manual normalization is still recommended for the best Thai register feedback.`;
  } else {
    elements.calibrationSummary.textContent = "Record three separate steady อา samples: comfortable low, normal speaking pitch, and comfortable high. Do not use a sentence.";
  }

  renderPassiveRange();
}

function getCalibrationSampleStatus(key: CalibrationKey): string {
  const sample = state.calibrationSamples[key];
  if (!sample) {
    if (state.calibration?.samples?.[key]) {
      return `Saved ${Math.round(state.calibration.samples[key].medianHz)} Hz`;
    }
    return "Needed";
  }

  const seconds = sample.stats.voicedDurationSec || 0;
  return `${Math.round(sample.stats.medianHz)} Hz, ${seconds.toFixed(1)}s`;
}

function updatePassiveRange(analysis: AudioAnalysis) {
  const validPitches = analysis.frames
    .map((frame) => frame.f0)
    .filter((f0) => f0 >= 50 && f0 <= 600)
    .map((f0) => Math.round(f0 * 10) / 10);

  if (!validPitches.length) {
    return;
  }

  const current = state.passiveRange || createEmptyPassiveRange();
  const pitches = [...current.pitches, ...validPitches].slice(-PASSIVE_MAX_PITCHES);
  const next = {
    ...current,
    pitches,
    totalVoicedSeconds: (current.totalVoicedSeconds || 0) + (analysis.stats.voicedDurationSec || 0),
    updatedAt: new Date().toISOString()
  };
  next.profile = computePassiveProfile(next);
  state.passiveRange = next;
  persistPassiveRange(next);
  renderPassiveRange();
}

function renderPassiveRange() {
  const passive = state.passiveRange || createEmptyPassiveRange();
  const progress = getPassiveProgress(passive);
  const percent = Math.round(progress * 100);
  elements.passiveRangePercent.textContent = `${percent}%`;
  elements.passiveRangeBar.value = percent;
  elements.passiveRangeBar.textContent = `${percent}%`;

  if (isPassiveRangeReady(passive)) {
    const profile = passive.profile;
    const sourceText = state.calibration
      ? "Manual normalization is active; passive data can expand the range if practice reveals a wider comfortable span."
      : "Passive range is active. Manual normalization is still recommended for the cleanest register estimate.";
    elements.passiveRangeStatus.textContent = `Ready from ${Math.round(profile.floorHz)}-${Math.round(profile.ceilingHz)} Hz across ${Math.round(passive.totalVoicedSeconds)}s of voiced practice. ${sourceText}`;
    return;
  }

  if (
    (passive.pitches?.length || 0) >= PASSIVE_READY_FRAMES &&
    (passive.totalVoicedSeconds || 0) >= PASSIVE_READY_SECONDS &&
    !passive.profile
  ) {
    elements.passiveRangeStatus.textContent = "Passive data has enough speech, but the pitch range is too narrow. Practice a wider mix of low, mid, rising, falling, and high tones, or use manual normalization.";
    return;
  }

  const remainingSeconds = Math.max(0, PASSIVE_READY_SECONDS - (passive.totalVoicedSeconds || 0));
  elements.passiveRangeStatus.textContent = `Collected ${Math.round(passive.totalVoicedSeconds || 0)}s of voiced practice. Need about ${Math.ceil(remainingSeconds)}s more across varied tones before passive range can personalize feedback.`;
}

function saveCalibration() {
  const result = buildCalibration(state.calibrationSamples);
  if (result.error) {
    setCalibrationStatus(result.error);
    return;
  }

  state.calibration = result.calibration;
  state.normalizationActive = false;
  markNormalizationDismissed();
  const persisted = persistCalibration(state.calibration);
  setCalibrationStatus(persisted
    ? "Saved normalization. New attempts will use your speaker range."
    : "Normalization is active for this session, but could not be saved in this browser.");
  renderCalibration();
  renderVisibility();
}

function resetCalibration() {
  state.calibration = null;
  state.passiveRange = createEmptyPassiveRange();
  state.normalizationActive = true;
  state.calibrationSamples = {
    low: null,
    normal: null,
    high: null
  };
  clearPersistedCalibration();
  clearPersistedPassiveRange();
  clearNormalizationDismissed();
  setCalibrationStatus("Normalization reset. Practice will use current-recording fallback.");
  renderCalibration();
  renderVisibility();
}

function updateRecordingButtons() {
  const practiceRecording = state.recording?.kind === "practice";
  const exploreRecording = state.recording?.kind === "explore";
  const busy = Boolean(state.processingKind);
  elements.recordPractice.classList.toggle("is-recording", practiceRecording);
  elements.recordExplore.classList.toggle("is-recording", exploreRecording);
  elements.recordPractice.textContent = practiceRecording ? "Stop recording" : "Record attempt";
  elements.recordExplore.textContent = exploreRecording ? "Stop recording" : "Record free-form";
  elements.recordPractice.disabled = busy || Boolean(state.recording && !practiceRecording);
  elements.recordExplore.disabled = busy || Boolean(state.recording && !exploreRecording);
  elements.playNatural.disabled = busy || Boolean(state.recording);
  elements.playSlow.disabled = busy || Boolean(state.recording);
  elements.playPhrase.disabled = busy || Boolean(state.recording);
  elements.playPhraseSlow.disabled = busy || Boolean(state.recording);
  elements.targetSpeaker.disabled = busy || Boolean(state.recording);
  elements.playQuizClip.disabled = busy || Boolean(state.recording);
  elements.nextQuizItem.disabled = busy || Boolean(state.recording);
  updateCycleButtons();
  setFileInputDisabled(elements.practiceUpload, busy || Boolean(state.recording));
  setFileInputDisabled(elements.exploreUpload, busy || Boolean(state.recording));
  elements.practiceCanvas.toggleAttribute("aria-busy", state.processingKind === "practice");
  elements.exploreCanvas.toggleAttribute("aria-busy", state.processingKind === "explore");
  renderCalibration();
}

function setProcessing(kind: RecordingKind, active: boolean) {
  state.processingKind = active ? kind : null;
  updateRecordingButtons();
}

function setFileInputDisabled(input: HTMLInputElement, disabled: boolean) {
  input.disabled = disabled;
  const label = input.closest(".file-button");
  label?.classList.toggle("is-disabled", disabled);
  label?.setAttribute("aria-disabled", String(disabled));
}

function formatStats(stats: PitchStats, normalization: PitchNormalization | null = null): string {
  if (!stats || !stats.voicedFrameCount) {
    return "Pitch was unclear.";
  }

  const normalizationLabel = normalization
    ? normalization.calibrated
      ? normalization.source === "passive"
        ? " Passive speaker range used."
        : normalization.source === "hybrid"
          ? " Manual range with passive refinement used."
          : " Manual speaker range used."
      : " Current-recording normalization used."
    : "";

  return `Detected ${stats.voicedFrameCount} voiced frames, median pitch ${Math.round(stats.medianHz)} Hz.${normalizationLabel}`;
}

function getRangeWarning(normalization: PitchNormalization | null | undefined): string {
  if (!normalization?.calibrated || !normalization.excursions?.hasExcursion) {
    return "";
  }

  const excursions = normalization.excursions;
  if (excursions.aboveFrameCount >= excursions.belowFrameCount && excursions.maxAboveSemitones >= 1) {
    return " Part of this attempt went above your comfortable calibrated range; avoid strain, or recalibrate if that pitch felt easy.";
  }

  if (excursions.maxBelowSemitones >= 1) {
    return " Part of this attempt went below your calibrated range; recalibrate if that low pitch felt comfortable.";
  }

  return "";
}

function setStatus(kind: RecordingKind, message: string) {
  if (isCalibrationKind(kind)) {
    setCalibrationStatus(message);
  } else if (kind === "practice") {
    setPracticeStatus(message);
  } else {
    setExploreStatus(message);
  }
}

function setPracticeStatus(message: string) {
  elements.practiceStatus.textContent = message;
}

function setExploreStatus(message: string) {
  elements.exploreStatus.textContent = message;
}

function setCalibrationStatus(message: string) {
  elements.calibrationStatus.textContent = message;
}

function shouldShowNormalizationOnLoad() {
  return !state.calibration && !hasDismissedNormalization();
}

function openNormalizationFlow() {
  closeAppMenu();
  state.normalizationActive = true;
  setCalibrationStatus(`Start with Low: ${CALIBRATION_PROMPTS.low}`);
  renderCalibration();
  renderVisibility();
  window.setTimeout(() => {
    const lowButton = elements.calibrationButtons.find((button) => button.dataset.calibration === "low");
    lowButton?.focus();
  }, 250);
}

function dismissNormalizationFlow() {
  markNormalizationDismissed();
  state.normalizationActive = false;
  renderVisibility();
}

function dismissFirstUse() {
  try {
    localStorage.setItem(FIRST_USE_STORAGE_KEY, "1");
  } catch (error) {
    // The note can still be hidden for this render pass.
  }

  elements.firstUseNote.classList.add("is-hidden");
}

function toggleAppMenu() {
  const isOpen = !elements.appMenu.classList.contains("is-hidden");
  elements.appMenu.classList.toggle("is-hidden", isOpen);
  elements.menuButton.setAttribute("aria-expanded", String(!isOpen));
}

function closeAppMenu() {
  elements.appMenu.classList.add("is-hidden");
  elements.menuButton.setAttribute("aria-expanded", "false");
}

function hasDismissedNormalization() {
  try {
    return localStorage.getItem(NORMALIZATION_DISMISSED_STORAGE_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function hasDismissedFirstUse() {
  try {
    return localStorage.getItem(FIRST_USE_STORAGE_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function markNormalizationDismissed() {
  try {
    localStorage.setItem(NORMALIZATION_DISMISSED_STORAGE_KEY, "1");
  } catch (error) {
    // The current session can still proceed without persistence.
  }
}

function clearNormalizationDismissed() {
  try {
    localStorage.removeItem(NORMALIZATION_DISMISSED_STORAGE_KEY);
  } catch (error) {
    // Session state has already been reset.
  }
}

function isCalibrationKind(kind: RecordingKind | string): kind is `calibration-${CalibrationKey}` {
  return kind.startsWith("calibration-");
}

function getCalibrationKey(kind: `calibration-${CalibrationKey}`): CalibrationKey {
  return kind.replace("calibration-", "") as CalibrationKey;
}

function getRecordingLimitMs(kind: RecordingKind): number {
  if (kind === "practice") {
    return 3600;
  }

  if (isCalibrationKind(kind)) {
    return 5200;
  }

  return 6200;
}

function getRecordingMessage(kind: RecordingKind): string {
  if (isCalibrationKind(kind)) {
    const key = getCalibrationKey(kind);
    return `Recording ${CALIBRATION_LABELS[key].toLowerCase()} normalization. ${CALIBRATION_PROMPTS[key]} Release or tap again to stop.`;
  }

  return "Recording. Release or tap again to stop.";
}

function loadCalibration() {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const calibration = JSON.parse(raw);
    if (
      calibration?.version === 1 &&
      Number.isFinite(calibration.rangeLowSemitone) &&
      Number.isFinite(calibration.rangeHighSemitone) &&
      calibration.rangeHighSemitone > calibration.rangeLowSemitone
    ) {
      return calibration;
    }
  } catch (error) {
    return null;
  }

  return null;
}

function persistCalibration(calibration: SpeakerProfile): boolean {
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibration));
    return true;
  } catch (error) {
    return false;
  }
}

function clearPersistedCalibration() {
  try {
    localStorage.removeItem(CALIBRATION_STORAGE_KEY);
  } catch (error) {
    // Nothing useful to recover here; the session state is already reset.
  }
}

function getActiveSpeakerProfile(): SpeakerProfile | null {
  const manual = normalizeSpeakerProfile(state.calibration);
  const passive = isPassiveRangeReady(state.passiveRange)
    ? normalizeSpeakerProfile(state.passiveRange.profile)
    : null;

  if (manual && passive) {
    const rangeLowSemitone = Math.min(manual.rangeLowSemitone, passive.rangeLowSemitone);
    const rangeHighSemitone = Math.max(manual.rangeHighSemitone, passive.rangeHighSemitone);
    const expanded = rangeLowSemitone < manual.rangeLowSemitone || rangeHighSemitone > manual.rangeHighSemitone;

    return {
      ...manual,
      source: expanded ? "hybrid" : "manual",
      passiveReady: true,
      rangeLowSemitone,
      rangeHighSemitone,
      floorSemitone: rangeLowSemitone,
      ceilingSemitone: rangeHighSemitone,
      floorHz: semitoneToHz(rangeLowSemitone),
      ceilingHz: semitoneToHz(rangeHighSemitone),
      spanSemitones: rangeHighSemitone - rangeLowSemitone
    };
  }

  return manual || passive;
}

function normalizeSpeakerProfile(profile: Partial<SpeakerProfile> | null | undefined): SpeakerProfile | null {
  if (!profile) {
    return null;
  }

  const rangeLowSemitone = firstFinite(
    profile.rangeLowSemitone,
    profile.floorSemitone,
    profile.lowSemitone
  );
  const rangeHighSemitone = firstFinite(
    profile.rangeHighSemitone,
    profile.ceilingSemitone,
    profile.highSemitone
  );

  if (!Number.isFinite(rangeLowSemitone) || !Number.isFinite(rangeHighSemitone) || rangeHighSemitone <= rangeLowSemitone) {
    return null;
  }

  const midSemitone = firstFinite(
    profile.midSemitone,
    profile.normalSemitone,
    (rangeLowSemitone + rangeHighSemitone) / 2
  );

  return {
    ...profile,
    source: profile.source || "manual",
    rangeLowSemitone,
    rangeHighSemitone,
    floorSemitone: firstFinite(profile.floorSemitone, profile.lowSemitone, rangeLowSemitone),
    midSemitone,
    ceilingSemitone: firstFinite(profile.ceilingSemitone, profile.highSemitone, rangeHighSemitone),
    floorHz: firstFinite(profile.floorHz, semitoneToHz(rangeLowSemitone)),
    midHz: firstFinite(profile.midHz, semitoneToHz(midSemitone)),
    ceilingHz: firstFinite(profile.ceilingHz, semitoneToHz(rangeHighSemitone)),
    spanSemitones: rangeHighSemitone - rangeLowSemitone
  };
}

function createEmptyPassiveRange(): PassiveRange {
  return {
    version: 1,
    pitches: [],
    totalVoicedSeconds: 0,
    profile: null,
    updatedAt: null
  };
}

function computePassiveProfile(passiveRange: PassiveRange): SpeakerProfile | null {
  if (!passiveRange?.pitches?.length || !isPassiveRangeReady({ ...passiveRange, profile: null }, false)) {
    return null;
  }

  const sorted = [...passiveRange.pitches].sort((a, b) => a - b);
  const floorHz = quantile(sorted, 0.05);
  const midHz = quantile(sorted, 0.5);
  const ceilingHz = quantile(sorted, 0.95);
  const floorSemitone = hzToSemitone(floorHz);
  const midSemitone = hzToSemitone(midHz);
  const ceilingSemitone = hzToSemitone(ceilingHz);
  const spanSemitones = ceilingSemitone - floorSemitone;

  if (spanSemitones < 5) {
    return null;
  }

  return {
    version: 1,
    source: "passive",
    createdAt: passiveRange.updatedAt || new Date().toISOString(),
    floorHz,
    midHz,
    ceilingHz,
    floorSemitone,
    midSemitone,
    ceilingSemitone,
    rangeLowSemitone: floorSemitone,
    rangeHighSemitone: ceilingSemitone,
    spanSemitones,
    frameCount: sorted.length,
    observedSeconds: passiveRange.totalVoicedSeconds || 0
  };
}

function isPassiveRangeReady(passiveRange: PassiveRange | null, requireProfile = true): boolean {
  if (!passiveRange) {
    return false;
  }

  const enoughData =
    (passiveRange.pitches?.length || 0) >= PASSIVE_READY_FRAMES &&
    (passiveRange.totalVoicedSeconds || 0) >= PASSIVE_READY_SECONDS;

  return requireProfile ? enoughData && Boolean(passiveRange.profile) : enoughData;
}

function getPassiveProgress(passiveRange: PassiveRange | null): number {
  if (!passiveRange) {
    return 0;
  }

  if (isPassiveRangeReady(passiveRange)) {
    return 1;
  }

  return Math.min(
    0.99,
    Math.max(
      0,
      Math.min(
        (passiveRange.totalVoicedSeconds || 0) / PASSIVE_READY_SECONDS,
        (passiveRange.pitches?.length || 0) / PASSIVE_READY_FRAMES
      )
    )
  );
}

function loadPassiveRange() {
  try {
    const raw = localStorage.getItem(PASSIVE_RANGE_STORAGE_KEY);
    if (!raw) {
      return createEmptyPassiveRange();
    }

    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && Array.isArray(parsed.pitches)) {
      const passive = {
        ...createEmptyPassiveRange(),
        ...parsed,
        pitches: parsed.pitches.filter((f0) => Number.isFinite(f0)).slice(-PASSIVE_MAX_PITCHES)
      };
      passive.profile = computePassiveProfile(passive);
      return passive;
    }
  } catch (error) {
    return createEmptyPassiveRange();
  }

  return createEmptyPassiveRange();
}

function persistPassiveRange(passiveRange: PassiveRange) {
  try {
    localStorage.setItem(PASSIVE_RANGE_STORAGE_KEY, JSON.stringify(passiveRange));
  } catch (error) {
    // Passive refinement is opportunistic; failure should not block practice.
  }
}

function clearPersistedPassiveRange() {
  try {
    localStorage.removeItem(PASSIVE_RANGE_STORAGE_KEY);
  } catch (error) {
    // Session state has already been reset.
  }
}

function quantile(values: number[], position: number): number {
  if (values.length === 0) {
    return 0;
  }

  const index = (values.length - 1) * position;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return values[lower] * (1 - weight) + values[upper] * weight;
}

function hzToSemitone(hz: number): number {
  return 12 * Math.log2(hz / 440);
}

function semitoneToHz(semitone: number): number {
  return 440 * 2 ** (semitone / 12);
}

function firstFinite(...values: Array<number | null | undefined>): number | undefined {
  return values.find((value) => Number.isFinite(value));
}

function getSelectedLesson(): Lesson {
  return getLessonSelection(
    state.selectedToneId,
    state.selectedWordId,
    state.selectedPhraseVariantId,
    state.selectedSpeakerId
  );
}

function getQuizLesson(): Lesson {
  return getQuizLessonById(state.quizLessonId, state.selectedSpeakerId);
}

function getSelectedSpeaker(): AudioSpeaker {
  return audioSpeakers.find((speaker) => speaker.id === state.selectedSpeakerId) || audioSpeakers[0];
}

init();
