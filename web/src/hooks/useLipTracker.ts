/**
 * Real lip tracking via MediaPipe Face Landmarker.
 *
 * Lazily loads `@mediapipe/tasks-vision` + the WASM-backed model from
 * Google's CDN on first use. Per frame, runs the detector against the
 * provided <video> and returns the lip-outline landmarks (normalized to
 * [0,1]) plus a real alignment metric derived from mouth openness and
 * width relative to a per-sentence target.
 *
 * Why not @mediapipe/face_mesh (the old API): it's deprecated and ships
 * with the old solution API that doesn't run on top of Tasks-Vision's
 * WebGL backend.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export interface LipFrame {
  /** Outer lip outline polygon (normalized coords). */
  outer: { x: number; y: number }[];
  /** Inner lip outline polygon (normalized coords). */
  inner: { x: number; y: number }[];
  /** Vertical opening of the lips (0..1, normalized to face height). */
  openness: number;
  /** Width of the lips (0..1, normalized to face width). */
  width: number;
}

export interface LipTrackerOptions {
  /** Target openness (0..1) we want the user to match. */
  targetOpenness?: number;
  /** Tolerance band around the target. */
  tolerance?: number;
}

export interface LipTrackerResult {
  ready: boolean;
  error: string | null;
  /** Latest detected frame, or null until a face is found. */
  frame: LipFrame | null;
  /** Real alignment 0..100 based on how close `openness` is to target. */
  alignment: number;
  attach: (video: HTMLVideoElement) => void;
  detach: () => void;
}

// MediaPipe face mesh: standard outer + inner lip indices.
// Source: https://developers.google.com/mediapipe/solutions/vision/face_landmarker
const OUTER_LIP_IDX = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
];
const INNER_LIP_IDX = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191,
];

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
    const landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    return landmarker;
  })();
  return landmarkerPromise;
}

export function useLipTracker(opts: LipTrackerOptions = {}): LipTrackerResult {
  const { targetOpenness = 0.045, tolerance = 0.03 } = opts;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<LipFrame | null>(null);
  const [alignment, setAlignment] = useState(0);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || stoppedRef.current) return;
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    try {
      const result = landmarker.detectForVideo(video, performance.now());
      const faces = result.faceLandmarks;
      if (faces && faces.length > 0) {
        const lm = faces[0];
        const outer = OUTER_LIP_IDX.map((i) => ({ x: lm[i].x, y: lm[i].y }));
        const inner = INNER_LIP_IDX.map((i) => ({ x: lm[i].x, y: lm[i].y }));
        // Openness = vertical distance between upper-inner (13) and
        // lower-inner (14). Width = corner-to-corner (61 ↔ 291).
        const openness = Math.abs(lm[13].y - lm[14].y);
        const width = Math.abs(lm[61].x - lm[291].x);
        setFrame({ outer, inner, openness, width });

        const drift = Math.abs(openness - targetOpenness);
        const score = Math.max(0, 100 - (drift / tolerance) * 100);
        setAlignment((prev) => prev * 0.7 + score * 0.3); // EMA smoothing
      }
    } catch (e) {
      // Skip the frame; transient detector errors are not fatal.
      void e;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [targetOpenness, tolerance]);

  const attach = useCallback(
    (video: HTMLVideoElement) => {
      videoRef.current = video;
      stoppedRef.current = false;
      setError(null);
      getLandmarker()
        .then((lm) => {
          landmarkerRef.current = lm;
          setReady(true);
          rafRef.current = requestAnimationFrame(tick);
        })
        .catch((err) => {
          console.error("FaceLandmarker init failed", err);
          setError("Could not load the lip tracker (network or WebGL).");
        });
    },
    [tick]
  );

  const detach = useCallback(() => {
    stoppedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    videoRef.current = null;
    // We deliberately keep `landmarkerRef`/promise warm — re-attaching
    // is much faster than re-initializing the WASM model.
  }, []);

  useEffect(() => () => detach(), [detach]);

  return { ready, error, frame, alignment, attach, detach };
}
