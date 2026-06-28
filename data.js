export const registerBands = [
  { id: "low", label: "low register", from: 0, to: 0.34 },
  { id: "mid", label: "mid register", from: 0.34, to: 0.66 },
  { id: "high", label: "high register", from: 0.66, to: 1 }
];

export const toneTemplates = {
  mid: {
    label: "Mid",
    color: "#0f766e",
    points: [
      { t: 0, y: 0.52 },
      { t: 1, y: 0.52 }
    ]
  },
  low: {
    label: "Low",
    color: "#2563eb",
    points: [
      { t: 0, y: 0.31 },
      { t: 0.55, y: 0.25 },
      { t: 1, y: 0.27 }
    ]
  },
  falling: {
    label: "Falling",
    color: "#dc2626",
    points: [
      { t: 0, y: 0.74 },
      { t: 0.25, y: 0.86 },
      { t: 1, y: 0.24 }
    ]
  },
  high: {
    label: "High",
    color: "#b45309",
    points: [
      { t: 0, y: 0.7 },
      { t: 0.55, y: 0.77 },
      { t: 1, y: 0.82 }
    ]
  },
  rising: {
    label: "Rising",
    color: "#7c3aed",
    points: [
      { t: 0, y: 0.27 },
      { t: 0.35, y: 0.22 },
      { t: 1, y: 0.8 }
    ]
  }
};

export const lessons = [
  {
    id: "mid-ma",
    thai: "มา",
    translation: "come",
    tone: "mid",
    toneLabelEnglish: "Mid",
    contextThai: { before: "เขา", target: "มา", after: "แล้ว" },
    contextTranslation: "They have arrived.",
    targetWordTiming: null,
    audio: { natural: "", exaggerated: "" },
    contour: toneTemplates.mid.points
  },
  {
    id: "low-pa",
    thai: "ป่า",
    translation: "forest",
    tone: "low",
    toneLabelEnglish: "Low",
    contextThai: { before: "ใน", target: "ป่า", after: "มีต้นไม้" },
    contextTranslation: "There are trees in the forest.",
    targetWordTiming: null,
    audio: { natural: "", exaggerated: "" },
    contour: toneTemplates.low.points
  },
  {
    id: "falling-khao",
    thai: "ข้าว",
    translation: "rice",
    tone: "falling",
    toneLabelEnglish: "Falling",
    contextThai: { before: "ฉันกิน", target: "ข้าว", after: "" },
    contextTranslation: "I eat rice.",
    targetWordTiming: null,
    audio: { natural: "", exaggerated: "" },
    contour: toneTemplates.falling.points
  },
  {
    id: "high-ma",
    thai: "ม้า",
    translation: "horse",
    tone: "high",
    toneLabelEnglish: "High",
    contextThai: { before: "", target: "ม้า", after: "วิ่งเร็ว" },
    contextTranslation: "The horse runs fast.",
    targetWordTiming: null,
    audio: { natural: "", exaggerated: "" },
    contour: toneTemplates.high.points
  },
  {
    id: "rising-ma",
    thai: "หมา",
    translation: "dog",
    tone: "rising",
    toneLabelEnglish: "Rising",
    contextThai: { before: "", target: "หมา", after: "นอนอยู่" },
    contextTranslation: "The dog is lying down.",
    targetWordTiming: null,
    audio: { natural: "", exaggerated: "" },
    contour: toneTemplates.rising.points
  }
];

export function getLessonById(id) {
  return lessons.find((lesson) => lesson.id === id) || lessons[0];
}
