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
    diagnoses: {
      russian: {
        headline: "RUSSIAN L1 DETECTED",
        subhead: "Palatalization on /zh/",
        detail: "Your /ш/ is leaking through. Russian palatalizes where Mandarin retroflexes.",
        citation: "Chen et al. · Interspeech 2013",
        triggerPhoneme: "ʈʂ",
      },
      uzbek: {
        headline: "UZBEK L1 DETECTED",
        subhead: "Vowel /ü/ rounding incomplete",
        detail: "Uzbek vowel inventory lacks the front-rounded /y/ contrast. Round your lips harder.",
        citation: "Chinese–Uzbek contrastive · IJEAT 2019",
        triggerPhoneme: "y",
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
    diagnoses: {
      russian: {
        headline: "RUSSIAN L1 DETECTED",
        subhead: "Tone 3 → Tone 2 sandhi missed",
        detail: "Russian intonation flattens consecutive tone 3s. The first nǐ must rise like tone 2.",
        citation: "Soloveva · Phonetica 2020",
        triggerPhoneme: "i",
      },
      uzbek: {
        headline: "UZBEK L1 DETECTED",
        subhead: "Aspiration on /j/ underweighted",
        detail: "Uzbek /j/ in jiào needs harder aspiration. Push more air through the alveolo-palatal.",
        citation: "Karimov · TKLT 2018",
        triggerPhoneme: "tɕ",
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
    diagnoses: {
      russian: {
        headline: "RUSSIAN L1 DETECTED",
        subhead: "/ü/ collapsed to /u/",
        detail: "Russian /у/ pulls lǜ toward /lu/. Front the tongue, keep lips rounded — two motions.",
        citation: "Zhang · L2 Speech 2020",
        triggerPhoneme: "y",
      },
      uzbek: {
        headline: "UZBEK L1 DETECTED",
        subhead: "Retroflex /sh/ devoiced too early",
        detail: "Uzbek /sh/ is flatter. Curl the tongue, hold voicing through the consonant.",
        citation: "Akhmedova · IJAS 2021",
        triggerPhoneme: "ʂ",
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
 * Short reference sentences in each L1.
 * Recorded by the on-stage user to seed the ElevenLabs Instant Voice Clone
 * with pure timbre, untainted by Mandarin attempts.
 */
export const REFERENCE_SCRIPTS: Record<L1, string> = {
  russian:
    "Меня зовут [имя]. Я говорю по-русски каждый день. Сегодня я учусь произносить китайские слова правильно.",
  uzbek:
    "Mening ismim [ismingiz]. Men har kuni o'zbek tilida gapiraman. Bugun men xitoy tilini aniq talaffuz qilishni o'rganaman.",
};
