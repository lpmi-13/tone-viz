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

export const audioSpeakers = [
  {
    id: "premwadee",
    label: "Premwadee",
    voice: "th-TH-PremwadeeNeural",
    root: "/audio/generated/th-th-premwadee"
  },
  {
    id: "niwat",
    label: "Niwat",
    voice: "th-TH-NiwatNeural",
    root: "/audio/generated/th-th-niwat"
  }
];

export const defaultAudioSpeakerId = audioSpeakers[0].id;

const DEFAULT_AUDIO_ROOT = audioSpeakers[0].root;

function seedAudio(id) {
  return {
    natural: `${DEFAULT_AUDIO_ROOT}/${id}-natural.mp3`,
    exaggerated: `${DEFAULT_AUDIO_ROOT}/${id}-slow.mp3`
  };
}

function seedPhraseAudio(id) {
  return {
    phrase: `${DEFAULT_AUDIO_ROOT}/${id}-phrase.mp3`,
    phraseSlow: `${DEFAULT_AUDIO_ROOT}/${id}-phrase-slow.mp3`
  };
}

function generatedPhraseVariantAudio(id) {
  return {
    natural: `${DEFAULT_AUDIO_ROOT}/${id}-natural.mp3`,
    exaggerated: `${DEFAULT_AUDIO_ROOT}/${id}-slow.mp3`,
    phrase: `${DEFAULT_AUDIO_ROOT}/${id}-phrase.mp3`,
    phraseSlow: `${DEFAULT_AUDIO_ROOT}/${id}-phrase-slow.mp3`
  };
}

function phrase(id, before, target, after, contextTranslation, options = {}) {
  return {
    id,
    contextThai: { before, target, after },
    contextTranslation,
    targetWordTiming: options.targetWordTiming || null,
    audio: options.audio || {},
    sourceId: options.sourceId || null
  };
}

