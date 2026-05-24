/**
 * Hardcoded demo voice — implements Mirror DevHandover v02 §3:
 *
 *   "For the demo: pre-record the on-stage user's reference the night
 *    before, pre-generate the clone, hardcode the voice ID in the
 *    demo build."
 *
 * Populated by `npm run sync-demo-voice` from web/, which reads the
 * most recent cloned voice from the ElevenLabs workspace (using the
 * key in api/.env) and rewrites this file. Until that script runs,
 * `voiceId` stays null and the app falls back to live cloning per
 * session via the ReferenceStage flow.
 *
 * When `voiceId` IS set, App.tsx prefers a non-null `session.clone`
 * (a fresh live capture in this tab) but otherwise reuses the
 * hardcoded ID — so the on-stage demo can skip reference capture
 * entirely and jump straight to Golden Voice on the first attempt.
 */
export interface DemoUser {
  voiceId: string | null;
  voiceName: string | null;
  /** ISO timestamp of when the voice was cloned. */
  clonedAt: string | null;
}

export const DEMO_USER: DemoUser = {
  voiceId: "7XZI42EXXCNtSTZu8yVz",
  voiceName: "sheng-uzbek",
  clonedAt: "2026-05-24T06:05:24.000Z",
};
