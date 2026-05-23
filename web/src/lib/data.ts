/**
 * Static lesson and pinyin data. In production this would come from a CMS;
 * for the hackathon it lives in source so the app works offline.
 */

export type Tone = 1 | 2 | 3 | 4 | 5;

export interface SyllableCard {
  pinyin: string;
  tone: Tone;
  hanzi: string;
  meaning: string;
  /** Phonetic guidance for an Uzbek/Russian speaker. */
  hint: string;
}

export interface Sentence {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning_en: string;
  meaning_uz: string;
  syllables: SyllableCard[];
  level: "HSK1" | "HSK2" | "HSK3";
}

export const DIAGNOSTIC_SET: SyllableCard[] = [
  { pinyin: "nǐ", tone: 3, hanzi: "你", meaning: "you", hint: "Dipping tone — pitch falls then rises." },
  { pinyin: "hǎo", tone: 3, hanzi: "好", meaning: "good", hint: "Same dipping shape as nǐ." },
  { pinyin: "mā", tone: 1, hanzi: "妈", meaning: "mother", hint: "Hold a steady high pitch." },
  { pinyin: "má", tone: 2, hanzi: "麻", meaning: "hemp", hint: "Rise from mid to high." },
  { pinyin: "mà", tone: 4, hanzi: "骂", meaning: "scold", hint: "Sharp fall from high to low." },
];

export const SENTENCES: Sentence[] = [
  {
    id: "s1",
    hanzi: "你好，我叫李明。",
    pinyin: "nǐ hǎo, wǒ jiào lǐ míng.",
    meaning_en: "Hello, my name is Li Ming.",
    meaning_uz: "Salom, mening ismim Li Ming.",
    level: "HSK1",
    syllables: [
      { pinyin: "nǐ", tone: 3, hanzi: "你", meaning: "you", hint: "Dipping." },
      { pinyin: "hǎo", tone: 3, hanzi: "好", meaning: "good", hint: "Dipping; in 'nǐ hǎo' the first tone-3 shifts toward tone-2 (sandhi)." },
      { pinyin: "wǒ", tone: 3, hanzi: "我", meaning: "I", hint: "Dipping." },
      { pinyin: "jiào", tone: 4, hanzi: "叫", meaning: "to be called", hint: "Falling." },
      { pinyin: "lǐ", tone: 3, hanzi: "李", meaning: "Li (surname)", hint: "Dipping." },
      { pinyin: "míng", tone: 2, hanzi: "明", meaning: "bright", hint: "Rising." },
    ],
  },
  {
    id: "s2",
    hanzi: "今天天气很好。",
    pinyin: "jīn tiān tiān qì hěn hǎo.",
    meaning_en: "The weather is great today.",
    meaning_uz: "Bugun havo juda yaxshi.",
    level: "HSK1",
    syllables: [
      { pinyin: "jīn", tone: 1, hanzi: "今", meaning: "present", hint: "Hold high." },
      { pinyin: "tiān", tone: 1, hanzi: "天", meaning: "day / sky", hint: "Hold high." },
      { pinyin: "tiān", tone: 1, hanzi: "天", meaning: "day / sky", hint: "Same as above." },
      { pinyin: "qì", tone: 4, hanzi: "气", meaning: "air", hint: "Sharp falling." },
      { pinyin: "hěn", tone: 3, hanzi: "很", meaning: "very", hint: "Dipping." },
      { pinyin: "hǎo", tone: 3, hanzi: "好", meaning: "good", hint: "Tone-3 sandhi: when two tone-3s meet, first becomes tone-2." },
    ],
  },
  {
    id: "s3",
    hanzi: "我喜欢学习中文。",
    pinyin: "wǒ xǐ huān xué xí zhōng wén.",
    meaning_en: "I enjoy studying Chinese.",
    meaning_uz: "Men xitoy tilini o'rganishni yaxshi ko'raman.",
    level: "HSK2",
    syllables: [
      { pinyin: "wǒ", tone: 3, hanzi: "我", meaning: "I", hint: "Dipping." },
      { pinyin: "xǐ", tone: 3, hanzi: "喜", meaning: "like", hint: "Dipping." },
      { pinyin: "huān", tone: 1, hanzi: "欢", meaning: "joy", hint: "High level." },
      { pinyin: "xué", tone: 2, hanzi: "学", meaning: "study", hint: "Rising." },
      { pinyin: "xí", tone: 2, hanzi: "习", meaning: "practice", hint: "Rising." },
      { pinyin: "zhōng", tone: 1, hanzi: "中", meaning: "middle", hint: "High level. Distinguish zh- (retroflex) from z-." },
      { pinyin: "wén", tone: 2, hanzi: "文", meaning: "language", hint: "Rising." },
    ],
  },
];

