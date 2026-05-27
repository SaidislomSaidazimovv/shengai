import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  loadLibrary,
  removeLibraryEntry,
  type LibraryEntry,
} from "@/lib/sentenceLibrary";
import { cn } from "@/lib/utils";

/**
 * Dropdown that lists the user's most recent custom sentences and
 * exposes a "+ New custom sentence" entry that opens the modal. Sits
 * on the IdleStage next to the built-in sentence prompt so the user
 * can switch between default and custom sentences in one place.
 *
 * The component reads from `localStorage` lazily on open so a write
 * from the modal (saveLibraryEntry) is reflected the next time the
 * dropdown opens, without any cross-component event plumbing.
 */

interface Props {
  /** Called when the user picks a saved entry. */
  onSelect: (entry: LibraryEntry) => void;
  /** Called when the user clicks "+ New custom sentence". */
  onNew: () => void;
}

export function SentenceLibraryDropdown({ onSelect, onNew }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(loadLibrary());
  }, [open]);

  // Click-outside dismiss so the dropdown doesn't trap interaction.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = removeLibraryEntry(id);
    setEntries(next);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "font-data text-micro uppercase tracking-[0.22em] h-9 px-4",
          "border border-line bg-bg text-fg/70 hover:text-fg hover:border-fg/30 transition-colors",
          "flex items-center gap-2"
        )}
      >
        <Plus className="h-3 w-3" />
        Custom sentence
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-80 right-0 bg-white border border-line rounded-md shadow-3 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
            className="w-full px-4 h-11 flex items-center gap-3 text-left border-b border-line/60 hover:bg-fg/5 transition-colors"
          >
            <Plus className="h-4 w-4 text-fg/60" strokeWidth={1.5} />
            <span className="font-stamp text-sm">New custom sentence</span>
          </button>

          {entries.length === 0 ? (
            <div className="px-4 py-6 text-center font-data text-xs text-fg/40 leading-relaxed">
              No saved sentences yet.
              <br />
              Translate one and it'll appear here.
            </div>
          ) : (
            <>
              <div className="px-4 py-2 font-data text-[10px] uppercase tracking-[0.22em] text-fg/40 border-b border-line/60 bg-fg/2">
                Recent · last {entries.length}
              </div>
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSelect(entry);
                  }}
                  className="group w-full px-4 py-3 text-left hover:bg-fg/5 transition-colors flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-cjk text-lg text-fg truncate">
                      {entry.hanzi}
                    </div>
                    <div className="font-data text-xs text-fg/40 mt-0.5 truncate">
                      {entry.translation}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, entry.id)}
                    // Trash stayed hover-revealed on desktop, which
                    // meant touch devices had no way to delete an
                    // entry. Surface it at reduced opacity on touch,
                    // keep the hover bump on pointer-enabled UIs.
                    className="text-fg/30 hover:text-signal transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100 shrink-0 mt-1 p-1.5 -m-1.5"
                    aria-label="Remove sentence"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
