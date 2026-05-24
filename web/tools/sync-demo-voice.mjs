#!/usr/bin/env node
/**
 * sync-demo-voice — hardcode the on-stage user's pre-cloned voice into
 * web/src/data/demoUser.ts so the demo build can skip the live
 * ReferenceStage capture (Mirror DevHandover v02 §3).
 *
 * Workflow:
 *   1. Capture a reference once via the live ReferenceStage (or any other
 *      route that calls /api/clone). ElevenLabs stores the resulting
 *      cloned voice in your workspace.
 *   2. From the web/ directory, run `npm run sync-demo-voice`.
 *   3. This script reads ELEVENLABS_API_KEY from ../api/.env, lists the
 *      cloned voices in your workspace, picks the most recent, and
 *      rewrites src/data/demoUser.ts with the voice_id, voice name,
 *      and cloned-at timestamp.
 *   4. Commit + push the resulting demoUser.ts change so the production
 *      build serves the preset voice to every visitor.
 *
 * Safe to re-run: it rewrites the file each time.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "../../api/.env");
const OUTPUT_PATH = resolve(__dirname, "../src/data/demoUser.ts");

function readEnv(path) {
  let text;
  try {
    text = readFileSync(path, "utf-8");
  } catch (err) {
    console.error(`Cannot read ${path}: ${err.message}`);
    console.error("Make sure api/.env exists with ELEVENLABS_API_KEY set.");
    process.exit(1);
  }
  const env = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

const env = readEnv(ENV_PATH);
const key = env.ELEVENLABS_API_KEY;
if (!key || key === "your_elevenlabs_key_here") {
  console.error("ELEVENLABS_API_KEY missing or placeholder in api/.env");
  process.exit(1);
}

console.log("Fetching voices from ElevenLabs…");
const res = await fetch("https://api.elevenlabs.io/v1/voices", {
  headers: { "xi-api-key": key, accept: "application/json" },
});
if (!res.ok) {
  console.error(`ElevenLabs returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = await res.json();
const cloned = (data.voices || []).filter((v) => v.category === "cloned");
if (cloned.length === 0) {
  console.error(
    "No cloned voices in your workspace. Capture a reference once via " +
      "https://sheganai.vercel.app (Step 0 · Reference) first, then re-run."
  );
  process.exit(1);
}

cloned.sort(
  (a, b) => (b.created_at_unix || 0) - (a.created_at_unix || 0)
);
const voice = cloned[0];
const clonedAt = voice.created_at_unix
  ? new Date(voice.created_at_unix * 1000).toISOString()
  : new Date().toISOString();

console.log(`Picked: ${voice.name} (${voice.voice_id})`);
console.log(`Cloned at: ${clonedAt}`);

const file = `/**
 * Hardcoded demo voice — implements Mirror DevHandover v02 §3:
 *
 *   "For the demo: pre-record the on-stage user's reference the night
 *    before, pre-generate the clone, hardcode the voice ID in the
 *    demo build."
 *
 * Populated by \`npm run sync-demo-voice\` from web/, which reads the
 * most recent cloned voice from the ElevenLabs workspace (using the
 * key in api/.env) and rewrites this file. Until that script runs,
 * \`voiceId\` stays null and the app falls back to live cloning per
 * session via the ReferenceStage flow.
 *
 * When \`voiceId\` IS set, App.tsx prefers a non-null \`session.clone\`
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
  voiceId: ${JSON.stringify(voice.voice_id)},
  voiceName: ${JSON.stringify(voice.name)},
  clonedAt: ${JSON.stringify(clonedAt)},
};
`;

writeFileSync(OUTPUT_PATH, file, "utf-8");
console.log(`Wrote ${OUTPUT_PATH}`);
console.log();
console.log("Next steps:");
console.log("  1. git add web/src/data/demoUser.ts");
console.log("  2. git commit -m 'Pre-clone demo voice for on-stage user'");
console.log("  3. git push  (only with Saidislom's explicit OK)");
