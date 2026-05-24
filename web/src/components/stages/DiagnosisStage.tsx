import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DiagnosisCard } from "@/components/DiagnosisCard";
import { AITutorPanel } from "@/components/AITutorPanel";
import { ArrowRight } from "lucide-react";
import { useSession, type TutorLanguage } from "@/store/session";
import { getDemoSentence } from "@/lib/demoData";

interface Props {
  /**
   * Called when the user re-requests the Gemini explanation in a new
   * language — App.tsx owns the actual fetch since it has all the
   * diagnosis context.
   */
  onTutorLanguageChange?: (lang: TutorLanguage) => void;
  onContinue: () => void;
}

/**
 * Mirror DevHandover v02 §6.5: "Hold for 3 full seconds. Then auto-
 * transition to GOLDEN_VOICE." We extend the hold to ~7s because the
 * AI Tutor panel underneath needs a couple of seconds to fetch Gemini
 * and the user needs time to read the explanation. The gold continue
 * button and the Enter keyboard shortcut both skip the wait.
 */
const AUTO_ADVANCE_MS = 7000;

export function DiagnosisStage({ onTutorLanguageChange, onContinue }: Props) {
  const l1 = useSession((s) => s.l1);
  const sentenceId = useSession((s) => s.sentenceId);
  const sentence = getDemoSentence(sentenceId);

  // Hold the latest onContinue in a ref so the auto-advance timer
  // runs exactly once per stage entry — not on every parent re-render.
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    const t = setTimeout(() => onContinueRef.current(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, []);

  if (!sentence) return null;
  const diagnosis = sentence.diagnoses[l1];

  return (
    <div className="container py-14 grid place-items-center">
      <DiagnosisCard diagnosis={diagnosis} hero />

      <AITutorPanel onLanguageChange={onTutorLanguageChange} />

      <div className="mt-12 flex flex-col items-center gap-3">
        <Button variant="gold" size="lg" onClick={onContinue}>
          Hear yourself correct it <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="font-data text-[10px] uppercase tracking-[0.22em] text-fg/40">
          Press <kbd className="px-1.5 py-0.5 border border-line text-fg/60 font-data">ENTER</kbd> or wait — auto-continues
        </div>
      </div>
    </div>
  );
}
