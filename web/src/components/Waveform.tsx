import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Live RMS values per frame, newest last. */
  samples: number[];
  /** Color theme. */
  tone?: "signal" | "gold" | "white";
  /** Static (rendered once) vs animated (60fps). */
  variant?: "live" | "static";
  height?: number;
}

const COLORS: Record<"signal" | "gold" | "white", string> = {
  signal: "#FF3838",
  gold: "#D4A437",
  white: "#FFFFFF",
};

/**
 * Bar-chart waveform — one bar per RMS sample. Renders to canvas so it
 * stays smooth at 60fps with many bars.
 */
export function Waveform({ samples, tone = "white", variant = "live", height = 80 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = canvas;
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, clientWidth, clientHeight);
    if (samples.length === 0) return;

    const barCount = Math.min(samples.length, Math.floor(clientWidth / 4));
    const stride = Math.max(1, Math.floor(samples.length / barCount));
    const barWidth = 2;
    const gap = 2;
    const mid = clientHeight / 2;

    ctx.fillStyle = COLORS[tone];
    for (let i = 0; i < barCount; i++) {
      const idx = samples.length - 1 - i * stride;
      if (idx < 0) break;
      const v = Math.min(1, Math.abs(samples[idx]) * 6);
      const h = Math.max(2, v * (clientHeight - 4));
      const x = clientWidth - (i + 1) * (barWidth + gap);
      ctx.fillRect(x, mid - h / 2, barWidth, h);
    }
  }, [samples, tone]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full", variant === "live" && "transition-opacity")}
      style={{ height }}
    />
  );
}