/* ----- Pinyin chart data (initials × finals) ----- */

export const INITIALS = [
  "b", "p", "m", "f",
  "d", "t", "n", "l",
  "g", "k", "h",
  "j", "q", "x",
  "zh", "ch", "sh", "r",
  "z", "c", "s",
];

export const FINALS = [
  "a", "o", "e", "i", "u", "ü",
  "ai", "ei", "ao", "ou",
  "an", "en", "ang", "eng", "ong",
  "ia", "ie", "iao", "iu",
  "ian", "in", "iang", "ing", "iong",
  "ua", "uo", "uai", "ui",
  "uan", "un", "uang", "ueng",
  "üe", "üan", "ün",
  "er", "yi", "wu",
];

/**
 * Which (initial, final) combinations are phonotactically valid in Mandarin.
 * For the demo we mark the most common combos; the chart greys out the rest.
 */
const VALID_COMBOS = new Set<string>([
  "b|a", "b|o", "b|ai", "b|ei", "b|ao", "b|an", "b|en", "b|ang", "b|eng", "b|i", "b|ie", "b|iao", "b|ian", "b|in", "b|ing", "b|u",
  "p|a", "p|o", "p|ai", "p|ei", "p|ao", "p|ou", "p|an", "p|en", "p|ang", "p|eng", "p|i", "p|ie", "p|iao", "p|ian", "p|in", "p|ing", "p|u",
  "m|a", "m|o", "m|e", "m|ai", "m|ei", "m|ao", "m|ou", "m|an", "m|en", "m|ang", "m|eng", "m|i", "m|ie", "m|iao", "m|iu", "m|ian", "m|in", "m|ing", "m|u",
  "f|a", "f|o", "f|ei", "f|ou", "f|an", "f|en", "f|ang", "f|eng", "f|u",
  "d|a", "d|e", "d|ai", "d|ei", "d|ao", "d|ou", "d|an", "d|en", "d|ang", "d|eng", "d|ong", "d|i", "d|ie", "d|iao", "d|iu", "d|ian", "d|ing", "d|u", "d|uo", "d|ui", "d|uan", "d|un",
  "t|a", "t|e", "t|ai", "t|ao", "t|ou", "t|an", "t|ang", "t|eng", "t|ong", "t|i", "t|ie", "t|iao", "t|ian", "t|ing", "t|u", "t|uo", "t|ui", "t|uan", "t|un",
  "n|a", "n|e", "n|ai", "n|ei", "n|ao", "n|ou", "n|an", "n|en", "n|ang", "n|eng", "n|ong", "n|i", "n|ie", "n|iao", "n|iu", "n|ian", "n|in", "n|iang", "n|ing", "n|u", "n|uo", "n|uan", "n|ü", "n|üe",
  "l|a", "l|o", "l|e", "l|ai", "l|ei", "l|ao", "l|ou", "l|an", "l|ang", "l|eng", "l|ong", "l|i", "l|ia", "l|ie", "l|iao", "l|iu", "l|ian", "l|in", "l|iang", "l|ing", "l|u", "l|uo", "l|uan", "l|un", "l|ü", "l|üe",
  "g|a", "g|e", "g|ai", "g|ei", "g|ao", "g|ou", "g|an", "g|en", "g|ang", "g|eng", "g|ong", "g|u", "g|ua", "g|uo", "g|uai", "g|ui", "g|uan", "g|un", "g|uang",
  "k|a", "k|e", "k|ai", "k|ao", "k|ou", "k|an", "k|en", "k|ang", "k|eng", "k|ong", "k|u", "k|ua", "k|uo", "k|uai", "k|ui", "k|uan", "k|un", "k|uang",
  "h|a", "h|e", "h|ai", "h|ei", "h|ao", "h|ou", "h|an", "h|en", "h|ang", "h|eng", "h|ong", "h|u", "h|ua", "h|uo", "h|uai", "h|ui", "h|uan", "h|un", "h|uang",
  "j|i", "j|ia", "j|ie", "j|iao", "j|iu", "j|ian", "j|in", "j|iang", "j|ing", "j|iong", "j|ü", "j|üe", "j|üan", "j|ün",
  "q|i", "q|ia", "q|ie", "q|iao", "q|iu", "q|ian", "q|in", "q|iang", "q|ing", "q|iong", "q|ü", "q|üe", "q|üan", "q|ün",
  "x|i", "x|ia", "x|ie", "x|iao", "x|iu", "x|ian", "x|in", "x|iang", "x|ing", "x|iong", "x|ü", "x|üe", "x|üan", "x|ün",
  "zh|a", "zh|e", "zh|ai", "zh|ei", "zh|ao", "zh|ou", "zh|an", "zh|en", "zh|ang", "zh|eng", "zh|ong", "zh|i", "zh|u", "zh|ua", "zh|uo", "zh|uai", "zh|ui", "zh|uan", "zh|un", "zh|uang",
  "ch|a", "ch|e", "ch|ai", "ch|ao", "ch|ou", "ch|an", "ch|en", "ch|ang", "ch|eng", "ch|ong", "ch|i", "ch|u", "ch|ua", "ch|uo", "ch|uai", "ch|ui", "ch|uan", "ch|un", "ch|uang",
  "sh|a", "sh|e", "sh|ai", "sh|ei", "sh|ao", "sh|ou", "sh|an", "sh|en", "sh|ang", "sh|eng", "sh|i", "sh|u", "sh|ua", "sh|uo", "sh|uai", "sh|ui", "sh|uan", "sh|un", "sh|uang",
  "r|e", "r|ao", "r|ou", "r|an", "r|en", "r|ang", "r|eng", "r|ong", "r|i", "r|u", "r|uo", "r|ui", "r|uan", "r|un",
  "z|a", "z|e", "z|ai", "z|ei", "z|ao", "z|ou", "z|an", "z|en", "z|ang", "z|eng", "z|ong", "z|i", "z|u", "z|uo", "z|ui", "z|uan", "z|un",
  "c|a", "c|e", "c|ai", "c|ao", "c|ou", "c|an", "c|en", "c|ang", "c|eng", "c|ong", "c|i", "c|u", "c|uo", "c|ui", "c|uan", "c|un",
  "s|a", "s|e", "s|ai", "s|ao", "s|ou", "s|an", "s|en", "s|ang", "s|eng", "s|ong", "s|i", "s|u", "s|uo", "s|ui", "s|uan", "s|un",
]);

export function isValidPinyin(initial: string, final: string): boolean {
  return VALID_COMBOS.has(`${initial}|${final}`);
}

/** Build a displayable syllable from initial + final (with tone marks omitted). */
export function buildSyllable(initial: string, final: string): string {
  // Special cases: i, u, ü standalone don't take initial prefix
  if (final === "er") return "er";
  return `${initial}${final}`;
}

/* ----- Tone names ----- */

export const TONE_NAMES: Record<Tone, string> = {
  1: "High level",
  2: "Rising",
  3: "Dipping",
  4: "Falling",
  5: "Neutral",
};

export const TONE_MARKS: Record<Tone, string> = {
  1: "ā",
  2: "á",
  3: "ǎ",
  4: "à",
  5: "a",
};
