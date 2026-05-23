import { Mic, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SentencePrompt } from "@/components/SentencePrompt";
import { useSession } from "@/store/session";

interface Props {
  onStartRecording: () => void;
  onStartReference: () => void;
}

/**
 * The opening screen — mic button, target sentence, language toggle.
 *
 * If we haven't captured a reference clip yet, we surface a one-line
 * notice that the reference is missing. The reference is the input to
 * ElevenLabs cloning per §3 ("Reference Audio Trap"); without it the
 * golden voice will leak the user's accent.
 */
export function IdleStage({ onStartRecording, onStartReference }: Props) {
  const reference = useSession((s) => s.reference);
  const clone = useSession((s) => s.clone);

  return (
    <div className="container py-14 grid place-items-center">
      <div className="w-full max-w-3xl">
        <SentencePrompt />

        <div className="mt-16 flex flex-col items-center gap-6">
          <div className="relative">
            <button
              onClick={onStartRecording}
              className="relative grid place-items-center w-32 h-32 rounded-full bg-signal text-fg hover:bg-signal-600 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-signal/30"
              aria-label="Start recording"
            >
              <Mic className="h-12 w-12" strokeWidth={1.5} />
              <span className="absolute inset-0 rounded-full ring-2 ring-signal/60 animate-ping" aria-hidden />
            </button>
          </div>

          <div className="text-center">
            <div className="font-data text-[11px] uppercase tracking-[0.22em] text-fg/40">
              Press to record · auto-stops at 8s
            </div>
          </div>

          <div className="mt-2 flex items-center gap-4">
            <LanguageToggle />
          </div>
        </div>

        <div className="mt-14">
          <div className="hairline mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReferenceCard
              ok={!!reference}
              cloned={!!clone}
              onStart={onStartReference}
            />
            <BeliefCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferenceCard({ ok, cloned, onStart }: { ok: boolean; cloned: boolean; onStart: () => void }) {
  return (
    <div className="clinical-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">Step 0 · Reference</span>
        <Badge variant={ok ? "gold" : "signal"}>
          {ok ? (cloned ? "VOICE CLONED" : "REFERENCE OK") : "MISSING"}
        </Badge>
      </div>
      <div className="font-stamp text-2xl leading-tight mb-2">Capture native timbre first.</div>
      <p className="text-fg/50 text-sm font-data leading-relaxed mb-4">
        Read a short paragraph in your own language so the golden voice clones your timbre
        without your Mandarin accent leaking through.
      </p>
      <Button variant="outline" size="sm" onClick={onStart}>
        {ok ? "Re-capture reference" : "Capture reference"}
      </Button>
    </div>
  );
}

function BeliefCard() {
  return (
    <div className="clinical-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-data text-[10px] uppercase tracking-[0.2em] text-fg/40">How it works</span>
        <span className="text-fg/30 inline-flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> <span className="font-data text-[10px] uppercase tracking-[0.18em]">10-sec loop</span>
        </span>
      </div>
      <ol className="space-y-2 text-sm font-data text-fg/60 leading-relaxed">
        <li className="flex gap-3"><span className="text-fg/30 w-5">01</span><span><span className="text-fg">Speak.</span> Read the Mandarin sentence into the mic.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">02</span><span><span className="text-fg">Diagnose.</span> L1-specific phoneme error card.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">03</span><span><span className="text-fg">Golden voice.</span> Your own voice — corrected.</span></li>
        <li className="flex gap-3"><span className="text-fg/30 w-5">04</span><span><span className="text-fg">Mirror.</span> Match the target lip shape.</span></li>
      </ol>
    </div>
  );
}
