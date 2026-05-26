import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, X, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { hanziToPinyin } from "@/lib/pinyinUtils";
import { saveLibraryEntry, type LibraryEntry } from "@/lib/sentenceLibrary";
import type { DemoSentence } from "@/lib/demoData";
import { cn } from "@/lib/utils";

/**
 * Modal dialog for the custom-sentence pipeline.
 *
 * Flow inside the modal:
 *   1. User picks a source language (RU / UZ / EN) and types a
 *      sentence in their own language.
 *   2. Clicking "Translate" fires /api/translate (OpenAI GPT-4o-mini),
 *      which returns hanzi + IPA phonemes + per-L1 diagnoses.
 *   3. We derive pinyin client-side via pinyin-pro and assemble a
 *      DemoSentence-shaped record.
 *   4. The preview card shows the Mandarin translation; clicking
 *      "Use this sentence" saves the entry to localStorage and pushes
 *      it back to the IdleStage as the active custom sentence.
 *
 * The modal is intentionally self-contained — IdleStage only owns
 * the open/close flag and the onSelect callback that receives the
 * finished DemoSentence. We don't surface the in-flight LLM call to
 * the rest of the app while it's still resolving.
 */

type SourceL1 = "russian" | "uzbek" | "english";

const SOURCE_OPTIONS: { value: SourceL1; label: string; placeholder: string }[] = [
  { value: "russian", label: "Русский", placeholder: "Я люблю учить китайский…" },
  { value: "uzbek", label: "O'zbek", placeholder: "Men xitoy tilini o'rganishni yaxshi ko'raman…" },
  { value: "english", label: "English", placeholder: "I love learning Chinese…" },
];

const MAX_LENGTH = 200;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when the user accepts the preview and selects this sentence. */
  onSelect: (sentence: DemoSentence) => void;
}

export function CustomSentenceModal({ open, onClose, onSelect }: Props) {
  const [sourceL1, setSourceL1] = useState<SourceL1>("russian");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<LibraryEntry | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state every time the modal opens so the user always starts
  // from a clean form. We deliberately don't carry the previous
  // input across reopens — if the user wanted to keep it they would
  // have clicked Use this sentence.
  useEffect(() => {
    if (!open) return;
    setText("");
    setError(null);
    setPreview(null);
    setLoading(false);
    // Defer focus until after the entrance animation so the modal
    // can settle in place before the cursor lands.
    const id = window.setTimeout(() => textareaRef.current?.focus(), 200);
    return () => window.clearTimeout(id);
  }, [open]);

  // Escape closes the modal at any point (except mid-call — we don't
  // want the user to abandon a paid API call by accident).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  const handleTranslate = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    setPreview(null);
    try {
      const res = await api.translate({ text: trimmed, sourceL1 });
      if (res.source !== "openai") {
        setError(
          res.error?.startsWith("openai_timeout")
            ? "The translation took too long. Try a shorter sentence."
            : "Translation unavailable right now. Please try again."
        );
        return;
      }
      // pinyin-pro is offline and instant — we never bother the LLM
      // with pinyin generation. Derived syllables drop straight into
      // the DemoSentence shape below.
      const { pinyin, syllables } = hanziToPinyin(res.hanzi);
      const entry: LibraryEntry = {
        id: `custom-${Date.now()}`,
        hanzi: res.hanzi,
        pinyin,
        translation: trimmed,
        syllables,
        expectedPhonemes: res.expectedPhonemes,
        charPhonemeIdx: res.charPhonemeIdx,
        diagnoses: res.diagnoses,
        sourceL1,
        createdAt: Date.now(),
      };
      setPreview(entry);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (!preview) return;
    saveLibraryEntry(preview);
    onSelect(preview);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fg/30 backdrop-blur-sm"
          onClick={() => !loading && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl bg-white rounded-xl shadow-4 p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <Badge variant="default">CUSTOM SENTENCE</Badge>
                <div className="font-stamp text-2xl mt-3 leading-tight">
                  Translate your own sentence.
                </div>
                <p className="font-data text-sm text-fg/50 mt-1">
                  Type any sentence in your language — we'll translate it
                  to Mandarin and run the full diagnosis loop on it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !loading && onClose()}
                disabled={loading}
                className="text-fg/40 hover:text-fg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!preview && (
              <>
                {/* Source language selector */}
                <div className="flex items-center gap-1 mb-3 border border-line bg-bg p-0.5 w-fit">
                  <span className="font-data text-[10px] uppercase tracking-[0.18em] text-fg/40 px-3">
                    From
                  </span>
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={loading}
                      onClick={() => setSourceL1(opt.value)}
                      className={cn(
                        "font-stamp uppercase tracking-tighter text-xs px-3 h-8 transition-colors disabled:opacity-50",
                        sourceL1 === opt.value
                          ? "bg-fg text-bg"
                          : "text-fg/60 hover:text-fg"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) =>
                    setText(e.target.value.slice(0, MAX_LENGTH))
                  }
                  disabled={loading}
                  rows={3}
                  placeholder={
                    SOURCE_OPTIONS.find((o) => o.value === sourceL1)
                      ?.placeholder
                  }
                  className="w-full border border-line bg-bg rounded-md p-3 text-body font-sans text-fg focus:outline-none focus:border-fg/60 transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />

                <div className="flex items-center justify-between font-data text-micro uppercase tracking-[0.22em] text-fg/40 mt-1">
                  <span>{text.length}/{MAX_LENGTH}</span>
                  <span>
                    {sourceL1.charAt(0).toUpperCase() + sourceL1.slice(1)} →
                    Mandarin
                  </span>
                </div>

                {error && (
                  <div className="mt-4 flex items-start gap-3 p-3 rounded-md border border-signal/40 bg-signal/5">
                    <AlertCircle className="h-4 w-4 text-signal mt-0.5 shrink-0" strokeWidth={1.5} />
                    <p className="font-data text-xs text-fg/70 leading-relaxed">
                      {error}
                    </p>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="signal"
                    size="lg"
                    onClick={handleTranslate}
                    disabled={loading || text.trim().length === 0}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                        Translating…
                      </>
                    ) : (
                      <>
                        Translate <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>

                {loading && (
                  <p className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mt-3 text-center">
                    GPT-4o-mini · 4-10s typical
                  </p>
                )}
              </>
            )}

            {preview && (
              <>
                <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mb-2">
                  Your sentence
                </div>
                <div className="text-fg/60 font-sans text-base mb-5 italic">
                  "{preview.translation}"
                </div>

                <div className="border-t border-line pt-5">
                  <div className="font-data text-micro uppercase tracking-[0.22em] text-fg/40 mb-2">
                    Mandarin
                  </div>
                  <div className="font-cjk text-4xl md:text-5xl text-fg leading-tight">
                    {preview.hanzi}
                  </div>
                  <div className="font-data text-fg/50 mt-2 text-body">
                    {preview.pinyin}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreview(null)}
                  >
                    Edit
                  </Button>
                  <Button variant="signal" size="lg" onClick={handleAccept}>
                    Use this sentence <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
