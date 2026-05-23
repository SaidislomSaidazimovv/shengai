import { CheckCircle2, RotateCcw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/store/session";
import { DEMO_SENTENCES, getDemoSentence } from "@/lib/ovozData";

interface Props {
  onAgain: () => void;
  onNext: () => void;
}

export function ResolvedStage({ onAgain, onNext }: Props) {
  const sentenceId = useSession((s) => s.sentenceId);
  const setSentenceId = useSession((s) => s.setSentenceId);
  const sentence = getDemoSentence(sentenceId);

  const handleNext = () => {
    const idx = DEMO_SENTENCES.findIndex((s) => s.id === sentenceId);
    const next = DEMO_SENTENCES[(idx + 1) % DEMO_SENTENCES.length];
    setSentenceId(next.id);
    onNext();
  };

  return (
    <div className="container py-20 grid place-items-center text-center">
      <div className="max-w-2xl">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold/15 border border-gold/40 mb-6">
          <CheckCircle2 className="h-10 w-10 text-gold" strokeWidth={1.5} />
        </div>

        <Badge variant="gold" className="mb-4">LOOP RESOLVED</Badge>

        <h1 className="font-stamp text-4xl md:text-5xl tracking-tight">Identity preserved. Production corrected.</h1>
        <p className="text-fg/50 font-data text-sm mt-4 max-w-lg mx-auto leading-relaxed">
          You heard your own voice succeed. The mimicry pressure dropped. Your vocal cords already
          know how to do this — you just heard the proof.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" size="lg" onClick={onAgain}>
            <RotateCcw className="h-4 w-4" /> Try same sentence again
          </Button>
          <Button variant="gold" size="lg" onClick={handleNext}>
            Next sentence <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {sentence && (
          <div className="mt-12 text-fg/30 font-data text-xs uppercase tracking-[0.18em]">
            Just completed · {sentence.hanzi} · {sentence.pinyin}
          </div>
        )}
      </div>
    </div>
  );
}
