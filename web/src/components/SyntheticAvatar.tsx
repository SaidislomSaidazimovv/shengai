import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Synthetic Mandarin-mouthing avatar — the left panel of the §6.7
 * Mirror split layout. Renders a hand-tuned face mesh of ~340 points
 * organised into anatomical regions (jaw outline, forehead, brows,
 * eyes, nose, cheeks, mouth) plus light tessellation lines, with the
 * mouth area animated in a speech-like envelope.
 *
 * Why hand-built instead of a real MediaPipe landmark JSON:
 *   - The spec calls for a pre-recorded native Mandarin landmark
 *     sequence; we don't have that asset yet (deferred to the
 *     Roadmap). Hand-placing the points lets the avatar look like a
 *     real face mesh — symmetric, organic, no random scatter — and
 *     still respond to speech rhythm.
 */
interface Props {
  /** When true, animate the mouth area; otherwise hold the resting face. */
  speaking?: boolean;
  className?: string;
}

type Region =
  | "outline"
  | "forehead"
  | "brow"
  | "eye"
  | "pupil"
  | "nose-bridge"
  | "nostril"
  | "cheek"
  | "philtrum"
  | "mouth-outer"
  | "mouth-inner"
  | "chin";

interface Point {
  x: number; // 0..1 within the face frame
  y: number; // 0..1 within the face frame
  region: Region;
}

// Build a stable, anatomically-arranged face mesh once.
function buildFacePoints(): Point[] {
  const points: Point[] = [];

  /* ─────────── 1. JAW + FACE OUTLINE ─────────── */
  // Egg shape, narrower at the chin. 76 points around the contour.
  const OUTLINE_COUNT = 76;
  for (let i = 0; i < OUTLINE_COUNT; i++) {
    const theta = (i / OUTLINE_COUNT) * Math.PI * 2 - Math.PI / 2;
    // Narrower at the bottom (chin) than the top (forehead).
    const taper = theta > 0 ? 1 - 0.12 * Math.sin(theta) : 1;
    const rx = 0.34 * taper;
    const ry = 0.46;
    points.push({
      x: 0.5 + Math.cos(theta) * rx,
      y: 0.5 + Math.sin(theta) * ry,
      region: "outline",
    });
  }

  /* ─────────── 2. FOREHEAD — three calm rows ─────────── */
  // 3 rows × symmetric pairs, no boxy grid.
  for (let row = 0; row < 3; row++) {
    const y = 0.16 + row * 0.04;
    const halfCount = 4 + row;
    for (let i = 1; i <= halfCount; i++) {
      const offset = (i / (halfCount + 1)) * 0.22;
      points.push({ x: 0.5 - offset, y, region: "forehead" });
      points.push({ x: 0.5 + offset, y, region: "forehead" });
    }
    // Centre dot
    points.push({ x: 0.5, y, region: "forehead" });
  }

  /* ─────────── 3. BROWS — soft arches ─────────── */
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const x = 0.5 + side * (0.08 + t * 0.18);
      // Arch: dips slightly outward.
      const y = 0.33 + Math.sin(t * Math.PI) * -0.018;
      points.push({ x, y, region: "brow" });
    }
  }

  /* ─────────── 4. EYES — almond outline + pupil ─────────── */
  for (let side = -1; side <= 1; side += 2) {
    const cx = 0.5 + side * 0.155;
    const cy = 0.4;
    // Almond outline: 28 points, wider than tall.
    for (let i = 0; i < 28; i++) {
      const theta = (i / 28) * Math.PI * 2;
      const rx = 0.058;
      const ry = 0.022;
      points.push({
        x: cx + Math.cos(theta) * rx,
        y: cy + Math.sin(theta) * ry,
        region: "eye",
      });
    }
    // Pupil (small inner circle, 8 points).
    for (let i = 0; i < 8; i++) {
      const theta = (i / 8) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(theta) * 0.012,
        y: cy + Math.sin(theta) * 0.012,
        region: "pupil",
      });
    }
    // Pupil centre
    points.push({ x: cx, y: cy, region: "pupil" });
  }

  /* ─────────── 5. NOSE — straight bridge + wings ─────────── */
  // Bridge: clean vertical line down centre, 18 points.
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    points.push({
      x: 0.5,
      y: 0.43 + t * 0.18,
      region: "nose-bridge",
    });
  }
  // Wing curve (each side): subtle arc out from bridge tip.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const x = 0.5 + side * (0.02 + t * 0.04);
      const y = 0.59 + t * 0.025;
      points.push({ x, y, region: "nose-bridge" });
    }
    // Nostril dot
    points.push({ x: 0.5 + side * 0.04, y: 0.62, region: "nostril" });
  }
  // Tip centre
  points.push({ x: 0.5, y: 0.625, region: "nostril" });

  /* ─────────── 6. CHEEKS — gentle elliptical scatter ─────────── */
  // Per side: 22 points arranged on concentric arcs, NOT a grid.
  for (let side = -1; side <= 1; side += 2) {
    for (let ring = 0; ring < 3; ring++) {
      const ringR = 0.04 + ring * 0.025;
      const count = 5 + ring * 2; // 5, 7, 9
      for (let i = 0; i < count; i++) {
        const theta = -Math.PI / 2 + (i / (count - 1)) * Math.PI;
        const cx = 0.5 + side * 0.18;
        const cy = 0.55;
        const x = cx + Math.cos(theta) * ringR * side;
        const y = cy + Math.sin(theta) * ringR;
        points.push({ x, y, region: "cheek" });
      }
    }
  }

  /* ─────────── 7. PHILTRUM — soft groove above the lip ─────────── */
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    points.push({
      x: 0.5,
      y: 0.69 + t * 0.025,
      region: "philtrum",
    });
  }

  /* ─────────── 8. MOUTH — outer + inner ellipses ─────────── */
  // Outer lip: 52 points, wider than tall.
  for (let i = 0; i < 52; i++) {
    const theta = (i / 52) * Math.PI * 2;
    const rx = 0.105;
    const ry = 0.035;
    points.push({
      x: 0.5 + Math.cos(theta) * rx,
      y: 0.745 + Math.sin(theta) * ry,
      region: "mouth-outer",
    });
  }
  // Inner lip: 36 points, animates more dramatically with the
  // speech envelope.
  for (let i = 0; i < 36; i++) {
    const theta = (i / 36) * Math.PI * 2;
    const rx = 0.07;
    const ry = 0.015;
    points.push({
      x: 0.5 + Math.cos(theta) * rx,
      y: 0.745 + Math.sin(theta) * ry,
      region: "mouth-inner",
    });
  }

  /* ─────────── 9. CHIN — small accent dots below the lip ─────────── */
  for (let i = 0; i < 7; i++) {
    const offset = (i - 3) * 0.025;
    points.push({ x: 0.5 + offset, y: 0.84, region: "chin" });
  }
  // Centre chin tip
  points.push({ x: 0.5, y: 0.88, region: "chin" });

  return points;
}