export const toneGroups = [
  {
    id: "mid",
    tone: "mid",
    toneLabelEnglish: "Mid",
    contour: toneTemplates.mid.points,
    words: [
      {
        id: "mid-ma",
        thai: "มา",
        translation: "come",
        audio: seedAudio("mid-ma"),
        phraseVariants: [
          phrase("mid-ma-arrived", "เขา", "มา", "แล้ว", "They have arrived.", {
            audio: seedPhraseAudio("mid-ma")
          })
        ]
      },
      {
        id: "mid-kin",
        thai: "กิน",
        translation: "eat",
        phraseVariants: [
          phrase("mid-kin-fish-question", "คุณชอบ", "กิน", "ปลาไหมคะ", "Do you like to eat fish?", {
            sourceId: "word-slice:th-m2-001"
          }),
          phrase("mid-kin-no-pork", "ดิฉันไม่", "กิน", "หมูค่ะ", "I do not eat pork.", {
            sourceId: "word-slice:th-m2-003"
          }),
          phrase("mid-kin-spicy", "คุณ", "กิน", "อาหารเผ็ดได้ไหมคะ", "Can you eat spicy food?", {
            sourceId: "word-slice:th-m2-004"
          })
        ]
      },
      {
        id: "mid-pai",
        thai: "ไป",
        translation: "go",
        phraseVariants: [
          phrase("mid-pai-market", "ผม", "ไป", "ตลาดได้ไหมครับ", "May I go to the market?", {
            sourceId: "word-slice:th-d1-003"
          }),
          phrase("mid-pai-school", "ผมอยากจะ", "ไป", "โรงเรียนครับ", "I want to go to school.", {
            sourceId: "word-slice:th-d1-004"
          }),
          phrase("mid-pai-hospital", "ดิฉันอยากจะ", "ไป", "โรงพยาบาลค่ะ", "I want to go to the hospital.", {
            sourceId: "word-slice:th-d1-005"
          })
        ]
      },
      {
        id: "mid-pla",
        thai: "ปลา",
        translation: "fish",
        phraseVariants: [
          phrase("mid-pla-like", "คุณชอบกิน", "ปลา", "ไหมคะ", "Do you like to eat fish?", {
            sourceId: "word-slice:th-m2-001"
          }),
          phrase("mid-pla-not-like", "ผมไม่ชอบกิน", "ปลา", "ครับ", "I do not like to eat fish.", {
            sourceId: "word-slice:th-m2-002"
          })
        ]
      }
    ]
  },
  {
    id: "low",
    tone: "low",
    toneLabelEnglish: "Low",
    contour: toneTemplates.low.points,
    words: [
      {
        id: "low-pa",
        thai: "ป่า",
        translation: "forest",
        audio: seedAudio("low-pa"),
        phraseVariants: [
          phrase("low-pa-trees", "ใน", "ป่า", "มีต้นไม้", "There are trees in the forest.", {
            audio: seedPhraseAudio("low-pa")
          })
        ]
      },
      {
        id: "low-khai",
        thai: "ไข่",
        translation: "egg",
        phraseVariants: [
          phrase("low-khai-omelet", "", "ไข่", "เจียว", "Thai omelet.", {
            sourceId: "word-slice:th-e2-008"
          }),
          phrase("low-khai-fried", "", "ไข่", "ดาว", "Fried egg.", {
            sourceId: "word-slice:th-e2-009"
          })
        ]
      },
      {
        id: "low-kai",
        thai: "ไก่",
        translation: "chicken",
        phraseVariants: [
          phrase("low-kai-fried-rice", "ข้าวผัด", "ไก่", "", "Fried rice with chicken.", {
            sourceId: "word-slice:th-e2-004"
          }),
          phrase("low-kai-grilled", "ขอ", "ไก่", "ย่างสองชิ้น", "Can I have two pieces of grilled chicken?", {
            sourceId: "word-slice:th-m1-004"
          }),
          phrase("low-kai-fried", "ผมชอบกิน", "ไก่", "ทอดครับ", "I like to eat fried chicken.", {
            sourceId: "word-slice:th-d2-009"
          })
        ]
      }
    ]
  },
  {
    id: "falling",
    tone: "falling",
    toneLabelEnglish: "Falling",
    contour: toneTemplates.falling.points,
    words: [
      {
        id: "falling-khao",
        thai: "ข้าว",
        translation: "rice",
        audio: seedAudio("falling-khao"),
        phraseVariants: [
          phrase("falling-khao-eat", "ฉันกิน", "ข้าว", "", "I eat rice.", {
            audio: seedPhraseAudio("falling-khao")
          }),
          phrase("falling-khao-pork", "", "ข้าว", "ผัดหมู", "Fried rice with pork.", {
            sourceId: "word-slice:th-e2-003"
          }),
          phrase("falling-khao-chicken", "", "ข้าว", "ผัดไก่", "Fried rice with chicken.", {
            sourceId: "word-slice:th-e2-004"
          }),
          phrase("falling-khao-shrimp", "ขอ", "ข้าว", "ผัดกุ้งครับ", "Can I have shrimp fried rice?", {
            sourceId: "word-slice:th-m1-002"
          })
        ]
      },
      {
        id: "falling-mai",
        thai: "ไม่",
        translation: "not / no",
        phraseVariants: [
          phrase("falling-mai-okay", "", "ไม่", "เป็นไรค่ะ", "It's okay / never mind.", {
            sourceId: "word-slice:th-e1-015"
          }),
          phrase("falling-mai-fish", "ผม", "ไม่", "ชอบกินปลาครับ", "I do not like to eat fish.", {
            sourceId: "word-slice:th-m2-002"
          }),
          phrase("falling-mai-understand", "ดิฉัน", "ไม่", "เข้าใจค่ะ", "I do not understand.", {
            sourceId: "word-slice:th-d1-006"
          })
        ]
      },
      {
        id: "falling-mae",
        thai: "แม่",
        translation: "mother",
        phraseVariants: [
          phrase("falling-mae-age", "", "แม่", "ของคุณอายุเท่าไรครับ", "How old is your mother?", {
            sourceId: "word-slice:th-m2-010"
          }),
          phrase("falling-mae-my", "", "แม่", "ของดิฉันอายุห้าสิบแปดปีค่ะ", "My mother is fifty-eight years old.", {
            sourceId: "word-slice:th-m2-011"
          })
        ]
      },
      {
        id: "falling-chue",
        thai: "ชื่อ",
        translation: "name",
        phraseVariants: [
          phrase("falling-chue-wichai", "ผม", "ชื่อ", "วิชัย", "My name is Wichai.", {
            sourceId: "word-slice:th-e1-003"
          }),
          phrase("falling-chue-sunisa", "ดิฉัน", "ชื่อ", "สุนิสา", "My name is Sunisa.", {
            sourceId: "word-slice:th-e1-004"
          }),
          phrase("falling-chue-question", "คุณ", "ชื่อ", "อะไรคะ", "What is your name?", {
            sourceId: "word-slice:th-e1-006"
          })
        ]
      }
    ]
  },
  {
    id: "high",
    tone: "high",
    toneLabelEnglish: "High",
    contour: toneTemplates.high.points,
    words: [
      {
        id: "high-ma",
        thai: "ม้า",
        translation: "horse",
        audio: seedAudio("high-ma"),
        phraseVariants: [
          phrase("high-ma-runs", "", "ม้า", "วิ่งเร็ว", "The horse runs fast.", {
            audio: seedPhraseAudio("high-ma")
          })
        ]
      },
      {
        id: "high-nam",
        thai: "น้ำ",
        translation: "water",
        phraseVariants: [
          phrase("high-nam-cold", "", "น้ำ", "เย็น", "Cold water.", {
            sourceId: "word-slice:th-e2-012"
          }),
          phrase("high-nam-order", "ขอ", "น้ำ", "เย็นหนึ่งขวดครับ", "Can I have one bottle of cold water?", {
            sourceId: "word-slice:th-m1-003"
          }),
          phrase("high-nam-kind", "เอา", "น้ำ", "อะไรคะ", "What kind of drink do you want?", {
            sourceId: "word-slice:th-m1-012"
          })
        ]
      },
      {
        id: "high-sue",
        thai: "ซื้อ",
        translation: "buy",
        phraseVariants: [
          phrase("high-sue-things", "ฉัน", "ซื้อ", "ของ", "I buy things.", {
            sourceId: "authored"
          }),
          phrase("high-sue-water", "เขา", "ซื้อ", "น้ำ", "They buy water.", {
            sourceId: "authored"
          })
        ]
      }
    ]
  },
  {
    id: "rising",
    tone: "rising",
    toneLabelEnglish: "Rising",
    contour: toneTemplates.rising.points,
    words: [
      {
        id: "rising-ma",
        thai: "หมา",
        translation: "dog",
        audio: seedAudio("rising-ma"),
        phraseVariants: [
          phrase("rising-ma-sleeping", "", "หมา", "นอนอยู่", "The dog is lying down.", {
            audio: seedPhraseAudio("rising-ma")
          })
        ]
      },
      {
        id: "rising-kho",
        thai: "ขอ",
        translation: "ask for",
        phraseVariants: [
          phrase("rising-kho-rice", "", "ขอ", "ข้าวผัดกุ้งครับ", "Can I have shrimp fried rice?", {
            sourceId: "word-slice:th-m1-002"
          }),
          phrase("rising-kho-water", "", "ขอ", "น้ำเย็นหนึ่งขวดครับ", "Can I have one bottle of cold water?", {
            sourceId: "word-slice:th-m1-003"
          }),
          phrase("rising-kho-chicken", "", "ขอ", "ไก่ย่างสองชิ้น", "Can I have two pieces of grilled chicken?", {
            sourceId: "word-slice:th-m1-004"
          })
        ]
      },
      {
        id: "rising-phom",
        thai: "ผม",
        translation: "I (male)",
        phraseVariants: [
          phrase("rising-phom-name", "", "ผม", "ชื่อวิชัย", "My name is Wichai.", {
            sourceId: "word-slice:th-e1-003"
          }),
          phrase("rising-phom-fine", "", "ผม", "สบายดีครับ", "I am fine.", {
            sourceId: "word-slice:th-e1-010"
          }),
          phrase("rising-phom-fish", "", "ผม", "ไม่ชอบกินปลาครับ", "I do not like to eat fish.", {
            sourceId: "word-slice:th-m2-002"
          })
        ]
      },
      {
        id: "rising-mai",
        thai: "ไหม",
        translation: "question particle",
        phraseVariants: [
          phrase("rising-mai-fine", "คุณสบายดี", "ไหม", "ครับ", "How are you?", {
            sourceId: "word-slice:th-e1-011"
          }),
          phrase("rising-mai-fish", "คุณชอบกินปลา", "ไหม", "คะ", "Do you like to eat fish?", {
            sourceId: "word-slice:th-m2-001"
          }),
          phrase("rising-mai-market", "ผมไปตลาดได้", "ไหม", "ครับ", "May I go to the market?", {
            sourceId: "word-slice:th-d1-003"
          })
        ]
      }
    ]
  }
];

