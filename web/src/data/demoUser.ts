/**
 * Bundled demo voice — the "Skip with demo voice (faster)" escape
 * hatch on ReferenceStage and the §10 killswitch both point here.
 *
 * Mirror's main path forces every visitor through a fresh Reference
 * Capture so Golden Voice plays in their own timbre. The preset below
 * is NOT used as a silent fallback — it only takes effect when the
 * user explicitly skips reference capture (judges short on time), or
 * the demo presenter triggers the §10 killswitch. The IdleStage
 * Reference card labels this state "DEMO VOICE ACTIVE" so the user
 * isn't misled into thinking Golden Voice is their own clone.
 *
 * Populated by `npm run sync-demo-voice` from web/, which reads the
 * most recent cloned voice from the ElevenLabs workspace and rewrites
 * this file. If `voiceId` is null, the Skip button still works but
 * Golden Voice falls back to the pre-rendered MP3 path.
 *
 * The /api/clone_delete endpoint refuses to delete this voiceId
 * (see PROTECTED_VOICE_IDS) so beforeunload cleanup never wipes the
 * preset out of the workspace.
 */
export interface DemoUser {
  voiceId: string | null;
  voiceName: string | null;
  /** ISO timestamp of when the voice was cloned. */
  clonedAt: string | null;
}

export const DEMO_USER: DemoUser = {
  voiceId: "7XZI42EXXCNtSTZu8yVz",
  voiceName: "mirror-uzbek",
  clonedAt: "2026-05-24T06:05:24.000Z",
};
