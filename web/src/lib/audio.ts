/**
 * Microphone recording — single-stream design.
 *
 * Why this exists:
 *   - We need a recorded blob to ship to HuggingFace (MDD) and to play back.
 *   - We also need a live AnalyserNode for the waveform.
 *   - Both must run off the SAME MediaStream — two `getUserMedia` calls
 *     conflict in some browsers and produce empty captures.
 *
 * Approach: open the stream once, attach an AnalyserNode for live RMS,
 * and pipe the same stream into a MediaRecorder for the captured blob.
 * The MediaRecorder produces WebM/Opus (Chrome/Firefox) or MP4/AAC
 * (Safari) — both are acceptable inputs for HuggingFace's audio
 * pipelines (ffmpeg decodes them server-side).
 *
 * Why MediaRecorder over ScriptProcessorNode:
 *   - ScriptProcessorNode is deprecated and has a known cleanup race
 *     that caused our previous auto-stop bug.
 *   - MediaRecorder has a single, well-defined `stop` event and handles
 *     teardown internally.
 */

export interface Recording {
  blob: Blob;
  url: string;
  duration: number;
  mimeType: string;
}

export interface AudioPipeline {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  recorder: MediaRecorder;
}

/** Pick a MediaRecorder mime type the current browser can produce. */
function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mpeg",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return "";
}

/**
 * Open the mic, wire up the analyser + recorder, and start capturing.
 * Returns the pipeline so callers can drive it (read analyser, stop
 * recorder). The returned recorder is already in "recording" state.
 */
export async function startPipeline(): Promise<AudioPipeline> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioCtx();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const mimeType = pickMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  recorder.start();

  return { stream, context, analyser, recorder };
}

/**
 * Stop the pipeline and finalize the recorded blob.
 *
 * Idempotent: calling stopPipeline twice is safe — the second call is
 * a no-op (state is already "inactive" / streams already stopped).
 *
 * Resolves with a Recording. If the recorder produced no data, the
 * Recording's blob is empty and `duration` is 0; callers can detect
 * this and treat it as a silence/failure.
 */
export async function stopPipeline(pipeline: AudioPipeline): Promise<Recording> {
  const { stream, context, recorder } = pipeline;

  // 1. Gather chunks from the recorder, then resolve once it has stopped.
  const chunks: Blob[] = [];
  const dataPromise = new Promise<void>((resolve) => {
    if (recorder.state === "inactive") {
      resolve();
      return;
    }
    const onData = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    const onStop = () => {
      recorder.removeEventListener("dataavailable", onData);
      recorder.removeEventListener("stop", onStop);
      resolve();
    };
    recorder.addEventListener("dataavailable", onData);
    recorder.addEventListener("stop", onStop);
    try {
      recorder.requestData(); // flush partial buffer
    } catch {
      // Some browsers don't support requestData; safe to skip.
    }
    try {
      recorder.stop();
    } catch {
      // Already stopped; resolve via onStop or fallback timer.
      setTimeout(resolve, 50);
    }
  });

  await dataPromise;

  // 2. Stop the mic tracks.
  stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      // ignore
    }
  });

  // 3. Tear the audio graph down.
  try {
    if (context.state !== "closed") await context.close();
  } catch {
    // ignore
  }

  const mimeType = recorder.mimeType || "audio/webm";
  const blob = new Blob(chunks, { type: mimeType });
  const url = blob.size > 0 ? URL.createObjectURL(blob) : "";
  // We don't get exact duration from MediaRecorder; callers compute
  // duration from elapsed time on the UI side.
  return { blob, url, duration: 0, mimeType };
}

/** Best-effort cleanup if the pipeline must be abandoned without finalizing. */
export function abortPipeline(pipeline: AudioPipeline): void {
  try {
    if (pipeline.recorder.state !== "inactive") pipeline.recorder.stop();
  } catch {
    // ignore
  }
  pipeline.stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      // ignore
    }
  });
  if (pipeline.context.state !== "closed") {
    void pipeline.context.close().catch(() => undefined);
  }
}