export const lessons = toneGroups.flatMap((group) =>
  group.words.map((word) => normalizeLesson(group, word, word.phraseVariants[0] || null))
);

export const quizLessons = toneGroups.flatMap((group) =>
  group.words.flatMap((word) => {
    const variants = word.phraseVariants.length ? word.phraseVariants : [null];
    return variants.map((variant) => normalizeLesson(group, word, variant));
  })
);

export const defaultSelection = {
  toneId: toneGroups[0].id,
  wordId: toneGroups[0].words[0].id,
  phraseVariantId: toneGroups[0].words[0].phraseVariants[0]?.id || null
};

export function getToneGroupById(id) {
  return toneGroups.find((group) => group.id === id) || toneGroups[0];
}

export function getWordById(toneId, wordId) {
  const group = getToneGroupById(toneId);
  return group.words.find((word) => word.id === wordId) || group.words[0];
}

export function getPhraseVariantById(word, phraseVariantId) {
  if (!word?.phraseVariants?.length) {
    return null;
  }

  return word.phraseVariants.find((variant) => variant.id === phraseVariantId) || word.phraseVariants[0];
}

export function getLessonSelection(toneId, wordId, phraseVariantId) {
  const group = getToneGroupById(toneId);
  const word = getWordById(group.id, wordId);
  const phraseVariant = getPhraseVariantById(word, phraseVariantId);
  return normalizeLesson(group, word, phraseVariant);
}

