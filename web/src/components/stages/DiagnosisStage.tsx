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
 * DIAGNOSIS stage: deterministic — no auto-advance. The card lands,
 * the AI Tutor panel below it streams Gemini's explanation, and the
 * user reads at their own pace. They advance with the gold "Hear
 * yourself correct it" button or the Enter keyboard shortcut.
 */
export function DiagnosisStage({ onTutorLanguageChange, onContinue }: Props) {
  const l1 = useSession((s) => s.l1);
  const sentenceId = useSession((s) => s.sentenceId);
  const triggeredPhoneme = useSession((s) => s.triggeredPhoneme);
  const sentence = getDemoSentence(sentenceId);

  if (!sentence) return null;
  const diagnosis = sentence.diagnoses[l1];

  return (
    <div className="container py-14 grid place-items-center">
      <DiagnosisCard
        diagnosis={diagnosis}
        l1={l1}
        triggeredPhoneme={triggeredPhoneme}
        hero
      />

      <AITutorPanel onLanguageChange={onTutorLanguageChange} />

      <div className="mt-12 flex flex-col items-center gap-3">
        <Button variant="gold" size="lg" onClick={onContinue}>
          Hear yourself correct it <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="font-data text-[10px] uppercase tracking-[0.22em] text-fg/40">
          Press <kbd className="px-1.5 py-0.5 border border-line text-fg/60 font-data">ENTER</kbd> to continue
        </div>
      </div>
    </div>
  );
}
