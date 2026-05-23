import { Badge } from "@/components/ui/badge";
import { useSession, type Stage } from "@/store/session";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "READY",
  recording: "RECORDING",
  analyzing: "ANALYZING",
  diagnosis: "DIAGNOSIS",
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
          <Badge variant={stage === "recording" ? "live" : stage === "diagnosis" ? "signal" : stage === "golden" ? "gold" : "default"}>
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
    <div className="flex items-center gap-2">
      <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden>
        <rect x="3" y="14" width="2" height="4" fill="#FF3838" />
        <rect x="7" y="12" width="2" height="8" fill="#ffffff" />
        <rect x="11" y="9" width="2" height="14" fill="#ffffff" />
        <rect x="15" y="6" width="2" height="20" fill="#D4A437" />
        <rect x="19" y="10" width="2" height="12" fill="#ffffff" />
        <rect x="23" y="13" width="2" height="6" fill="#ffffff" />
        <rect x="27" y="15" width="2" height="2" fill="#FF3838" />
      </svg>
      <span className="font-stamp text-xl tracking-tighter">OVOZ</span>
    </div>
  );
}
