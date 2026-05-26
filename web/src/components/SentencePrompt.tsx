import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DEMO_SENTENCES } from "@/lib/demoData";
import { useSession } from "@/store/session";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Sentence the user is about to read. Two sources can fill this slot:
 *   - one of the three built-in DEMO_SENTENCES (selected via the
 *     prev/next chevrons), or
 *   - a custom-translated sentence the user produced via the
 *     CustomSentenceModal (lives on session.customSentence).
 *
 * The custom path hides the prev/next chevrons (there is no rotation
 * in custom space — the user picks each sentence individually from
 * the library dropdown) and adds a small "× Switch to defaults"
 * affordance that clears the custom sentence back to the demo trio.
 */
export function SentencePrompt({ allowSwitch = true }: { allowSwitch?: boolean }) {
  const sentenceId = useSession((s) => s.sentenceId);
  const customSentence = useSession((s) => s.customSentence);
  const setSentenceId = useSession((s) => s.setSentenceId);
  const isCustom = customSentence !== null;

  const defaultSentence =
    DEMO_SENTENCES.find((s) => s.id === sentenceId) ?? DEMO_SENTENCES[0];
  const sentence = customSentence ?? defaultSentence;

  const idx = DEMO_SENTENCES.findIndex((s) => s.id === defaultSentence.id);
  const prev = () =>
    setSentenceId(
      DEMO_SENTENCES[(idx - 1 + DEMO_SENTENCES.length) % DEMO_SENTENCES.length].id
    );
  const next = () =>
    setSentenceId(DEMO_SENTENCES[(idx + 1) % DEMO_SENTENCES.length].id);

  // Hide the prev/next chevrons whenever a custom sentence is active —
  // they would just jump to a built-in and discard the user's input.
  const showChevrons = allowSwitch && !isCustom;

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-6">
        {isCustom ? (
          <>
            <Badge variant="signal">Your sentence</Badge>
            <button
              type="button"
              onClick={() => setSentenceId(defaultSentence.id)}
              className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 hover:text-fg inline-flex items-center gap-1.5 transition-colors"
            >
              <X className="h-3 w-3" />
              Switch to defaults
            </button>
          </>
        ) : (
          <Badge variant="default">
            Target sentence · {(idx + 1).toString().padStart(2, "0")} / 0
            {DEMO_SENTENCES.length}
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-center gap-6">
        {showChevrons && (
          <button
            onClick={prev}
            className="text-fg/30 hover:text-fg/80 transition-colors p-1"
            aria-label="Previous sentence"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <div>
          {/* v02 §6.2 nominally targets text-mega (128px), but inside
              the prev/next-chevron layout 128px causes longer rows
              to wrap. Cap at text-7xl (72px) and let `whitespace-nowrap`
              keep short sentences on a single line. Custom sentences
              can be longer, so we drop the nowrap and let them wrap. */}
          <div
            className={cn(
              "font-cjk tracking-tighter",
              isCustom ? "" : "whitespace-nowrap",
              allowSwitch
                ? "text-5xl md:text-6xl lg:text-7xl"
                : "text-4xl md:text-5xl"
            )}
          >
            {sentence.hanzi}
          </div>
          {/* v02 §5.3 text-body-lg (20px) — the pinyin subtitle. */}
          <div className="font-data text-fg/60 mt-5 text-body-lg tracking-wide">
            {sentence.pinyin}
          </div>
          {!isCustom && (
            <div className="font-data text-fg/30 text-micro mt-2 uppercase tracking-[0.2em]">
              {defaultSentence.translation}
            </div>
          )}
        </div>

        {showChevrons && (
          <button
            onClick={next}
            className="text-fg/30 hover:text-fg/80 transition-colors p-1"
            aria-label="Next sentence"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
