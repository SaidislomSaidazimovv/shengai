/**
 * Bundled demo voice — the "Skip with demo voice (faster)" escape
 * hatch on ReferenceStage points here.
 *
 * Mirror's main path forces every visitor through a fresh Reference
 * Capture so Golden Voice plays in their own timbre. This preset is
 * NOT used as a silent fallback — it only takes effect when the user
 * explicitly skips reference capture (judges short on time). The
 * IdleStage Reference card labels this state "DEMO VOICE ACTIVE" so
 * the user isn't misled into thinking Golden Voice is their own clone.
 *
 * IMPORTANT — this is a NEUTRAL ElevenLabs stock voice ("Alice —
 * Clear, Engaging Educator", category: premade), NOT anyone's personal
 * clone. Earlier this pointed at the developer's own "mirror-uzbek"
 * IVC clone, which meant a stranger tapping Skip would hear the
 * developer's real cloned voice. We swapped it for a stock voice so
 * no personal timbre is ever exposed as the public demo fallback.
 * Alice is multilingual-capable, so Flash v2.5 renders Mandarin with
 * it; the accent is non-native but acceptable for an explicitly-
 * labelled escape hatch.
 *
 * Stock voices are owned by ElevenLabs, not the workspace, so the
 * /api/clone_delete cleanup can never wipe this out — no protection
 * entry needed beyond the existing DEMO_VOICE_ID env guard.
 */
export interface DemoUser {
  voiceId: string | null;
  voiceName: string | null;
  /** ISO timestamp of when the voice was cloned. null for stock voices. */
  clonedAt: string | null;
}

export const DEMO_USER: DemoUser = {
  voiceId: "Xb7hH8MSUJpSbSDYk0k2",
  voiceName: "Alice — Clear Educator (stock)",
  clonedAt: null,
};
