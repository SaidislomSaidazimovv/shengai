import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PitchPoint } from "@/lib/pitch";

interface Props {
  userContour: PitchPoint[];
  reference: number[];
  height?: number;
}

/**
 * Overlays the user's normalized pitch contour against a reference contour
 * for the intended tone. The X-axis is normalized time so both curves are
 * directly comparable even if the user spoke faster or slower than the
 * reference.
 */
export function PitchCurve({ userContour, reference, height = 220 }: Props) {
  const data = useMemo(() => {
    const voiced = userContour.filter((p): p is PitchPoint & { hz: number } => p.hz !== null);
    if (voiced.length === 0) {
      return reference.map((ref, i) => ({
        t: i / (reference.length - 1),
        you: null as number | null,
        ref,
      }));
    }
    const tMin = voiced[0].t;
    const tMax = voiced[voiced.length - 1].t || tMin + 0.001;

    return reference.map((ref, i) => {
      const tNorm = i / (reference.length - 1);
      const targetT = tMin + tNorm * (tMax - tMin);
      // Find nearest voiced sample.
      let nearest = voiced[0];
      let bestDist = Math.abs(voiced[0].t - targetT);
      for (const p of voiced) {
        const d = Math.abs(p.t - targetT);
        if (d < bestDist) {
          bestDist = d;
          nearest = p;
        }
      }
      return { t: tNorm, you: nearest.hz, ref };
    });
  }, [userContour, reference]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pitch contour</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500" />
            Native
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-primary" />
            You
          </span>
        </div>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="refGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" type="number" domain={[0, 1]} hide />
            <YAxis domain={[0, 1]} hide />
            <Tooltip
              formatter={(value) =>
                value === null || value === undefined
                  ? "—"
                  : typeof value === "number"
                  ? value.toFixed(2)
                  : String(value)
              }
              labelFormatter={(label) =>
                `t = ${typeof label === "number" ? label.toFixed(2) : label}`
              }
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="ref"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#refGrad)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="you"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
