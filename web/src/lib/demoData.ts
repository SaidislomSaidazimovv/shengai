/**
 * Demo sentences + hardcoded L1 -> diagnosis mapping.
 *
 * Per the dev handover §5 ("The L1 Detection Cheat"): the phoneme MDD
 * genuinely runs, but the L1 label and the diagnosis copy are picked from
 * this table based on (a) the language the user manually picked and
 * (b) which demo sentence they read.
 *
 * We pick the trigger phoneme that the MDD will *plausibly* flag, so the
 * illusion holds: real signal, scripted interpretation.
 */

export type L1 = "russian" | "uzbek";

export interface Diagnosis {
  headline: string;
  subhead: string;
  /** Short, punchy explanation in the deck's voice. */
  detail: string;
  /** Tiny research citation in the corner (per the unforgettable card). */
  citation: string;
  /** The phoneme we expect the MDD to flag — guides the demo. */
  triggerPhoneme: string;
  /**
   * Mirror DevHandover v02 §6.5 phoneme shift box — expected (target)
   * IPA versus what the user actually produced. Renders as a small
   * inset card "expected → detected" beneath the headline.
   */
  phonemeShift: { expected: string; detected: string };
  /**
   * v02 §6.5 pattern counter ("Pattern 7 of 11 known Russian L1 →
   * Mandarin error families"). Total varies by L1.
   */
  patternNumber: number;
  patternTotal: number;
}

export interface DemoSentence {
  id: string;
  hanzi: string;
  pinyin: string;
  translation: string;
  /** IPA phonemes the MDD model produces — used as the visible grid during ANALYZING. */
  expectedPhonemes: string[];
  /**
   * For each hanzi character, the starting index in `expectedPhonemes`.
   * Used to map an ASR character-level mismatch to the prominent phoneme
   * we highlight on the analyzing grid.
   */
  charPhonemeIdx: number[];
  /**
   * Per-character pinyin syllables (toneless ASCII OK, but tones look
   * better). Drives the §6.4 ANALYZING tile grid — one tile per
   * syllable. Order matches `hanzi` characters.
   */
  syllables: string[];
  diagnoses: Record<L1, Diagnosis>;
}

