#!/usr/bin/env node
/**
 * generate-avatar-frames — produce the pre-recorded avatar landmark
 * JSON for each demo sentence (Mirror v02 §6.7 + §14.3).
 *
 * Spec target: a native Mandarin speaker recorded with MediaPipe
 * Face Mesh, 468 landmarks per frame at 30 fps. We don't have that
 * asset yet — this script generates a STRUCTURED EQUIVALENT using
 * the same anatomical layout as SyntheticAvatar (~340 dots, real
 * face mesh shape, mouth animated to a speech-like envelope). The
 * output JSON files match the schema spec wants so once a real
 * recording lands we can drop it in without touching React code.
 *
 * Output: web/public/demo/avatar/{sentenceId}.json
 *
 * Schema:
 *   {
 *     "sentenceId": "...",
 *     "duration_ms": 3500,
 *     "fps": 30,
 *     "frames": [
 *       { "t": 0.0, "landmarks": [{x, y, region}, ...] },
 *       ...
 *     ],
 *     "note": "..."
 *   }
 *
 * Run from web/:  npm run generate-avatar-frames
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../public/demo/avatar");

const SENTENCES = [
  { id: "wo_xi_huan_xue_zhong_wen", duration_ms: 3200 },
  { id: "ni_hao_wo_jiao", duration_ms: 3000 },
  { id: "zhe_shi_yi_ge_yusan", duration_ms: 4000 },
];

const FPS = 30;

// Mirror SyntheticAvatar's anatomical point layout so the JSON
// schema matches what the React component renders today. ~340 dots
// covering jaw outline, forehead, brows, eyes (with pupils), nose,
// cheeks, philtrum, mouth (outer + inner), chin.
function buildFacePoints() {
  const points = [];

  // 1. Jaw + face outline (76 pts)
  const OUTLINE_COUNT = 76;
  for (let i = 0; i < OUTLINE_COUNT; i++) {
    const theta = (i / OUTLINE_COUNT) * Math.PI * 2 - Math.PI / 2;
    const taper = theta > 0 ? 1 - 0.12 * Math.sin(theta) : 1;
    points.push({
      x: 0.5 + Math.cos(theta) * 0.34 * taper,
      y: 0.5 + Math.sin(theta) * 0.46,
      region: "outline",
    });
  }

  // 2. Forehead (3 rows, symmetric)
  for (let row = 0; row < 3; row++) {
    const y = 0.16 + row * 0.04;
    const halfCount = 4 + row;
    for (let i = 1; i <= halfCount; i++) {
      const offset = (i / (halfCount + 1)) * 0.22;
      points.push({ x: 0.5 - offset, y, region: "forehead" });
      points.push({ x: 0.5 + offset, y, region: "forehead" });
    }
    points.push({ x: 0.5, y, region: "forehead" });
  }

  // 3. Brows
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      points.push({
        x: 0.5 + side * (0.08 + t * 0.18),
        y: 0.33 + Math.sin(t * Math.PI) * -0.018,
        region: "brow",
      });
    }
  }

  // 4. Eyes (almond outline + pupil)
  for (let side = -1; side <= 1; side += 2) {
    const cx = 0.5 + side * 0.155;
    const cy = 0.4;
    for (let i = 0; i < 28; i++) {
      const theta = (i / 28) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(theta) * 0.058,
        y: cy + Math.sin(theta) * 0.022,
        region: "eye",
      });
    }
    for (let i = 0; i < 8; i++) {
      const theta = (i / 8) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(theta) * 0.012,
        y: cy + Math.sin(theta) * 0.012,
        region: "pupil",
      });
    }
    points.push({ x: cx, y: cy, region: "pupil" });
  }

  // 5. Nose bridge + wings + nostrils
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    points.push({ x: 0.5, y: 0.43 + t * 0.18, region: "nose-bridge" });
  }
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      points.push({
        x: 0.5 + side * (0.02 + t * 0.04),
        y: 0.59 + t * 0.025,
        region: "nose-bridge",
      });
    }
    points.push({ x: 0.5 + side * 0.04, y: 0.62, region: "nostril" });
  }
  points.push({ x: 0.5, y: 0.625, region: "nostril" });

  // 6. Cheeks (concentric arcs, not grids)
  for (let side = -1; side <= 1; side += 2) {
    for (let ring = 0; ring < 3; ring++) {
      const ringR = 0.04 + ring * 0.025;
      const count = 5 + ring * 2;
      for (let i = 0; i < count; i++) {
        const theta = -Math.PI / 2 + (i / (count - 1)) * Math.PI;
        points.push({
          x: 0.5 + side * 0.18 + Math.cos(theta) * ringR * side,
          y: 0.55 + Math.sin(theta) * ringR,
          region: "cheek",
        });
      }
    }
  }

  // 7. Philtrum
  for (let i = 0; i < 4; i++) {
    points.push({ x: 0.5, y: 0.69 + (i / 3) * 0.025, region: "philtrum" });
  }

  // 8. Mouth outer + inner ellipses
  for (let i = 0; i < 52; i++) {
    const theta = (i / 52) * Math.PI * 2;
    points.push({
      x: 0.5 + Math.cos(theta) * 0.105,
      y: 0.745 + Math.sin(theta) * 0.035,
      region: "mouth-outer",
    });
  }
  for (let i = 0; i < 36; i++) {
    const theta = (i / 36) * Math.PI * 2;
    points.push({
      x: 0.5 + Math.cos(theta) * 0.07,
      y: 0.745 + Math.sin(theta) * 0.015,
      region: "mouth-inner",
    });
  }

  // 9. Chin
  for (let i = 0; i < 7; i++) {
    points.push({ x: 0.5 + (i - 3) * 0.025, y: 0.84, region: "chin" });
  }
  points.push({ x: 0.5, y: 0.88, region: "chin" });

  return points;
}

// Speech envelope per sentence: a deterministic mix of sines so the
// "mouth open" trace is reproducible (every regeneration produces the
// same JSON given the same duration).
function envelopeFor(t, durationSec) {
  // Map t to a 0..1 progress and use two sines for natural irregularity.
  const u = t / durationSec;
  const a = Math.sin(u * Math.PI * 8) * 0.5;
  const b = Math.sin(u * Math.PI * 14 + 0.8) * 0.3;
  const env = 0.5 + a * 0.5 + b * 0.5;
  return Math.max(0.05, Math.min(0.95, env));
}

function transformY(p, mouthOpen) {
  if (p.region === "mouth-outer") {
    const dy = (p.y - 0.745) * (1 + mouthOpen * 1.2);
    return 0.745 + dy;
  }
  if (p.region === "mouth-inner") {
    const dy = (p.y - 0.745) * (1 + mouthOpen * 2.8);
    return 0.745 + dy;
  }
  return p.y;
}

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const basePoints = buildFacePoints();
console.log(`Base face mesh: ${basePoints.length} points`);

// Compact schema — the 390-point face mesh layout is identical across
// all frames except for the mouth (outer + inner) which animates.
// Storing base layout once + per-frame mouth-open scalar is ~25 KB per
// sentence instead of 1.5 MB. Loader rebuilds full landmarks from
// (baselineLandmarks, frame.mouthOpen) at runtime.
for (const sentence of SENTENCES) {
  const durationSec = sentence.duration_ms / 1000;
  const frameCount = Math.round(durationSec * FPS);
  const mouthOpenSeries = [];
  for (let f = 0; f < frameCount; f++) {
    const t = f / FPS;
    mouthOpenSeries.push(Number(envelopeFor(t, durationSec).toFixed(3)));
  }

  const out = {
    sentenceId: sentence.id,
    duration_ms: sentence.duration_ms,
    fps: FPS,
    frame_count: frameCount,
    landmark_count: basePoints.length,
    /** Per-point base layout — applied to every frame except mouth. */
    landmarks_baseline: basePoints.map((p) => ({
      x: Number(p.x.toFixed(4)),
      y: Number(p.y.toFixed(4)),
      region: p.region,
    })),
    /** Per-frame mouth-open scalar in [0,1]. Loader maps mouth-outer
     *  and mouth-inner Y positions through the same transform the
     *  SyntheticAvatar uses. */
    mouth_open_series: mouthOpenSeries,
    note:
      "Compact procedural avatar track. Mirror v02 §14.3 spec wants a " +
      "MediaPipe Face Mesh capture from a native Mandarin speaker; until " +
      "we record that, this schema drives the SyntheticAvatar loader. " +
      "When a real recording is dropped in, swap landmarks_baseline + " +
      "mouth_open_series for a frames[] array of {t, landmarks[]} and " +
      "update the loader fork — the consumer contract stays stable.",
  };

  const outPath = resolve(OUTPUT_DIR, `${sentence.id}.json`);
  writeFileSync(outPath, JSON.stringify(out));
  console.log(
    `  ${sentence.id}.json — ${frameCount} frames × ${basePoints.length} dots — ${(
      JSON.stringify(out).length / 1024
    ).toFixed(1)} KB`
  );
}

console.log();
console.log("Done.");
