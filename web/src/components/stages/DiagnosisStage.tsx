import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DiagnosisCard } from "@/components/DiagnosisCard";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/store/session";
import { getDemoSentence } from "@/lib/demoData";

interface Props {
  /** Auto-advance after the card has been on screen long enough. */
  autoAdvance?: boolean;
  onContinue: () => void;
}

/**
 * Holds the diagnosis card on screen for ~3 seconds (auto-advance) or
 * until the user clicks continue. The 3-second hold is the most powerful
 * sound in the room — see the DeckScript speaker notes.
 */
export function DiagnosisStage({ autoAdvance = true, onContinue }: Props) {
  const l1 = useSession((s) => s.l1);
  const sentenceId = useSession((s) => s.sentenceId);
  const sentence = getDemoSentence(sentenceId);

  useEffect(() => {
    if (!autoAdvance) return;
    const t = setTimeout(onContinue, 3200);
    return () => clearTimeout(t);
  }, [autoAdvance, onContinue]);

  if (!sentence) return null;
  const diagnosis = sentence.diagnoses[l1];

  return (
    <div className="container py-14 grid place-items-center">
      <DiagnosisCard diagnosis={diagnosis} hero />

      <div className="mt-12 flex justify-center">
        <Button variant="gold" size="lg" onClick={onContinue}>
          Hear yourself correct it <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