export function getLessonById(id) {
  const [wordId, phraseVariantId] = splitLessonId(id);

  for (const group of toneGroups) {
    const word = group.words.find((candidate) => candidate.id === wordId);
    if (word) {
      return normalizeLesson(group, word, getPhraseVariantById(word, phraseVariantId));
    }
  }

  return lessons[0];
}

export function getQuizLessonById(id) {
  return quizLessons.find((lesson) => lesson.id === id) || quizLessons[0];
}

function normalizeLesson(group, word, phraseVariant) {
  const audio = {
    ...(phraseVariant ? generatedPhraseVariantAudio(phraseVariant.id) : {}),
    ...(word.audio || {}),
    ...(phraseVariant?.audio || {})
  };
  const phraseIndex = phraseVariant ? word.phraseVariants.findIndex((variant) => variant.id === phraseVariant.id) : -1;

  return {
    id: phraseVariant ? `${word.id}:${phraseVariant.id}` : word.id,
    tone: group.tone,
    toneId: group.id,
    toneLabelEnglish: group.toneLabelEnglish,
    thai: word.thai,
    translation: word.translation,
    wordId: word.id,
    phraseVariantId: phraseVariant?.id || null,
    phraseVariantIndex: phraseIndex,
    phraseVariantCount: word.phraseVariants.length,
    contextThai: phraseVariant?.contextThai || null,
    contextTranslation: phraseVariant?.contextTranslation || "",
    targetWordTiming: phraseVariant?.targetWordTiming || null,
    audio,
    contour: word.contour || group.contour,
    sourceId: phraseVariant?.sourceId || word.sourceId || null
  };
}

function splitLessonId(id) {
  if (typeof id !== "string") {
    return [lessons[0].wordId, lessons[0].phraseVariantId];
  }

  const [wordId, phraseVariantId = null] = id.split(":");
  return [wordId, phraseVariantId];
}
