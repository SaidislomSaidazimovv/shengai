import { ArrowLeft, Mic, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/store/session";

interface Props {
  onRetry: () => void;
}

/**
 * Honest no-speech state: the browser ASR returned nothing (silence,
 * timeout, or unsupported). We do not lie with a fake diagnosis here —
 * per DEV_HANDOVER §5 the phoneme signal must be real; without it we
 * surface the absence clearly and invite a retry.
 *
 * For debugging we also display the reason the upstream engine gave —
 * "hf · fallback · model_cold_start", "browser · no-speech", etc. —
 * so a teammate can tell at a glance whether it's a real silence or a
 * platform issue.
 */
export function NoSpeechStage({ onRetry }: Props) {
  const reason = useSession((s) => s.asrReason);

  return (
    <div className="container py-20 grid place-items-center text-center">
      <div className="max-w-xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-signal/50 bg-signal/10 mb-6">
          <AlertTriangle className="h-8 w-8 text-signal" strokeWidth={1.5} />
        </div>

        <Badge variant="signal" className="mb-4">NO SPEECH DETECTED</Badge>

        <h1 className="font-stamp text-4xl md:text-5xl tracking-tight">
          The mic heard nothing.
        </h1>
        <p className="text-fg/50 font-data text-sm mt-4 leading-relaxed">
          We listen for Mandarin only — quiet, distant, or non-speech inputs
          fall through. Move closer to the mic, speak the sentence at normal
          conversational volume, and we'll diagnose what we hear.
        </p>

        {reason && (
          <div className="mt-6 inline-block font-data text-[10px] uppercase tracking-[0.18em] text-fg/40 border border-line px-3 py-2">
            engine · {reason}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" size="lg" onClick={onRetry}>
            <ArrowLeft className="h-4 w-4" /> Back to idle
          </Button>
          <Button variant="signal" size="lg" onClick={onRetry}>
            <Mic className="h-4 w-4" /> Try again
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-3 font-data text-[10px] uppercase tracking-[0.18em] text-fg/40">
          <Tip label="Volume" value="conversational" />
          <Tip label="Distance" value="~30 cm" />
          <Tip label="Language" value="Mandarin only" />
        </div>
      </div>
    </div>
  );
}

function Tip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line p-3">
      <div className="text-fg/40">{label}</div>
      <div className="text-fg/80 mt-1 normal-case tracking-normal">{value}</div>
    </div>
  );
}
