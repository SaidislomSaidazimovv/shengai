import { L1_LABELS } from "@/lib/ovozData";
import { useSession } from "@/store/session";
import { cn } from "@/lib/utils";

/**
 * Two-state segmented control. Per §5 of the handover this is also the
 * "L1 detection cheat" input — what the user picks here is what the
 * diagnosis card will claim was detected.
 */
export function LanguageToggle() {
  const l1 = useSession((s) => s.l1);
  const setL1 = useSession((s) => s.setL1);

  return (
    <div className="inline-flex items-center border border-line bg-bg p-0.5">
      <span className="font-data text-[10px] uppercase tracking-[0.18em] text-fg/40 px-3">
        Your L1
      </span>
      {(Object.keys(L1_LABELS) as Array<keyof typeof L1_LABELS>).map((code) => {
        const active = l1 === code;
        return (
          <button
            key={code}
            onClick={() => setL1(code)}
            className={cn(
              "font-stamp uppercase tracking-tighter text-xs px-4 h-9 transition-colors",
              active ? "bg-fg text-bg" : "text-fg/60 hover:text-fg"
            )}
            aria-pressed={active}
          >
            {L1_LABELS[code].nativeName}
          </button>
        );
      })}
    </div>
  );
}
