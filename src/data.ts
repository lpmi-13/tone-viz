import type {
  AudioMap,
  AudioSpeaker,
  ContextThai,
  Lesson,
  PhraseVariant,
  RegisterBand,
  SpeakerContextThaiMap,
  SpeakerWordTextMap,
  TargetWordTiming,
  ToneGroup,
  ToneId,
  ToneTemplateMap,
  Word,
  WordText
} from "./types.js";

export const registerBands: RegisterBand[] = [
  { id: "low", label: "low register", from: 0, to: 0.34 },
  { id: "mid", label: "mid register", from: 0.34, to: 0.66 },
  { id: "high", label: "high register", from: 0.66, to: 1 }
];

export const toneTemplates: ToneTemplateMap = {
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

export const audioSpeakers: AudioSpeaker[] = [
  {
    id: "premwadee",
    label: "Premwadee",
    voice: "th-TH-PremwadeeNeural",
    root: "/audio/generated/th-th-premwadee",
    gender: "female"
  },
  {
    id: "niwat",
    label: "Niwat",
    voice: "th-TH-NiwatNeural",
    root: "/audio/generated/th-th-niwat",
    gender: "male"
  }
];

export const defaultAudioSpeakerId = audioSpeakers[0].id;

const DEFAULT_AUDIO_ROOT = audioSpeakers[0].root;

function seedAudio(id: string): AudioMap {
  return {
    natural: `${DEFAULT_AUDIO_ROOT}/${id}-natural.mp3`,
    exaggerated: `${DEFAULT_AUDIO_ROOT}/${id}-slow.mp3`
  };
}

function seedPhraseAudio(id: string): AudioMap {
  return {
    phrase: `${DEFAULT_AUDIO_ROOT}/${id}-phrase.mp3`,
    phraseSlow: `${DEFAULT_AUDIO_ROOT}/${id}-phrase-slow.mp3`
  };
}

function generatedPhraseVariantAudio(id: string): AudioMap {
  return {
    natural: `${DEFAULT_AUDIO_ROOT}/${id}-natural.mp3`,
    exaggerated: `${DEFAULT_AUDIO_ROOT}/${id}-slow.mp3`,
    phrase: `${DEFAULT_AUDIO_ROOT}/${id}-phrase.mp3`,
    phraseSlow: `${DEFAULT_AUDIO_ROOT}/${id}-phrase-slow.mp3`
  };
}

type PhraseParts = [before: string, target: string, after: string];

interface PhraseOptions {
  targetWordTiming?: TargetWordTiming | null;
  audio?: AudioMap;
  sourceId?: string | null;
  speakerContexts?: SpeakerContextThaiMap;
}

function contextThai([before, target, after]: PhraseParts): ContextThai {
  return { before, target, after };
}

function speakerContextsByGender(femaleParts: PhraseParts, maleParts: PhraseParts): SpeakerContextThaiMap {
  const contexts: SpeakerContextThaiMap = {};

  for (const speaker of audioSpeakers) {
    contexts[speaker.id] = contextThai(speaker.gender === "male" ? maleParts : femaleParts);
  }

  return contexts;
}

function speakerWordTextByGender(femaleWord: WordText, maleWord: WordText): SpeakerWordTextMap {
  const words: SpeakerWordTextMap = {};

  for (const speaker of audioSpeakers) {
    words[speaker.id] = speaker.gender === "male" ? maleWord : femaleWord;
  }

  return words;
}

function phrase(
  id: string,
  before: string,
  target: string,
  after: string,
  contextTranslation: string,
  options: PhraseOptions = {}
): PhraseVariant {
  return {
    id,
    contextThai: { before, target, after },
    speakerContexts: options.speakerContexts || {},
    contextTranslation,
    targetWordTiming: options.targetWordTiming || null,
    audio: options.audio || {},
    sourceId: options.sourceId || null
  };
}

function genderedPhrase(
  id: string,
  femaleParts: PhraseParts,
  maleParts: PhraseParts,
  contextTranslation: string,
  options: PhraseOptions = {}
): PhraseVariant {
  return phrase(id, femaleParts[0], femaleParts[1], femaleParts[2], contextTranslation, {
    ...options,
    speakerContexts: {
      ...speakerContextsByGender(femaleParts, maleParts),
      ...(options.speakerContexts || {})
    }
  });
}

export const toneGroups: ToneGroup[] = [
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
          genderedPhrase("mid-kin-fish-question",
            ["คุณชอบ", "กิน", "ปลาไหมคะ"],
            ["คุณชอบ", "กิน", "ปลาไหมครับ"],
            "Do you like to eat fish?", {
            sourceId: "word-slice:th-m2-001"
          }),
          genderedPhrase("mid-kin-no-pork",
            ["ดิฉันไม่", "กิน", "หมูค่ะ"],
            ["ผมไม่", "กิน", "หมูครับ"],
            "I do not eat pork.", {
            sourceId: "word-slice:th-m2-003"
          }),
          genderedPhrase("mid-kin-spicy",
            ["คุณ", "กิน", "อาหารเผ็ดได้ไหมคะ"],
            ["คุณ", "กิน", "อาหารเผ็ดได้ไหมครับ"],
            "Can you eat spicy food?", {
            sourceId: "word-slice:th-m2-004"
          })
        ]
      },
      {
        id: "mid-pai",
        thai: "ไป",
        translation: "go",
        phraseVariants: [
          genderedPhrase("mid-pai-market",
            ["ดิฉัน", "ไป", "ตลาดได้ไหมคะ"],
            ["ผม", "ไป", "ตลาดได้ไหมครับ"],
            "May I go to the market?", {
            sourceId: "word-slice:th-d1-003"
          }),
          genderedPhrase("mid-pai-school",
            ["ดิฉันอยากจะ", "ไป", "โรงเรียนค่ะ"],
            ["ผมอยากจะ", "ไป", "โรงเรียนครับ"],
            "I want to go to school.", {
            sourceId: "word-slice:th-d1-004"
          }),
          genderedPhrase("mid-pai-hospital",
            ["ดิฉันอยากจะ", "ไป", "โรงพยาบาลค่ะ"],
            ["ผมอยากจะ", "ไป", "โรงพยาบาลครับ"],
            "I want to go to the hospital.", {
            sourceId: "word-slice:th-d1-005"
          })
        ]
      },
      {
        id: "mid-pla",
        thai: "ปลา",
        translation: "fish",
        phraseVariants: [
          genderedPhrase("mid-pla-like",
            ["คุณชอบกิน", "ปลา", "ไหมคะ"],
            ["คุณชอบกิน", "ปลา", "ไหมครับ"],
            "Do you like to eat fish?", {
            sourceId: "word-slice:th-m2-001"
          }),
          genderedPhrase("mid-pla-not-like",
            ["ดิฉันไม่ชอบกิน", "ปลา", "ค่ะ"],
            ["ผมไม่ชอบกิน", "ปลา", "ครับ"],
            "I do not like to eat fish.", {
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
          genderedPhrase("low-kai-grilled",
            ["ขอ", "ไก่", "ย่างสองชิ้นค่ะ"],
            ["ขอ", "ไก่", "ย่างสองชิ้นครับ"],
            "Can I have two pieces of grilled chicken?", {
            sourceId: "word-slice:th-m1-004"
          }),
          genderedPhrase("low-kai-fried",
            ["ดิฉันชอบกิน", "ไก่", "ทอดค่ะ"],
            ["ผมชอบกิน", "ไก่", "ทอดครับ"],
            "I like to eat fried chicken.", {
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
          genderedPhrase("falling-khao-eat",
            ["ดิฉันกิน", "ข้าว", "ค่ะ"],
            ["ผมกิน", "ข้าว", "ครับ"],
            "I eat rice.", {
            audio: seedPhraseAudio("falling-khao")
          }),
          phrase("falling-khao-pork", "", "ข้าว", "ผัดหมู", "Fried rice with pork.", {
            sourceId: "word-slice:th-e2-003"
          }),
          phrase("falling-khao-chicken", "", "ข้าว", "ผัดไก่", "Fried rice with chicken.", {
            sourceId: "word-slice:th-e2-004"
          }),
          genderedPhrase("falling-khao-shrimp",
            ["ขอ", "ข้าว", "ผัดกุ้งค่ะ"],
            ["ขอ", "ข้าว", "ผัดกุ้งครับ"],
            "Can I have shrimp fried rice?", {
            sourceId: "word-slice:th-m1-002"
          })
        ]
      },
      {
        id: "falling-mai",
        thai: "ไม่",
        translation: "not / no",
        phraseVariants: [
          genderedPhrase("falling-mai-okay",
            ["", "ไม่", "เป็นไรค่ะ"],
            ["", "ไม่", "เป็นไรครับ"],
            "It's okay / never mind.", {
            sourceId: "word-slice:th-e1-015"
          }),
          genderedPhrase("falling-mai-fish",
            ["ดิฉัน", "ไม่", "ชอบกินปลาค่ะ"],
            ["ผม", "ไม่", "ชอบกินปลาครับ"],
            "I do not like to eat fish.", {
            sourceId: "word-slice:th-m2-002"
          }),
          genderedPhrase("falling-mai-understand",
            ["ดิฉัน", "ไม่", "เข้าใจค่ะ"],
            ["ผม", "ไม่", "เข้าใจครับ"],
            "I do not understand.", {
            sourceId: "word-slice:th-d1-006"
          })
        ]
      },
      {
        id: "falling-mae",
        thai: "แม่",
        translation: "mother",
        phraseVariants: [
          genderedPhrase("falling-mae-age",
            ["", "แม่", "ของคุณอายุเท่าไรคะ"],
            ["", "แม่", "ของคุณอายุเท่าไรครับ"],
            "How old is your mother?", {
            sourceId: "word-slice:th-m2-010"
          }),
          genderedPhrase("falling-mae-my",
            ["", "แม่", "ของดิฉันอายุห้าสิบแปดปีค่ะ"],
            ["", "แม่", "ของผมอายุห้าสิบแปดปีครับ"],
            "My mother is fifty-eight years old.", {
            sourceId: "word-slice:th-m2-011"
          })
        ]
      },
      {
        id: "falling-chue",
        thai: "ชื่อ",
        translation: "name",
        phraseVariants: [
          genderedPhrase("falling-chue-wichai",
            ["ดิฉัน", "ชื่อ", "วิชัย"],
            ["ผม", "ชื่อ", "วิชัย"],
            "My name is Wichai.", {
            sourceId: "word-slice:th-e1-003"
          }),
          genderedPhrase("falling-chue-sunisa",
            ["ดิฉัน", "ชื่อ", "สุนิสา"],
            ["ผม", "ชื่อ", "สุนิสา"],
            "My name is Sunisa.", {
            sourceId: "word-slice:th-e1-004"
          }),
          genderedPhrase("falling-chue-question",
            ["คุณ", "ชื่อ", "อะไรคะ"],
            ["คุณ", "ชื่อ", "อะไรครับ"],
            "What is your name?", {
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
          genderedPhrase("high-nam-order",
            ["ขอ", "น้ำ", "เย็นหนึ่งขวดค่ะ"],
            ["ขอ", "น้ำ", "เย็นหนึ่งขวดครับ"],
            "Can I have one bottle of cold water?", {
            sourceId: "word-slice:th-m1-003"
          }),
          genderedPhrase("high-nam-kind",
            ["เอา", "น้ำ", "อะไรคะ"],
            ["เอา", "น้ำ", "อะไรครับ"],
            "What kind of drink do you want?", {
            sourceId: "word-slice:th-m1-012"
          })
        ]
      },
      {
        id: "high-sue",
        thai: "ซื้อ",
        translation: "buy",
        phraseVariants: [
          genderedPhrase("high-sue-things",
            ["ดิฉัน", "ซื้อ", "ของค่ะ"],
            ["ผม", "ซื้อ", "ของครับ"],
            "I buy things.", {
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
          genderedPhrase("rising-kho-rice",
            ["", "ขอ", "ข้าวผัดกุ้งค่ะ"],
            ["", "ขอ", "ข้าวผัดกุ้งครับ"],
            "Can I have shrimp fried rice?", {
            sourceId: "word-slice:th-m1-002"
          }),
          genderedPhrase("rising-kho-water",
            ["", "ขอ", "น้ำเย็นหนึ่งขวดค่ะ"],
            ["", "ขอ", "น้ำเย็นหนึ่งขวดครับ"],
            "Can I have one bottle of cold water?", {
            sourceId: "word-slice:th-m1-003"
          }),
          genderedPhrase("rising-kho-chicken",
            ["", "ขอ", "ไก่ย่างสองชิ้นค่ะ"],
            ["", "ขอ", "ไก่ย่างสองชิ้นครับ"],
            "Can I have two pieces of grilled chicken?", {
            sourceId: "word-slice:th-m1-004"
          })
        ]
      },
      {
        id: "rising-phom",
        thai: "ผม",
        translation: "I (male)",
        speakerWords: speakerWordTextByGender(
          { thai: "ฉัน", translation: "I (female)" },
          { thai: "ผม", translation: "I (male)" }
        ),
        phraseVariants: [
          genderedPhrase("rising-phom-name",
            ["ดิ", "ฉัน", "ชื่อวิชัย"],
            ["", "ผม", "ชื่อวิชัย"],
            "My name is Wichai.", {
            sourceId: "word-slice:th-e1-003"
          }),
          genderedPhrase("rising-phom-fine",
            ["ดิ", "ฉัน", "สบายดีค่ะ"],
            ["", "ผม", "สบายดีครับ"],
            "I am fine.", {
            sourceId: "word-slice:th-e1-010"
          }),
          genderedPhrase("rising-phom-fish",
            ["ดิ", "ฉัน", "ไม่ชอบกินปลาค่ะ"],
            ["", "ผม", "ไม่ชอบกินปลาครับ"],
            "I do not like to eat fish.", {
            sourceId: "word-slice:th-m2-002"
          })
        ]
      },
      {
        id: "rising-mai",
        thai: "ไหม",
        translation: "question particle",
        phraseVariants: [
          genderedPhrase("rising-mai-fine",
            ["คุณสบายดี", "ไหม", "คะ"],
            ["คุณสบายดี", "ไหม", "ครับ"],
            "How are you?", {
            sourceId: "word-slice:th-e1-011"
          }),
          genderedPhrase("rising-mai-fish",
            ["คุณชอบกินปลา", "ไหม", "คะ"],
            ["คุณชอบกินปลา", "ไหม", "ครับ"],
            "Do you like to eat fish?", {
            sourceId: "word-slice:th-m2-001"
          }),
          genderedPhrase("rising-mai-market",
            ["ดิฉันไปตลาดได้", "ไหม", "คะ"],
            ["ผมไปตลาดได้", "ไหม", "ครับ"],
            "May I go to the market?", {
            sourceId: "word-slice:th-d1-003"
          })
        ]
      }
    ]
  }
];

export const lessons: Lesson[] = toneGroups.flatMap((group) =>
  group.words.map((word) => normalizeLesson(group, word, word.phraseVariants[0] || null))
);

export const quizLessons: Lesson[] = toneGroups.flatMap((group) =>
  group.words.flatMap((word) => {
    const variants = word.phraseVariants.length ? word.phraseVariants : [null];
    return variants.map((variant) => normalizeLesson(group, word, variant));
  })
);

export function getQuizLessonsForSpeaker(speakerId: string): Lesson[] {
  return toneGroups.flatMap((group) =>
    group.words.flatMap((word) => {
      const variants = word.phraseVariants.length ? word.phraseVariants : [null];
      return variants.map((variant) => normalizeLesson(group, word, variant, speakerId));
    })
  );
}

export const defaultSelection: { toneId: ToneId; wordId: string; phraseVariantId: string | null } = {
  toneId: toneGroups[0].id,
  wordId: toneGroups[0].words[0].id,
  phraseVariantId: toneGroups[0].words[0].phraseVariants[0]?.id || null
};

export function getToneGroupById(id: string): ToneGroup {
  return toneGroups.find((group) => group.id === id) || toneGroups[0];
}

export function getWordById(toneId: string, wordId: string): Word {
  const group = getToneGroupById(toneId);
  return group.words.find((word) => word.id === wordId) || group.words[0];
}

export function getPhraseVariantById(word: Word | null | undefined, phraseVariantId: string | null): PhraseVariant | null {
  if (!word?.phraseVariants?.length) {
    return null;
  }

  return word.phraseVariants.find((variant) => variant.id === phraseVariantId) || word.phraseVariants[0];
}

export function getWordTextForSpeaker(word: Word, speakerId = defaultAudioSpeakerId): WordText {
  return word.speakerWords?.[speakerId] || word;
}

export function getLessonSelection(toneId: string, wordId: string, phraseVariantId: string | null, speakerId = defaultAudioSpeakerId): Lesson {
  const group = getToneGroupById(toneId);
  const word = getWordById(group.id, wordId);
  const phraseVariant = getPhraseVariantById(word, phraseVariantId);
  return normalizeLesson(group, word, phraseVariant, speakerId);
}

export function getLessonById(id: unknown, speakerId = defaultAudioSpeakerId): Lesson {
  const [wordId, phraseVariantId] = splitLessonId(id);

  for (const group of toneGroups) {
    const word = group.words.find((candidate) => candidate.id === wordId);
    if (word) {
      return normalizeLesson(group, word, getPhraseVariantById(word, phraseVariantId), speakerId);
    }
  }

  return lessons[0];
}

export function getQuizLessonById(id: string, speakerId = defaultAudioSpeakerId): Lesson {
  const [wordId, phraseVariantId] = splitLessonId(id);

  for (const group of toneGroups) {
    const word = group.words.find((candidate) => candidate.id === wordId);
    if (word) {
      return normalizeLesson(group, word, getPhraseVariantById(word, phraseVariantId), speakerId);
    }
  }

  return quizLessons[0];
}

function normalizeLesson(group: ToneGroup, word: Word, phraseVariant: PhraseVariant | null, speakerId = defaultAudioSpeakerId): Lesson {
  const wordText = getWordTextForSpeaker(word, speakerId);
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
    thai: wordText.thai,
    translation: wordText.translation,
    wordId: word.id,
    phraseVariantId: phraseVariant?.id || null,
    phraseVariantIndex: phraseIndex,
    phraseVariantCount: word.phraseVariants.length,
    contextThai: resolvePhraseContextThai(phraseVariant, speakerId),
    contextTranslation: phraseVariant?.contextTranslation || "",
    targetWordTiming: phraseVariant?.targetWordTiming || null,
    audio,
    contour: word.contour || group.contour,
    sourceId: phraseVariant?.sourceId || word.sourceId || null
  };
}

function resolvePhraseContextThai(phraseVariant: PhraseVariant | null, speakerId: string): ContextThai | null {
  if (!phraseVariant) {
    return null;
  }

  return phraseVariant.speakerContexts[speakerId] || phraseVariant.contextThai;
}

function splitLessonId(id: unknown): [string, string | null] {
  if (typeof id !== "string") {
    return [lessons[0].wordId, lessons[0].phraseVariantId];
  }

  const [wordId, phraseVariantId = null] = id.split(":");
  return [wordId, phraseVariantId];
}
