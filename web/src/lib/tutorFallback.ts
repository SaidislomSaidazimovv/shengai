/**
 * Phoneme-specific instant tutor library.
 *
 * The AITutorPanel paints this content the moment a diagnosis lands,
 * so the user always sees real, sentence-specific advice — not a 5-15s
 * spinner and not a generic template. The same `/api/explain` call
 * still fires in the background; when its Gemini response arrives the
 * panel swaps the canned text out for the live one.
 *
 * The library is organised as `phoneme × L1 × language`. Each entry
 * is hand-written, grounded in the published L1-transfer literature
 * (the same Chen/Soloveva/Karimov/Zhang sources cited on the
 * DiagnosisCard) and intentionally specific — naming the L1
 * substitute, the articulatory motion the learner needs to add, and
 * an everyday word the learner already says correctly to anchor the
 * cue. No generic "focus on tongue position" phrases.
 *
 * Layout:
 *   PHONEME_LIBRARY["ʈʂ"]["russian"]["uz"] = { explanation, tip }
 *
 * Lookup order in `getInstantTutor`:
 *   1. exact (phoneme, l1, language)
 *   2. generic per language (no phoneme/L1 match)
 */
import type { TutorLanguage, TutorExplanation } from "@/store/session";
import type { L1 } from "@/lib/demoData";

interface Entry {
  explanation: string;
  tip: string;
}

type PhonemeBook = Record<L1, Record<TutorLanguage, Entry>>;

