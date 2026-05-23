import { useState, useMemo } from "react";
import { X, Volume2 } from "lucide-react";
import { INITIALS, FINALS, isValidPinyin, buildSyllable, TONE_MARKS } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Selected {
  initial: string;
  final: string;
}

export function PinyinChartPage() {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [filter, setFilter] = useState<string>("");

  const filteredInitials = useMemo(
    () => INITIALS.filter((i) => !filter || i.includes(filter)),
    [filter]
  );

  const handleSpeak = (syllable: string, tone: 1 | 2 | 3 | 4 | 5) => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(
      applyTone(syllable, tone)
    );
    utterance.lang = "zh-CN";
    utterance.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <Badge variant="outline" className="mb-3">Reference</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Pinyin chart</h1>
        <p className="mt-3 text-muted-foreground">
          All {INITIALS.length} initials × {FINALS.length} finals. Click any valid syllable to hear
          all four tones (browser TTS). Greyed cells are phonotactically invalid.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Filter initial:</span>
        {["", "b/p/m/f", "d/t/n/l", "g/k/h", "j/q/x", "zh/ch/sh/r", "z/c/s"].map((g) => (
          <button
            key={g || "all"}
            onClick={() => setFilter(g.split("/")[0] || "")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              (g === "" && !filter) || (g && g.startsWith(filter))
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {g || "All"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-center text-xs">
            <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur">
              <tr>
                <th className="sticky left-0 z-20 w-14 border-b border-r border-border bg-secondary/90 px-2 py-2 text-left">∅</th>
                {FINALS.map((f) => (
                  <th key={f} className="border-b border-r border-border px-1.5 py-2 font-mono font-semibold whitespace-nowrap">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInitials.map((initial) => (
                <tr key={initial}>
                  <th className="sticky left-0 z-10 border-b border-r border-border bg-secondary/60 px-2 py-1.5 text-left font-mono font-bold">
                    {initial}
                  </th>
                  {FINALS.map((final) => {
                    const valid = isValidPinyin(initial, final);
                    const syllable = buildSyllable(initial, final);
                    const active =
                      selected && selected.initial === initial && selected.final === final;
                    return (
                      <td key={final} className="border-b border-r border-border p-0">
                        {valid ? (
                          <button
                            onClick={() => setSelected({ initial, final })}
                            className={cn(
                              "w-full px-1.5 py-1.5 font-mono transition-colors hover:bg-primary/10",
                              active && "bg-primary text-primary-foreground hover:bg-primary"
                            )}
                            title={syllable}
                          >
                            {syllable}
                          </button>
                        ) : (
                          <div className="px-1.5 py-1.5 text-muted-foreground/30">·</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card p-4 shadow-2xl sm:bottom-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Selected</div>
              <div className="mt-1 font-mono text-3xl font-bold">
                {buildSyllable(selected.initial, selected.final)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                initial <strong className="font-mono">{selected.initial}</strong> + final{" "}
                <strong className="font-mono">{selected.final}</strong>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as const).map((tone) => {
              const syl = buildSyllable(selected.initial, selected.final);
              const display = applyTone(syl, tone);
              return (
                <Button
                  key={tone}
                  variant="outline"
                  className="flex-col gap-0.5 py-3 h-auto"
                  onClick={() => handleSpeak(syl, tone)}
                >
                  <span className="font-mono text-base font-semibold">{display}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Volume2 className="h-3 w-3" /> Tone {tone}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Place a tone mark on the appropriate vowel in a pinyin syllable.
 * Rules:
 *   1) a takes the mark when present
 *   2) else o or e (whichever is first)
 *   3) else the second letter of iu / ui (Mandarin convention)
 *   4) else the only vowel
 */
function applyTone(syllable: string, tone: 1 | 2 | 3 | 4 | 5): string {
  if (tone === 5) return syllable;
  const MARKS: Record<string, Record<number, string>> = {
    a: { 1: "ā", 2: "á", 3: "ǎ", 4: "à" },
    e: { 1: "ē", 2: "é", 3: "ě", 4: "è" },
    i: { 1: "ī", 2: "í", 3: "ǐ", 4: "ì" },
    o: { 1: "ō", 2: "ó", 3: "ǒ", 4: "ò" },
    u: { 1: "ū", 2: "ú", 3: "ǔ", 4: "ù" },
    ü: { 1: "ǖ", 2: "ǘ", 3: "ǚ", 4: "ǜ" },
  };
  let idx = syllable.indexOf("a");
  if (idx < 0) idx = Math.max(syllable.indexOf("o"), syllable.indexOf("e"));
  if (idx < 0 && (syllable.includes("iu") || syllable.includes("ui"))) {
    idx = syllable.includes("iu") ? syllable.indexOf("iu") + 1 : syllable.indexOf("ui") + 1;
  }
  if (idx < 0) idx = syllable.search(/[aeiouü]/);
  if (idx < 0) {
    void TONE_MARKS;
    return syllable;
  }
  const ch = syllable[idx];
  return syllable.slice(0, idx) + (MARKS[ch]?.[tone] ?? ch) + syllable.slice(idx + 1);
}
