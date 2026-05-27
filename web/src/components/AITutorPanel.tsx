import { cn } from "@/lib/utils";
import { useSession, type TutorLanguage } from "@/store/session";
import { Sparkles, Loader2 } from "lucide-react";

/**
 * AI Tutor panel — Gemini 2.0 Flash native-language explanation under
 * the clinical DiagnosisCard.
 *
 * The DiagnosisCard carries the deterministic clinical readout
 * (headline + phoneme shift + citation). This panel is the second
 * voice: a 2-3 sentence native-language explanation generated per
 * attempt plus one short articulatory tip. The user can toggle the
 * language between Uzbek, Russian, and English. While the live
 * Gemini call is in flight the panel shows the offline-library
 * fallback so the user never sees an empty placeholder.
 */
interface Props {
  onLanguageChange?: (lang: TutorLanguage) => void;
}

const LANGUAGE_OPTIONS: { code: TutorLanguage; label: string; native: string }[] = [
  { code: "uz", label: "UZ", native: "O'zbek" },
  { code: "ru", label: "RU", native: "Русский" },
  { code: "en", label: "EN", native: "English" },
];

export function AITutorPanel({ onLanguageChange }: Props) {
  const tutor = useSession((s) => s.tutor);
  const loading = useSession((s) => s.tutorLoading);
  const language = useSession((s) => s.tutorLanguage);
  const setTutorLanguage = useSession((s) => s.setTutorLanguage);

  const handleSwitch = (code: TutorLanguage) => {
    if (code === language) return;
    setTutorLanguage(code);
    onLanguageChange?.(code);
  };

  // Header label tracks the actual provider that produced the
  // current explanation. Defaults to GPT-4o-mini — the primary path
  // in /api/explain.py — so the header doesn't lie during loading or
  // before the first response. Switches to Gemini's label only when
  // the OpenAI primary failed and the silent backup took over.
  const providerLabel =
    tutor?.source === "gemini"
      ? "Gemini 2.0 Flash"
      : tutor?.source === "fallback"
        ? "Offline library"
        : "GPT-4o-mini";

  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      {/* v02 §5.2 color discipline — Tutor uses neutral fg, not gold,
          since gold is reserved for the Golden Voice moment only. */}
      <div className="hairline mb-5" />

      <div className="clinical-card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-fg/60" strokeWidth={1.5} />
            <span className="font-data text-micro uppercase tracking-[0.22em] text-fg/40">
              AI Tutor · {providerLabel}
            </span>
          </div>

          <div className="flex items-center gap-1" role="tablist" aria-label="Tutor language">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                role="tab"
                aria-selected={language === opt.code}
                onClick={() => handleSwitch(opt.code)}
                className={cn(
                  // h-9 (36px) on mobile so the language pills clear the
                  // touch-target floor; tighter h-7 on md+ where mouse
                  // precision lets the original clinical density work.
                  "font-data text-micro uppercase tracking-[0.2em] h-9 md:h-7 px-3 md:px-2.5 border transition-colors duration-150 ease-out",
                  language === opt.code
                    ? "border-fg text-fg"
                    : "border-line text-fg/40 hover:text-fg/70 hover:border-fg/30"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !tutor ? (
          // Live call in flight, nothing painted yet. With OpenAI
          // the typical wait is 2-5s, which is short enough that a
          // labelled spinner reads as deliberate analysis rather
          // than a frozen panel.
          <div className="flex items-center gap-3 text-fg/40 font-data text-sm py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            <span className="uppercase tracking-[0.18em] text-meta">
              Analyzing with GPT-4o-mini…
            </span>
          </div>
        ) : tutor ? (
          <>
            <p className="font-sans text-body text-fg/85 leading-relaxed mb-5">
              {tutor.explanation}
            </p>

            <div className="border-l-2 border-fg/40 pl-4 py-1">
              <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/60 mb-1">
                Try this
              </div>
              <p className="font-sans text-sm text-fg/70 leading-relaxed">{tutor.tip}</p>
            </div>

            <div className="mt-5 flex items-center justify-between font-data text-micro uppercase tracking-[0.2em] text-fg/30">
              <span>
                {tutor.source === "openai"
                  ? "OpenAI · Live"
                  : tutor.source === "gemini"
                    ? "Gemini · Live"
                    : "Offline fallback"}
              </span>
              <span>Lang · {tutor.language.toUpperCase()}</span>
            </div>
          </>
        ) : (
          <div className="font-data text-sm text-fg/40 py-2">
            No explanation available yet.
          </div>
        )}
      </div>
    </div>
  );
}
