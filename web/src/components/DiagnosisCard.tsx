/**
 * The "Unforgettable Moment" per the deck script.
 *
 * This card slams in at second 10 of the demo. It is the single screenshot
 * judges will share. Design notes from the brief, treated as constraints:
 *
 *   - Heavy condensed type for the headline. Signal red on black.
 *   - One research citation in the corner.
 *   - No icons, no decorations. The card is a clinical reading.
 *   - Sharp easing (cubic-bezier(0.16, 1, 0.3, 1)). No springs.
 *   - 3 seconds held — handled by the caller, not by this component.
 */

import { useEffect, useState } from "react";
import { cn, timestamp } from "@/lib/utils";
import type { Diagnosis } from "@/lib/demoData";

interface Props {
  diagnosis: Diagnosis;
  /** When true, the card is in screen-takeover hero mode. */
  hero?: boolean;
}

export function DiagnosisCard({ diagnosis, hero = true }: Props) {
  // Stamp a deterministic "patient id" so the card feels like a reading.
  const [stampedAt] = useState<string>(() => timestamp());

  return (
    <div
      className={cn(
        "relative w-full max-w-2xl mx-auto",
        hero && "animate-slam-in"
      )}
    >
      {/* Top instrument header — corner registration marks + meta line */}
      <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-8 font-data text-[10px] tracking-[0.2em] uppercase text-fg/40">
        <div className="flex items-center gap-4">
          <CornerMark />
          <span>Phonetic Analysis · SHENG/v01</span>
        </div>
        <div className="flex items-center gap-4">
          <span>READING #{stampedAt.replace(/:/g, "")}</span>
          <CornerMark mirrored />
        </div>
      </div>

      {/* Trigger phoneme — small kicker above the headline */}
      <div className="mb-3 font-data text-[11px] text-fg/40 tracking-[0.2em] uppercase">
        Trigger phoneme · <span className="text-fg/80">/{diagnosis.triggerPhoneme}/</span>
      </div>

      {/* Headline — signal red, heavy condensed, screaming */}
      <h1
        className={cn(
          "font-stamp text-signal leading-[0.95]",
          hero ? "text-6xl md:text-7xl" : "text-4xl"
        )}
      >
        {diagnosis.headline}
      </h1>

      {/* Subhead — clinical descriptor */}
      <div className={cn(
        "font-stamp text-fg leading-tight mt-4",
        hero ? "text-3xl md:text-4xl" : "text-xl"
      )}>
        {diagnosis.subhead}
      </div>

      {/* Hairline rule — animates in left-to-right */}
      <div className="relative h-px my-6 overflow-hidden">
        <div className="absolute inset-0 bg-line" />
        <div className="absolute inset-y-0 left-0 bg-signal animate-hairline" />
      </div>

      {/* Detail — muted, reads like physician notes */}
      <p className={cn(
        "text-fg/60 font-data leading-relaxed",
        hero ? "text-base md:text-lg" : "text-sm"
      )}>
        {diagnosis.detail}
      </p>

      {/* Footer citation — tiny mono, the legitimacy stamp */}
      <div className="mt-10 flex items-center justify-between font-data text-[10px] tracking-[0.18em] uppercase text-fg/40">
        <span>{diagnosis.citation}</span>
        <span className="text-signal/80">SIGNAL</span>
      </div>

      {/* Bottom instrument footer — frame closure */}
      <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-3 font-data text-[10px] tracking-[0.2em] uppercase text-fg/30">
        <div className="flex items-center gap-2">
          <CornerMark inverted />
          <span>Recorded {stampedAt}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>END OF READING</span>
          <CornerMark inverted mirrored />
        </div>
      </div>
    </div>
  );
}

function CornerMark({ mirrored = false, inverted = false }: { mirrored?: boolean; inverted?: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={cn(
        "shrink-0 text-fg/40",
        mirrored && "scale-x-[-1]",
        inverted && "scale-y-[-1]"
      )}
      aria-hidden
    >
      <path d="M0 0 L0 6 M0 0 L6 0" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