// Connection rules for the tessellation overlay. Each entry says
// "every Nth nearest-neighbour pair in region X gets a 0.5px line".
// We avoid drawing dense lines for forehead/cheeks because they
// overload the visual — only the contour and feature regions get
// proper tessellation.
const TESSELLATION_REGIONS: Region[] = [
  "outline",
  "brow",
  "eye",
  "mouth-outer",
  "mouth-inner",
  "nose-bridge",
];

export function SyntheticAvatar({ speaking = true, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[] | null>(null);
  const neighboursRef = useRef<number[][] | null>(null);

  useEffect(() => {
    if (!pointsRef.current) {
      const pts = buildFacePoints();
      pointsRef.current = pts;
      // For each point in a "tessellation" region, precompute its 2
      // nearest neighbours within the SAME region. Tight neighbours
      // give a clean contour-following line set instead of a chaotic
      // web. Forehead/cheek points stay as dots only.
      const neighbours: number[][] = pts.map((p, i) => {
        if (!TESSELLATION_REGIONS.includes(p.region)) return [];
        const sameRegion: { j: number; d: number }[] = [];
        for (let j = 0; j < pts.length; j++) {
          if (j === i || pts[j].region !== p.region) continue;
          const dx = pts[j].x - p.x;
          const dy = pts[j].y - p.y;
          sameRegion.push({ j, d: dx * dx + dy * dy });
        }
        sameRegion.sort((a, b) => a.d - b.d);
        return sameRegion.slice(0, 2).map((e) => e.j);
      });
      neighboursRef.current = neighbours;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let raf = 0;
    const start = performance.now();

    const transformY = (p: Point, mouthOpen: number): number => {
      if (p.region === "mouth-outer") {
        const dy = (p.y - 0.745) * (1 + mouthOpen * 1.2);
        return 0.745 + dy;
      }
      if (p.region === "mouth-inner") {
        const dy = (p.y - 0.745) * (1 + mouthOpen * 2.8);
        return 0.745 + dy;
      }
      return p.y;
    };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Speech envelope — two sines so the open/close doesn't loop
      // perceptibly. Range ~0.05 (almost closed) → ~0.9 (open).
      const env = speaking
        ? 0.45 + 0.3 * Math.sin(t * 4.2) + 0.18 * Math.sin(t * 9.5 + 1)
        : 0.05;
      const mouthOpen = Math.max(0.05, Math.min(0.95, env));

      const pts = pointsRef.current!;
      const neighbours = neighboursRef.current!;

      // Tessellation lines first so dots sit on top — light gray
      // (fg-tertiary 30% opacity per v02 §6.7).
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(163, 163, 163, 0.35)";
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const px = p.x * w;
        const py = transformY(p, mouthOpen) * h;
        for (const j of neighbours[i]) {
          if (j <= i) continue;
          const q = pts[j];
          const qx = q.x * w;
          const qy = transformY(q, mouthOpen) * h;
          ctx.moveTo(px, py);
          ctx.lineTo(qx, qy);
        }
      }
      ctx.stroke();

      // Dot pass — v02 §6.7 1.5 px dots in fg-primary at 80 %. The
      // mouth-inner ring renders slightly darker so the speech motion
      // reads at a glance.
      for (const p of pts) {
        const px = p.x * w;
        const py = transformY(p, mouthOpen) * h;
        ctx.fillStyle =
          p.region === "mouth-inner"
            ? "rgba(10, 10, 10, 0.92)"
            : p.region === "pupil"
              ? "rgba(10, 10, 10, 0.9)"
              : "rgba(10, 10, 10, 0.72)";
        ctx.beginPath();
        ctx.arc(px, py, p.region === "outline" ? 1.6 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [speaking]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full block", className)}
      aria-label="Synthetic Mandarin avatar — face mesh target"
    />
  );
}