const PHONEME_LIBRARY: Record<string, PhonemeBook> = {
  /* ─── /ʈʂ/ — retroflex zh (中, 这, 之...) ─── */
  "ʈʂ": {
    russian: {
      uz: {
        explanation:
          "Rus tilida /ш/ va /ч/ palatallashgan — til oldinga siljiydi. " +
          "Mandarin /ʈʂ/ esa retroflex: tilingiz uchini orqaga, qattiq " +
          "tanglayga tegizmasdan, biroz orqaga bukasiz. Lablar yumshoq " +
          "yumaloq emas, neytral.",
        tip: "Tilingiz uchini «r» tovushini chiqarganday orqaga buking, " +
          "keyin xuddi shu holatda «ж» deyishga harakat qiling.",
      },
      ru: {
        explanation:
          "В русском /ж/ и /ш/ палатализованы — кончик языка идёт " +
          "вперёд, к зубам. Китайское /ʈʂ/ требует обратного: кончик " +
          "языка загибается назад, к нёбу, не касаясь его. Губы — " +
          "нейтральные, без округления.",
        tip: "Скажите «р» одними губами, не двигая языком, потом — " +
          "в той же позиции — попробуйте произнести «дж».",
      },
      en: {
        explanation:
          "Russian /ʐ/ and /ʂ/ are palatalised — the tongue tip drifts " +
          "forward. Mandarin /ʈʂ/ is retroflex: tongue tip curls back " +
          "toward the hard palate without touching it. Lips stay " +
          "neutral, not rounded.",
        tip: "Curl your tongue tip back as if starting an English «r», " +
          "then say «j» without moving the tongue.",
      },
    },
    uzbek: {
      uz: {
        explanation:
          "O'zbek tilida /ч/ tovushi yumshoq va oldindagi — Mandarin " +
          "/ʈʂ/ esa retroflex: til orqaga buklanadi. Til uchi tepa " +
          "milkka tegizilmasdan, orqa-yuqoriga ko'tariladi. Bu " +
          "«qattiqroq sh» kabi eshitiladi.",
        tip: "Tilning uchini tepaga, lekin orqaroqqa buring, keyin " +
          "tovush chiqaring — «ch» va «sh» o'rtasidagi tovush bo'ladi.",
      },
      ru: {
        explanation:
          "Узбекское /ч/ мягкое и переднеязычное; китайское /ʈʂ/ — " +
          "ретрофлексное, язык загибается назад. Кончик языка " +
          "поднимается вверх и слегка назад, не касаясь нёба.",
        tip: "Поверните кончик языка вверх и назад, затем озвучьте — " +
          "получится звук между «ч» и «ш».",
      },
      en: {
        explanation:
          "Uzbek /tʃ/ is fronted and soft; Mandarin /ʈʂ/ is retroflex — " +
          "the tongue curls back toward the palate without touching " +
          "it. The result sits between English «ch» and «sh».",
        tip: "Roll the tongue tip up and slightly back, then voice — it " +
          "should feel like a harder, deeper «ch».",
      },
    },
  },

  /* ─── /ʂ/ — retroflex sh (是, 师, 山...) ─── */
  "ʂ": {
    russian: {
      uz: {
        explanation:
          "Rus tilidagi /ш/ palatallashgan — til oldida turadi. " +
          "Mandarin /ʂ/ uchun til uchini xuddi /ʈʂ/ kabi orqaga buking, " +
          "lekin bu safar tovushni davomli oqim qiling (ovoz pog'onasi " +
          "tebranmaydi).",
        tip: "Til uchini orqaga buklang va uzun /sh/ deb chiqaring — " +
          "havo og'iz tepasidan oqib chiqsin.",
      },
      ru: {
        explanation:
          "Русский /ш/ — палатализованный переднеязычный. Китайский " +
          "/ʂ/ — ретрофлексный: кончик языка загнут назад, воздух " +
          "идёт через широкий канал. Звук «тяжелее» русского /ш/.",
        tip: "Загните кончик языка назад и тяните долгий /ш/ — " +
          "почувствуйте, как воздух уходит вверх и назад.",
      },
      en: {
        explanation:
          "Russian /ʂ/ feels softer and more forward. Mandarin /ʂ/ " +
          "needs the tongue tip curled back toward the palate, creating " +
          "a wider air channel. The result is darker than English «sh».",
        tip: "Curl the tongue back, then stretch a long «sh» — feel " +
          "the air glide along the roof of the mouth.",
      },
    },
    uzbek: {
      uz: {
        explanation:
          "O'zbek /ш/ yassi va oldida turadi. Mandarin /ʂ/ retroflex — " +
          "til uchi orqaga buklanadi va tovush chuqurroq, qattiqroq " +
          "eshitiladi. Lablar yumaloq emas.",
        tip: "Tilingiz uchini tepa-orqaga buring va uzun /sh/ deb " +
          "chiqaring — chuqurroq tovush.",
      },
      ru: {
        explanation:
          "Узбекский /ш/ плоский и переднеязычный. В китайском /ʂ/ " +
          "кончик языка поднимается назад к нёбу — звук становится " +
          "глубже и темнее.",
        tip: "Загните кончик языка назад и тяните /ш/ — попробуйте, " +
          "пока звук не станет «глубже» обычного.",
      },
      en: {
        explanation:
          "Uzbek /ʃ/ is flat and forward. Mandarin /ʂ/ is retroflex — " +
          "the tongue tip lifts and curls back, deepening the sound. " +
          "Lips stay neutral.",
        tip: "Curl the tongue tip up and back, then hold a long «sh» — " +
          "feel the sound darken.",
      },
    },
  },

  /* ─── /y/ — front-rounded ü (绿, 雨, 学, 去...) ─── */
  "y": {
    russian: {
      uz: {
        explanation:
          "Rus tilida /у/ orqada va yumaloq, /и/ oldida va yumaloq " +
          "emas — Mandarin /y/ esa ikkala xususiyatni birga oladi: til " +
          "oldida (/i/ kabi), lekin lablar qattiq yumaloq. Bu rus " +
          "tilida yo'q tovush.",
        tip: "Avval /i/ («ишак») deyishga tayyorlaning, til o'sha " +
          "joyda qolsin, keyin lablaringizni o'pmoqchi bo'lganday " +
          "yumaloqlang.",
      },
      ru: {
        explanation:
          "В русском нет звука, в котором язык впереди (как в /и/), " +
          "а губы округлены (как в /у/). Мандаринское /y/ — именно " +
          "это сочетание: язык — впереди, губы — в трубочку.",
        tip: "Скажите «и», не двигая языком, и одновременно вытяните " +
          "губы вперёд, как для «у».",
      },
      en: {
        explanation:
          "Russian has «и» (front, unrounded) and «у» (back, rounded) " +
          "but no front-rounded vowel. Mandarin /y/ combines the two: " +
          "tongue forward as in «и», lips tightly rounded as in «у».",
        tip: "Hold the «ee» tongue position, then push your lips into " +
          "a tight «oo» shape without moving the tongue.",
      },
    },
    uzbek: {
      uz: {
        explanation:
          "O'zbek tilida /ў/ orqada turadi (qattiq «o'» kabi) va " +
          "lablar yumaloq, /и/ esa oldida va yumaloq emas. Mandarin " +
          "/y/ esa: til oldida (/и/), lablar qattiq yumaloq. Bu juft " +
          "harakat kerak.",
        tip: "Avval «и» deyishga tayyorlaning, keyin lablaringizni " +
          "uzun «у» kabi yumaloqlang — til harakat qilmasin.",
      },
      ru: {
        explanation:
          "В узбекском «ў» — заднего ряда с округлёнными губами, «и» — " +
          "переднего ряда без округления. Китайский /y/ соединяет: " +
          "язык как в «и», губы — как в «ў».",
        tip: "Произнесите «и», не двигая языком, и одновременно " +
          "округлите губы как для «у».",
      },
      en: {
        explanation:
          "Uzbek separates back-rounded «ў» from front-unrounded «и», " +
          "but lacks front-rounded vowels. Mandarin /y/ combines both: " +
          "front tongue (как в «и») with strongly rounded lips.",
        tip: "Say «ee», keep the tongue still, then purse the lips " +
          "like a tight «oo».",
      },
    },
  },

  /* ─── /tɕ/ — alveolo-palatal j (叫, 觉, 见...) ─── */
  "tɕ": {
    russian: {
      uz: {
        explanation:
          "Mandarin /tɕ/ — yumshoq va alveolo-palatal: tilning oldi " +
          "yumshoq tanglay bilan tegishadi. Rus /ть/ ga yaqin, lekin " +
          "tilning yuzasi kengroq tegadi va keyin /j/ ohangida ochiladi.",
        tip: "«Дитя» so'zidagi «ть» tovushini cho'zib turing, keyin " +
          "uni «и» bilan birga ochiqlab «дьи» kabi chiqaring.",
      },
      ru: {
        explanation:
          "Китайское /tɕ/ — мягкое альвеоло-палатальное. Близко к " +
          "русскому «ть», но язык широко касается нёба, а размыкание " +
          "переходит в /й/-образный призвук.",
        tip: "Скажите «ть» как в «дитя» и плавно перейдите в «и» — " +
          "это и есть мандаринское /tɕ/.",
      },
      en: {
        explanation:
          "Mandarin /tɕ/ is a soft alveolo-palatal stop — closer to a " +
          "palatalised Russian «ть» than English «ch». The tongue " +
          "blade contacts the soft palate broadly, then releases " +
          "with a /j/-like glide.",
        tip: "Say a soft «ty-» (as in «tune» in British English), then " +
          "glide into «-ee» — the cluster should feel sticky, not " +
          "explosive.",
      },
    },
    uzbek: {
      uz: {
        explanation:
          "O'zbek /ч/ aspiratsiyalanmagan; Mandarin /tɕ/ esa biroz " +
          "puflanadi va tilning yuzasi yumshoq tanglayga kengroq " +
          "tegadi. Tovush yumshoq, lekin aniq «havo siljishi» bilan.",
        tip: "«Ich» deyish o'rniga, tilingizni yuqoriroq qo'ying va " +
          "havoni biroz kuchliroq pufurib chiqaring.",
      },
      ru: {
        explanation:
          "Узбекский /ч/ — без аспирации; китайский /tɕ/ — с лёгким " +
          "придыханием и более широким контактом языка с нёбом. " +
          "Чуть мягче, но с явным выходом воздуха.",
        tip: "Скажите «чи», но добавьте короткий толчок воздуха после " +
          "/ч/ — звук станет мандаринским.",
      },
      en: {
        explanation:
          "Uzbek /tʃ/ has no aspiration; Mandarin /tɕ/ adds a brief " +
          "puff and broadens tongue contact against the palate. " +
          "Softer than «ch», but with a clearer air release.",
        tip: "Say «chee» but add a short puff of air after the «ch» — " +
          "the consonant becomes Mandarin.",
      },
    },
  },

  /* ─── /ɕ/ — alveolo-palatal x (喜, 学, 西...) ─── */
  "ɕ": {
    russian: {
      uz: {
        explanation:
          "Mandarin /ɕ/ rus tilidagi /сь/ ga yaqin (masalan «сила» " +
          "boshidagi tovush), lekin tilning oldi tanglayga kengroq " +
          "tegadi va tovush sof yumshoq /sh/ ohangida.",
        tip: "«Сила» so'zidagi /сь/ ni cho'zing, keyin tilingizni " +
          "biroz orqaga torting — tovush yumshoqroq /шь/ ga aylanadi.",
      },
      ru: {
        explanation:
          "Китайское /ɕ/ напоминает русское «сь» в «сила», но язык " +
          "шире касается нёба и звук переходит в мягкий /шь/.",
        tip: "Тяните «сь» из «сила», затем расширьте контакт языка " +
          "с нёбом — получится мягкое /шь/.",
      },
      en: {
        explanation:
          "Mandarin /ɕ/ sits between English «sh» and «sy». The tongue " +
          "front contacts the alveolo-palatal region, softer than " +
          "English «sh» but broader than «sy».",
        tip: "Say «she» as if smiling — broad tongue contact and a " +
          "slight «y»-quality glide.",
      },
    },
    uzbek: {
      uz: {
        explanation:
          "O'zbek /ш/ yassi turadi; Mandarin /ɕ/ esa yumshoq " +
          "alveolo-palatal — tilning oldi keng kontakt qiladi, tovush " +
          "«si-she» orasidagi narsa.",
        tip: "«Sh» tovushini chiqarayotganda tilingizni biroz " +
          "yuqori-oldinga ko'taring, lablar tabassum kabi cho'zilsin.",
      },
      ru: {
        explanation:
          "Узбекский /ш/ плоский; китайский /ɕ/ — мягче, язык " +
          "поднимается выше и шире, образуя альвеоло-палатальный " +
          "контакт.",
        tip: "Произнесите /ш/, одновременно растянув уголки рта в " +
          "улыбку и подняв язык выше.",
      },
      en: {
        explanation:
          "Uzbek /ʃ/ is flat. Mandarin /ɕ/ raises the tongue to a " +
          "broad alveolo-palatal contact — the sound lies between " +
          "«sh» and «sy».",
        tip: "Say «sh» with the corners of your mouth smiling and the " +
          "tongue lifted forward.",
      },
    },
  },

  /* ─── /i/ — tone-3 sandhi context (你好, 李) ─── */
  "i": {
    russian: {
      uz: {
        explanation:
          "Bu yerda alohida tovush emas, ohang (tone) muammosi: ikki " +
          "ketma-ket Tone-3 birinchisi avtomatik Tone-2 ga ko'tariladi " +
          "(sandhi). Rus tilida ohang grammatikasi yo'q, shuning uchun " +
          "ikkalasi ham past chiqadi.",
        tip: "«Nǐ hǎo» da birinchi «nǐ» ni so'roq berayotgandek " +
          "ko'taring — keyin «hǎo» pastga tushadi.",
      },
      ru: {
        explanation:
          "Здесь проблема не в гласной, а в тоне: два третьих тона " +
          "подряд требуют сандхи — первый поднимается до второго. " +
          "Русская интонация не различает тоны, поэтому оба идут вниз.",
        tip: "В «Nǐ hǎo» поднимите голосом первое «nǐ» — будто " +
          "спрашиваете, а второе «hǎo» опустите.",
      },
      en: {
        explanation:
          "The issue here is tonal, not segmental: two consecutive " +
          "Tone-3 syllables undergo sandhi — the first rises to " +
          "Tone-2. Russian has no lexical tone, so both syllables " +
          "flatten.",
        tip: "Lift the first «nǐ» as if asking a question, then drop " +
          "the second «hǎo» down — that's the sandhi shape.",
      },
    },
    uzbek: {
      uz: {
        explanation:
          "Mandarin /i/ tor va keskin — o'zbek /и/ ga o'xshaydi, lekin " +
          "ohang (tone) ko'p hollarda farqlovchi. Ohang darajasiga " +
          "e'tibor bering.",
        tip: "/i/ ni o'zbekcha kabi talaffuz qilish to'g'ri — lekin " +
          "ohang notasini o'zgartiring (yuqori, ko'taruvchi, va h.k.).",
      },
      ru: {
        explanation:
          "Узбекский /и/ близок к мандаринскому /i/, но в китайском " +
          "тон важен. Сохраните узбекскую артикуляцию, но следите " +
          "за высотой тона.",
        tip: "Произносите /i/ как обычно по-узбекски, но измените " +
          "интонацию — выше, с подъёмом, или резким падением.",
      },
      en: {
        explanation:
          "Uzbek /i/ matches Mandarin /i/ in tongue position. The " +
          "challenge is pitch — Mandarin uses tone contour to change " +
          "meaning.",
        tip: "Keep your Uzbek /i/ articulation but adjust the pitch " +
          "contour: high, rising, falling, or dipping.",
      },
    },
  },
};

