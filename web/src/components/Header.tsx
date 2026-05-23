import { Badge } from "@/components/ui/badge";
import { useSession, type Stage } from "@/store/session";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "READY",
  recording: "RECORDING",
  analyzing: "ANALYZING",
  diagnosis: "DIAGNOSIS",
  no_speech: "NO SIGNAL",
  golden: "GOLDEN VOICE",
  mirror: "MIRROR",
  resolved: "RESOLVED",
  error: "FAULT",
};

export function Header() {
  const stage = useSession((s) => s.stage);
  const attempts = useSession((s) => s.attemptsThisSession);

  return (
    <header className="border-b border-line">
      <div className="container flex items-center justify-between h-14">
        <div className="flex items-center gap-4">
          <Wordmark />
          <span className="font-data text-[10px] text-fg/40 tracking-[0.22em] uppercase">
            v01 · Tashkent → World
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={
              stage === "recording"
                ? "live"
                : stage === "diagnosis"
                ? "signal"
                : stage === "golden"
                ? "gold"
                : "default"
            }
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
            {STAGE_LABEL[stage]}
          </Badge>
          <span className="font-data text-[10px] text-fg/40 tracking-[0.18em] uppercase">
            Loops · {attempts.toString().padStart(2, "0")}
          </span>
        </div>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid place-items-center w-7 h-7 font-cjk text-lg font-bold text-signal leading-none"
        aria-hidden
      >
        声
      </span>
      <span className="font-stamp text-xl tracking-tighter">SHENG</span>
    </div>
  );
}
