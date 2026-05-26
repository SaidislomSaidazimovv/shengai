import { pinyin } from "pinyin-pro";

/**
 * Hanzi → pinyin conversion helper for the custom-sentence pipeline.
 *
 * pinyin-pro runs entirely client-side and ships a comprehensive
 * Mandarin dictionary, including polyphone disambiguation. Using it
 * keeps pinyin out of the LLM call: /api/translate only needs to
 * produce hanzi + IPA + diagnosis, and the pinyin string is derived
 * locally in microseconds instead of waiting on Gemini/OpenAI to
 * generate it character-by-character. That shaves ~30 % off the
 * per-sentence latency budget.
 */

export interface PinyinResult {
  /** Space-separated pinyin string with tone marks ("wǒ xǐhuan xué zhōngwén"). */
  pinyin: string;
  /** Per-hanzi pinyin syllables (one entry per Mandarin character). */
  syllables: string[];
}

/**
 * Convert Mandarin hanzi to pinyin + per-character syllables.
 *
 * Punctuation and non-Mandarin characters are stripped so the
 * downstream syllables array lines up with the cleaned hanzi string
 * one-to-one. Callers that need to keep punctuation should strip it
 * from the hanzi BEFORE passing it here.
 */
export function hanziToPinyin(hanzi: string): PinyinResult {
  const syllables = pinyin(hanzi, {
    type: "array",
    toneType: "symbol",
    // Drop non-hanzi (punctuation, Latin letters) so the array length
    // matches the hanzi count.
    nonZh: "removed",
  });
  return {
    pinyin: syllables.join(" "),
    syllables,
  };
}
