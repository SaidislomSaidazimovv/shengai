import { useSession } from "@/store/session";
import { getDemoSentence, type DemoSentence } from "@/lib/demoData";

/**
 * Resolves the sentence the session is currently working on.
 *
 * Priority order:
 *   1. session.customSentence — user-translated sentence from the
 *      /api/translate pipeline (Issue 7 custom-sentence feature).
 *   2. getDemoSentence(session.sentenceId) — one of the three
 *      built-in demo sentences.
 *
 * Setting a built-in sentence via session.setSentenceId() clears any
 * active custom sentence in the same update, so the two sources are
 * mutually exclusive and the hook never returns ambiguous data.
 *
 * Returns undefined when neither path resolves (shouldn't happen in
 * practice, but type-safe callers should handle it).
 */
export function useActiveSentence(): DemoSentence | undefined {
  const customSentence = useSession((s) => s.customSentence);
  const sentenceId = useSession((s) => s.sentenceId);
  return customSentence ?? getDemoSentence(sentenceId);
}
