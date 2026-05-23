/**
 * Template-based feedback used as a fallback when the Gemini-powered
 * explainer is unavailable. Keeps the UX usable offline.
 */

import type { Lang } from "./api";
import { TONE_NAMES } from "./data";

interface FeedbackInput {
  pinyin: string;
  intendedTone: number;
  detectedTone: number;
  toneScore: number;
  initialScore: number;
  finalScore: number;
  lang: Lang;
}

const COPY: Record<Lang, {
  intro: (p: string) => string;
  tonePerfect: string;
  toneWrong: (intended: string, got: string) => string;
  toneWeak: (intended: string) => string;
  initialWeak: string;
  finalWeak: string;
  closingGreat: string;
  closingPractice: string;
}> = {
  uz: {
    intro: (p) => `«${p}» bo'g'inini tahlil qildim.`,
    tonePerfect: "Ton aniq va to'g'ri — ajoyib! Ovozingiz egri chizig'i namunaga juda mos.",
    toneWrong: (intended, got) =>
      `Siz ${got}-tonga o'xshatib aytdingiz, lekin kerakli ton — ${intended}-ton (${TONE_NAMES[Number(intended.split("-")[0]) as 1 | 2 | 3 | 4 | 5] ?? ""}). Pitch egri chizig'iga qarang va shaklini takrorlashga harakat qiling.`,
    toneWeak: (intended) =>
      `Ton ${intended}-ton shaklini olmoqda, lekin biroz suzuq. Ovozni aniqroq ko'taring/tushiring — egri chiziq tikroq bo'lsin.`,
    initialWeak: "Bosh tovush (initial) noaniq chiqdi. Tilingiz va lablaringiz holatiga e'tibor bering. Masalan, sh va s da til qayerda turishini farqlang.",
    finalWeak: "Oxirgi tovush (final) qisqa yoki noaniq. Unli tovushni to'liq cho'zib aytishga harakat qiling.",
    closingGreat: "Yaxshi ish! Bir nechta marta takrorlasangiz, mukammal bo'ladi.",
    closingPractice: "Yana ikki-uch marta qaytarib ko'ring — ohang aniqlashib boradi.",
  },
  ru: {
    intro: (p) => `Я проанализировал слог «${p}».`,
    tonePerfect: "Тон чёткий и правильный — отлично! Кривая высоты звука почти совпадает с эталоном.",
    toneWrong: (intended, got) =>
      `Вы произнесли как ${got}-й тон, но нужно ${intended}-й тон. Посмотрите на кривую и повторите форму.`,
    toneWeak: (intended) =>
      `Форма ${intended}-го тона угадывается, но слабо. Сделайте подъём или падение более резким.`,
    initialWeak: "Начальный звук получился нечётко. Обратите внимание на положение языка — например, sh и s произносятся в разных местах.",
    finalWeak: "Конечный звук слишком короткий или нечёткий. Тяните гласный дольше.",
    closingGreat: "Хорошая работа! Ещё несколько повторений — и будет идеально.",
    closingPractice: "Повторите ещё пару раз — звучание выровняется.",
  },
  en: {
    intro: (p) => `I analyzed your "${p}".`,
    tonePerfect: "The tone is clear and correct — your pitch curve matches the reference closely.",
    toneWrong: (intended, got) =>
      `You produced something closer to tone ${got}, but the target is tone ${intended}. Look at the pitch overlay and try to match its shape.`,
    toneWeak: (intended) =>
      `The shape of tone ${intended} is there, but it's a bit flat. Make the rise/fall more pronounced.`,
    initialWeak: "The initial consonant was unclear. Check the position of your tongue — for example sh vs s are articulated in different places.",
    finalWeak: "The final was short or unclear. Hold the vowel for a moment longer.",
    closingGreat: "Nice work! A couple more repetitions and it'll be perfect.",
    closingPractice: "Try a few more reps — the contour will tighten up.",
  },
};

export function buildFallbackFeedback(input: FeedbackInput): string {
  const c = COPY[input.lang] ?? COPY.en;
  const parts: string[] = [c.intro(input.pinyin)];

  if (input.toneScore >= 85) {
    parts.push(c.tonePerfect);
  } else if (input.detectedTone !== input.intendedTone) {
    parts.push(c.toneWrong(String(input.intendedTone), String(input.detectedTone)));
  } else {
    parts.push(c.toneWeak(String(input.intendedTone)));
  }

  if (input.initialScore < 70) parts.push(c.initialWeak);
  if (input.finalScore < 70) parts.push(c.finalWeak);

  parts.push(input.toneScore >= 80 ? c.closingGreat : c.closingPractice);
  return parts.join(" ");
}
