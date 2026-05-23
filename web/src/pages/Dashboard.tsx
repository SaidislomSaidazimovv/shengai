import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, Flame, Mic, Target, Trash2, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useUserStore, summarizeWeakSpots } from "@/store/userStore";
import { cn, formatScore, scoreColor, scoreBg } from "@/lib/utils";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export function Dashboard() {
  const attempts = useUserStore((s) => s.attempts);
  const clear = useUserStore((s) => s.clear);
  const summary = useMemo(() => summarizeWeakSpots(attempts), [attempts]);

  const streak = useMemo(() => computeStreak(attempts), [attempts]);

  const chartData = useMemo(() => {
    const last = [...attempts].slice(0, 20).reverse();
    return last.map((a, i) => ({
      idx: i + 1,
      overall: a.overall,
      tone: a.toneScore,
    }));
  }, [attempts]);

  if (attempts.length === 0) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <Activity className="mx-auto h-12 w-12 text-muted-foreground/60" />
        <h1 className="mt-5 text-3xl font-bold tracking-tight">No attempts yet</h1>
        <p className="mt-3 text-muted-foreground">
          Take the diagnostic to start building your progress dashboard.
        </p>
        <Button asChild className="mt-6" size="lg">
          <Link to="/test"><Mic className="h-4 w-4" /> Start diagnostic</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-3">Dashboard</Badge>
          <h1 className="text-4xl font-bold tracking-tight">Your progress</h1>
          <p className="mt-2 text-muted-foreground">
            {attempts.length} attempts logged · {streak}-day streak
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/test"><Mic className="h-4 w-4" /> Quick test</Link>
          </Button>
          <Button variant="outline" onClick={clear}>
            <Trash2 className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Overall" value={(summary.tone + summary.initial + summary.final) / 3} icon={TrendingUp} />
        <SummaryCard label="Tone" value={summary.tone} icon={Activity} />
        <SummaryCard label="Initial" value={summary.initial} icon={Target} />
        <SummaryCard label="Final" value={summary.final} icon={Flame} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent attempts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Last 20 scores. Look for the trend, not the wiggle.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line dataKey="overall" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name="Overall" />
                  <Line dataKey="tone" stroke="#10b981" strokeWidth={2} strokeDasharray="4 2" dot={false} name="Tone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mistake heat-map</CardTitle>
            <p className="text-sm text-muted-foreground">Top confusions worth drilling.</p>
          </CardHeader>
          <CardContent>
            {summary.topMistakes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to fix yet — great work!</p>
            ) : (
              <ul className="space-y-3">
                {summary.topMistakes.map((m, i) => (
                  <li key={i} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-base font-semibold">{m.pinyin}</span>
                      <Badge variant="warning">×{m.count}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Said tone {m.detectedTone}, target {m.intendedTone}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild className="mt-4 w-full" variant="outline">
              <Link to="/practice">Drill these</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Attempt log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Syllable</th>
                  <th className="py-2 pr-3">Target → Said</th>
                  <th className="py-2 pr-3 text-right">Tone</th>
                  <th className="py-2 pr-3 text-right">Initial</th>
                  <th className="py-2 pr-3 text-right">Final</th>
                  <th className="py-2 text-right">Overall</th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice(0, 30).map((a) => (
                  <tr key={a.id} className="border-b border-border/40 last:border-b-0">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{relativeTime(a.ts)}</td>
                    <td className="py-2 pr-3 font-mono font-semibold">{a.pinyin}</td>
                    <td className="py-2 pr-3 text-xs">
                      <span className="rounded bg-secondary px-1.5 py-0.5">{a.intendedTone}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5",
                          a.detectedTone === a.intendedTone
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-rose-500/15 text-rose-700"
                        )}
                      >
                        {a.detectedTone}
                      </span>
                    </td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums", scoreColor(a.toneScore))}>{formatScore(a.toneScore)}</td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums", scoreColor(a.initialScore))}>{formatScore(a.initialScore)}</td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums", scoreColor(a.finalScore))}>{formatScore(a.finalScore)}</td>
                    <td className={cn("py-2 text-right font-semibold tabular-nums", scoreColor(a.overall))}>{formatScore(a.overall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <Icon className={cn("h-4 w-4", scoreColor(value))} />
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className={cn("text-3xl font-bold tabular-nums", scoreColor(value))}>{formatScore(value)}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <Progress value={value} className="mt-3" indicatorClassName={scoreBg(value)} />
      </CardContent>
    </Card>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function computeStreak(attempts: { ts: number }[]): number {
  if (attempts.length === 0) return 0;
  const days = new Set(
    attempts.map((a) => new Date(a.ts).toISOString().slice(0, 10))
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}