export const DEMO_SENTENCES: DemoSentence[] = [
  {
    id: "wo_xi_huan_xue_zhong_wen",
    hanzi: "我喜欢学中文",
    pinyin: "wǒ xǐhuan xué zhōngwén",
    translation: "I like learning Chinese.",
    expectedPhonemes: ["w", "ɔ", "ɕ", "i", "x", "u", "an", "ɕ", "y", "e", "ʈʂ", "ʊ", "ŋ", "w", "ə", "n"],
    charPhonemeIdx: [0, 2, 4, 7, 10, 13],
    syllables: ["wǒ", "xǐ", "huan", "xué", "zhōng", "wén"],
    diagnoses: {
      russian: {
        headline: "RUSSIAN L1 DETECTED",
        // IPA throughout the diagnosis. The user flagged that the
        // earlier mix of pinyin (/zh/), Cyrillic (/ш/) and IPA (/ʈʂ/)
        // looked like four different sounds inside one card. Now the
        // subhead, the detail and the phoneme-shift box all reference
        // the same /ʈʂ/ → /ʐʲ/ pair, with the triggerPhoneme matching.
        subhead: "Retroflex /ʈʂ/ palatalised",
        detail:
          "Russian palatalises retroflexes — /ʐʲ/ replaces Mandarin /ʈʂ/. " +
          "Curl the tongue tip back without fronting it.",
        citation: "Chen et al. · Interspeech 2013",
        triggerPhoneme: "ʈʂ",
        phonemeShift: { expected: "ʈʂ", detected: "ʐʲ" },
        patternNumber: 7,
        patternTotal: 11,
      },
      uzbek: {
        headline: "UZBEK L1 DETECTED",
        subhead: "Front-rounded /y/ not produced",
        detail:
          "Uzbek vowels lack /y/ (front + rounded). Hold the tongue " +
          "forward as for /i/, then round the lips into a tight /u/.",
        citation: "Chinese–Uzbek contrastive · IJEAT 2019",
        triggerPhoneme: "y",
        phonemeShift: { expected: "y", detected: "u" },
        patternNumber: 4,
        patternTotal: 9,
      },
    },
  },
  {
    id: "ni_hao_wo_jiao",
    hanzi: "你好，我叫李明",
    pinyin: "nǐ hǎo, wǒ jiào lǐ míng",
    translation: "Hello, my name is Li Ming.",
    expectedPhonemes: ["n", "i", "x", "au", "w", "ɔ", "tɕ", "i", "au", "l", "i", "m", "i", "ŋ"],
    // Note: comma in hanzi is filtered by findFirstMismatch, so character
    // indices effectively are: 你=0, 好=1, 我=2, 叫=3, 李=4, 明=5.
    charPhonemeIdx: [0, 2, 4, 6, 9, 11],
    syllables: ["nǐ", "hǎo", "wǒ", "jiào", "lǐ", "míng"],
    diagnoses: {
      russian: {
        // Earlier we framed this as a tone-sandhi issue, but tone
        // notation in the shift box (T3+T3 → T2+T3) clashed visually
        // with the IPA-based subhead and detail. For the production
        // card we switch to the segmental /tɕ/ palatalisation, which
        // Russians produce reliably on alveolo-palatal Mandarin
        // consonants and which keeps all four card surfaces using
        // the same IPA notation.
        headline: "RUSSIAN L1 DETECTED",
        subhead: "Alveolo-palatal /tɕ/ over-palatalised",
        detail:
          "Russian /tɕʲ/ fronts the tongue too much. Mandarin /tɕ/ needs " +
          "a broader blade-against-palate contact, with the tongue tip down.",
        citation: "Soloveva · Phonetica 2020",
        triggerPhoneme: "tɕ",
        phonemeShift: { expected: "tɕ", detected: "tɕʲ" },
        patternNumber: 2,
        patternTotal: 11,
      },
      uzbek: {
        headline: "UZBEK L1 DETECTED",
        subhead: "Alveolo-palatal /tɕ/ flattened to /tʃ/",
        detail:
          "Uzbek /tʃ/ is a plain affricate. Mandarin /tɕ/ uses the tongue " +
          "blade against the soft palate with a subtle aspirated puff.",
        citation: "Karimov · TKLT 2018",
        triggerPhoneme: "tɕ",
        phonemeShift: { expected: "tɕ", detected: "tʃ" },
        patternNumber: 3,
        patternTotal: 9,
      },
    },
  },
  {
    id: "zhe_shi_yi_ge_yusan",
    hanzi: "这是一个绿色的雨伞",
    pinyin: "zhè shì yí gè lǜsè de yǔsǎn",
    translation: "This is a green umbrella.",
    expectedPhonemes: ["ʈʂ", "ɤ", "ʂ", "ɻ", "i", "k", "ɤ", "l", "y", "s", "ɤ", "t", "ɤ", "y", "s", "an"],
    // 这=0, 是=2, 一=4 ([i] alone), 个=5, 绿=7, 色=9, 的=11, 雨=13, 伞=14.
    charPhonemeIdx: [0, 2, 4, 5, 7, 9, 11, 13, 14],
    syllables: ["zhè", "shì", "yí", "gè", "lǜ", "sè", "de", "yǔ", "sǎn"],
    diagnoses: {
      russian: {
        headline: "RUSSIAN L1 DETECTED",
        // Scripted shift used to claim /y/ → /i/, but the L1
        // substitution map (and the literature) actually pairs /y/
        // with /u/ for Russian speakers. We now agree with the L1
        // map so the dynamic and the fallback paths produce the
        // same answer.
        subhead: "Front-rounded /y/ collapsed to /u/",
        detail:
          "Russian /u/ is back-rounded. Mandarin /y/ asks for the tongue " +
          "forward (as in /i/) AND the lips rounded — two motions at once.",
        citation: "Zhang · L2 Speech 2020",
        triggerPhoneme: "y",
        phonemeShift: { expected: "y", detected: "u" },
        patternNumber: 8,
        patternTotal: 11,
      },
      uzbek: {
        // Earlier the trigger phoneme (/ʂ/) and the shift box's
        // expected (/ʈʂ/) referenced two different sounds. Aligning
        // both to /ʈʂ/ — the retroflex that Uzbek speakers flatten
        // to /ʂ/ on 这 — keeps the card internally honest.
        headline: "UZBEK L1 DETECTED",
        subhead: "Retroflex /ʈʂ/ flattened to /ʂ/",
        detail:
          "Uzbek /ʃ/ doesn't curl back. Mandarin /ʈʂ/ needs the tongue tip " +
          "raised toward the palate, with voicing held through the affricate.",
        citation: "Akhmedova · IJAS 2021",
        triggerPhoneme: "ʈʂ",
        phonemeShift: { expected: "ʈʂ", detected: "ʂ" },
        patternNumber: 6,
        patternTotal: 9,
      },
    },
  },
];

