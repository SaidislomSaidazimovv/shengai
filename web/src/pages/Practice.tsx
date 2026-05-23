import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Sparkles, ChevronRight, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SENTENCES, DIAGNOSTIC_SET, TONE_NAMES } from "@/lib/data";
import { useUserStore, summarizeWeakSpots } from "@/store/userStore";
import { cn } from "@/lib/utils";

export function Practice() {
  const attempts = useUserStore((s) => s.attempts);
  const summary = useMemo(() => summarizeWeakSpots(attempts), [attempts]);

  const [tab, setTab] = useState<string>("recommended");

  // Recommend syllables based on weak spots; fall back to diagnostic set.
  const recommended = useMemo(() => {
    if (summary.topMistakes.length === 0) return DIAGNOSTIC_SET;
    const set = new Set(summary.topMistakes.map((m) => m.pinyin));
    const matching = DIAGNOSTIC_SET.filter((c) => set.has(c.pinyin));
    return matching.length > 0 ? matching : DIAGNOSTIC_SET;
  }, [summary]);

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-3">Practice</Badge>
          <h1 className="text-4xl font-bold tracking-tight">Drill what matters</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Adaptive drills based on your actual mistakes, plus structured lessons by HSK level.
          </p>
        </div>
        <Button asChild>
          <Link to="/test">
            <Mic className="h-4 w-4" />
            Quick diagnostic
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="recommended">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Recommended
          </TabsTrigger>
          <TabsTrigger value="syllables">Syllable drills</TabsTrigger>
          <TabsTrigger value="lessons">Sentence lessons</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended">
          <Card>
            <CardHeader>
              <CardTitle>Adaptive set</CardTitle>
              <p className="text-sm text-muted-foreground">
                {summary.topMistakes.length > 0
                  ? `We surfaced the ${recommended.length} syllables you've struggled with most across your last ${attempts.length} attempts.`
                  : "No mistake history yet. Run the diagnostic to populate this list."}
              </p>
            </CardHeader>
            <CardContent>
              {summary.topMistakes.length > 0 && (
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {summary.topMistakes.map((m, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"
                    >
                      <div className="font-mono text-lg font-semibold">{m.pinyin}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Said tone {m.detectedTone}, target {m.intendedTone}
                      </div>
                      <div className="mt-1 text-xs font-medium text-amber-700">
                        ×{m.count} time{m.count > 1 ? "s" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.map((card, i) => (
                  <Link
                    key={i}
                    to="/test"
                    className="group flex items-center gap-4 rounded-xl border border-border/60 p-4 transition-colors hover:bg-secondary/40"
                  >
                    <div className="font-chinese text-4xl">{card.hanzi}</div>
                    <div className="flex-1">
                      <div className="font-mono font-semibold">{card.pinyin}</div>
                      <div className="text-xs text-muted-foreground">Tone {card.tone} · {TONE_NAMES[card.tone]}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="syllables">
          <Card>
            <CardHeader>
              <CardTitle>Tone drills</CardTitle>
              <p className="text-sm text-muted-foreground">
                Browse the diagnostic set and any syllable from the pinyin chart.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {DIAGNOSTIC_SET.map((card, i) => (
                  <Link
                    key={i}
                    to="/test"
                    className="group rounded-xl border border-border/60 p-4 text-center transition-colors hover:bg-secondary/40"
                  >
                    <div className="font-chinese text-5xl">{card.hanzi}</div>
                    <div className="mt-2 font-mono text-sm font-semibold">{card.pinyin}</div>
                    <div className="text-xs text-muted-foreground">Tone {card.tone}</div>
                  </Link>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Button asChild variant="outline">
                  <Link to="/pinyin">
                    <BookOpen className="h-4 w-4" />
                    Open pinyin chart
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lessons">
          <Card>
            <CardHeader>
              <CardTitle>Sentence lessons</CardTitle>
              <p className="text-sm text-muted-foreground">
                Practice real sentences syllable-by-syllable. Each syllable is scored independently.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/60">
                {SENTENCES.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/lesson/${s.id}`}
                      className="group flex items-start gap-4 py-4 transition-colors hover:bg-secondary/40 -mx-2 px-2 rounded-md"
                    >
                      <Badge variant="outline" className={cn(
                        "shrink-0",
                        s.level === "HSK1" && "border-emerald-500/40 text-emerald-700",
                        s.level === "HSK2" && "border-amber-500/40 text-amber-700",
                        s.level === "HSK3" && "border-rose-500/40 text-rose-700",
                      )}>
                        {s.level}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-chinese text-2xl">{s.hanzi}</div>
                        <div className="mt-0.5 text-sm text-muted-foreground">{s.pinyin}</div>
                        <div className="mt-0.5 text-sm text-muted-foreground">{s.meaning_en}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 self-center text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