/* ─── Generic fallback when phoneme isn't in the library ─── */

function genericEntry(phoneme: string, language: TutorLanguage): Entry {
  if (language === "uz") {
    return {
      explanation:
        `/${phoneme}/ tovushini ona tilingizdagi eng yaqin variantga ` +
        `siljitmasligingiz kerak. Mandarin'da bu tovush boshqacha til ` +
        `yoki lab pozitsiyasini talab qiladi. Avval qulay tovushni ` +
        `aytib ko'ring, keyin tilning yoki lablarning bitta detalini ` +
        `o'zgartiring.`,
      tip: "Sekin gapiring va og'iz ichidagi til harakatini diqqat " +
        "bilan kuzating.",
    };
  }
  if (language === "ru") {
    return {
      explanation:
        `Звук /${phoneme}/ требует артикуляции, которой нет в вашем ` +
        `родном языке — поэтому он съезжает к ближайшему знакомому. ` +
        `Замедлите темп и поэкспериментируйте с положением языка и ` +
        `округлением губ.`,
      tip: "Говорите медленно и следите за положением языка во рту.",
    };
  }
  return {
    explanation:
      `The phoneme /${phoneme}/ requires an articulation absent from ` +
      `your L1, so it drifts toward the nearest familiar sound. Slow ` +
      `down and experiment with tongue position and lip rounding one ` +
      `parameter at a time.`,
    tip: "Speak slowly and watch how your tongue moves inside the mouth.",
  };
}

/**
 * Public API — looks up the most specific advice we have for the
 * given phoneme + L1 + language combination. Falls back to a
 * generic-but-honest entry when no library match exists.
 */
export function getInstantTutor(
  phoneme: string,
  language: TutorLanguage,
  l1: L1 = "russian"
): TutorExplanation {
  const book = PHONEME_LIBRARY[phoneme];
  const entry = book?.[l1]?.[language] ?? genericEntry(phoneme, language);
  return {
    explanation: entry.explanation,
    tip: entry.tip,
    source: "fallback",
    language,
  };
}