export function getDemoSentence(id: string): DemoSentence | undefined {
  return DEMO_SENTENCES.find((s) => s.id === id);
}

export const L1_LABELS: Record<L1, { code: string; name: string; nativeName: string }> = {
  russian: { code: "RU", name: "Russian", nativeName: "Русский" },
  uzbek: { code: "UZ", name: "Uzbek", nativeName: "O'zbek" },
};

/**
 * L1-specific phoneme substitution map.
 *
 * For each known Mandarin target phoneme, what a native speaker of
 * `l1` typically produces instead. The Diagnosis card uses this to
 * render the "expected → detected" box dynamically based on the
 * real triggered phoneme (from char-diff ASR), not the hardcoded
 * sentence-level shift. Grounded in the same phonetic literature
 * we cite on the card.
 *
 * If a triggered phoneme is missing from this table, the card just
 * shows the target by itself.
 */
export const L1_PHONEME_SUBSTITUTIONS: Record<L1, Record<string, string>> = {
  russian: {
    "ʈʂ": "ʐʲ",       // retroflex zh palatalized
    "ʂ":  "ʂʲ",       // retroflex sh palatalized
    "tɕ": "tɕʲ",      // alveolo-palatal j slightly fronted
    "ɕ":  "sʲ",       // alveolo-palatal x → softened s
    "y":  "u",        // ü → u (no front-rounded)
    "ɤ":  "o",        // back-mid unrounded → o
    "ɻ":  "r",        // approximant r → Russian r
    "ŋ":  "n",        // velar nasal flattened
    "au": "a",        // diphthong simplified
  },
  uzbek: {
    "y":  "u",        // ü → u (vowel inventory gap)
    "ʈʂ": "ʂ",        // retroflex zh flattened to sh
    "ʂ":  "ʃ",        // retroflex sh → plain sh
    "tɕ": "tʃ",       // alveolo-palatal j → ch
    "ɕ":  "ʃ",        // alveolo-palatal x → sh
    "ɤ":  "o",        // back-mid → o
    "ɻ":  "r",        // approximant → r
    "ŋ":  "ng",       // velar nasal → ng cluster
  },
};

/**
 * Short reference sentences in each L1, taken verbatim from Mirror
 * DevHandover v02 §6.1. Logistics + Chinese-partner framing matches
 * §12 revenue narrative (B2B ВЭД teams trading with China). Recorded
 * by the on-stage user to seed the ElevenLabs Instant Voice Clone
 * with pure timbre, untainted by Mandarin attempts.
 */
export const REFERENCE_SCRIPTS: Record<L1, string> = {
  russian:
    "Меня зовут Акмаль. Я живу в Ташкенте и работаю в логистике. Каждый день я работаю с китайскими партнёрами.",
  uzbek:
    "Mening ismim Akmal. Men Toshkentda yashayman va logistika sohasida ishlayman. Har kuni men xitoylik hamkorlar bilan ishlayman.",
};
