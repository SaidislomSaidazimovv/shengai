import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RotateCcw, Sparkles, ChevronRight, Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RecorderButton } from "@/components/Recorder";
import { PitchCurve } from "@/components/PitchCurve";
import { ScoreCard } from "@/components/ScoreCard";
import { DIAGNOSTIC_SET, TONE_NAMES } from "@/lib/data";
import type { Recording } from "@/lib/audio";
import { scoreLocally, type LocalScore } from "@/lib/scoring";
import { api, withFallback } from "@/lib/api";
import { buildFallbackFeedback } from "@/lib/feedback";
import { useUserStore } from "@/store/userStore";
import { cn } from "@/lib/utils";

type Phase = "intro" | "recording" | "result" | "summary";

interface AttemptResult {
  pinyin: string;
  intendedTone: number;
  score: LocalScore;
  recordingUrl: string;
  explanation?: string;
  explanationSource?: "gemini" | "fallback";
}

export function FreeTest() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [current, setCurrent] = useState<AttemptResult | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const language = useUserStore((s) => s.language);
  const pushAttempt = useUserStore((s) => s.pushAttempt);

  const card = DIAGNOSTIC_SET[index];

  useEffect(() => {
    return () => {
      results.forEach((r) => URL.revokeObjectURL(r.recordingUrl));
      if (current) URL.revokeObjectURL(current.recordingUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecording = async (rec: Recording) => {
    const score = scoreLocally(rec.samples, rec.sampleRate, card.tone);
    const result: AttemptResult = {
      pinyin: card.pinyin,
      intendedTone: card.tone,
      score,
      recordingUrl: rec.url,
    };
    setCurrent(result);
    setPhase("result");
    pushAttempt({
      id: `${Date.now()}`,
      ts: Date.now(),
      pinyin: card.pinyin,
      intendedTone: card.tone,
      toneScore: score.toneScore,
      initialScore: score.initialScore,
      finalScore: score.finalScore,
      overall: score.overall,
      detectedTone: score.detectedTone,
    });

    setLoadingFeedback(true);
    const explained = await withFallback(
      async () => {
        const res = await api.explain({
          pinyin: card.pinyin,
          intendedTone: card.tone,
          detectedTone: score.detectedTone,
          toneScore: score.toneScore,
          initialScore: score.initialScore,
          finalScore: score.finalScore,
          lang: language,
        });
        return { text: res.text, source: res.source };
      },
      () => ({
        text: buildFallbackFeedback({
          pinyin: card.pinyin,
          intendedTone: card.tone,
          detectedTone: score.detectedTone,
          toneScore: score.toneScore,
          initialScore: score.initialScore,
          finalScore: score.finalScore,
          lang: language,
        }),
        source: "fallback" as const,
      }),
      (err) => console.warn("Falling back to local feedback:", err)
    );
    setCurrent((cur) =>
      cur ? { ...cur, explanation: explained.text, explanationSource: explained.source } : cur
    );
    setLoadingFeedback(false);
  };

  const handleNext = () => {
    if (!current) return;
    setResults((prev) => [...prev, current]);
    setCurrent(null);
    if (index + 1 < DIAGNOSTIC_SET.length) {
      setIndex(index + 1);
      setPhase("recording");
    } else {
      setPhase("summary");
    }
  };

  const handleRetry = () => {
    if (current) {
      URL.revokeObjectURL(current.recordingUrl);
      setCurrent(null);
    }
    setPhase("recording");
  };

  const handleStart = () => {
    setPhase("recording");
    setIndex(0);
    setResults([]);
    setCurrent(null);
  };

  const handleRestart = () => {
    results.forEach((r) => URL.revokeObjectURL(r.recordingUrl));
    setResults([]);
    setIndex(0);
    setPhase("intro");
  };

  const progress = ((index + (phase === "result" ? 1 : 0)) / DIAGNOSTIC_SET.length) * 100;

  return (
    <div className="container max-w-3xl py-10 sm:py-14">
      {phase === "intro" && <Intro onStart={handleStart} />}

      {(phase === "recording" || phase === "result") && (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Question {index + 1} of {DIAGNOSTIC_SET.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="mt-2" />
          </div>

          <Card className="overflow-hidden">
            <CardContent className="pt-8 sm:pt-10">
              <div className="text-center">
                <Badge variant="outline" className="mb-3">
                  Tone {card.tone} · {TONE_NAMES[card.tone]}
                </Badge>
                <div className="font-chinese text-7xl sm:text-8xl">{card.hanzi}</div>
                <div className="mt-3 text-2xl font-medium tracking-wide">{card.pinyin}</div>
                <div className="mt-1 text-muted-foreground">"{card.meaning}"</div>
                <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{card.hint}</p>
              </div>

              {phase === "recording" && (
                <div className="mt-10 flex flex-col items-center gap-6">
                  <RecorderButton maxSeconds={3} onComplete={handleRecording} />
                </div>
              )}

              {phase === "result" && current && (
                <div className="mt-8">
                  <ResultBlock
                    result={current}
                    onRetry={handleRetry}
                    onNext={handleNext}
                    loadingFeedback={loadingFeedback}
                    isLast={index === DIAGNOSTIC_SET.length - 1}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {phase === "summary" && <Summary results={results} onRestart={handleRestart} />}
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center">
      <Badge variant="outline" className="mb-3 gap-1.5 border-primary/30 bg-primary/5 text-primary">
        <Sparkles className="h-3 w-3" /> 2 minutes · no signup
      </Badge>
      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        Find out where your pronunciation actually stands
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
        Read 5 Chinese syllables out loud. We score your tone, initial, and final separately, then
        explain — in your language — what to fix.
      </p>

      <div className="mx-auto mt-10 grid max-w-2xl gap-4 text-left sm:grid-cols-3">
        {[
          { n: "1", title: "Read", body: "We show a syllable with pinyin." },
          { n: "2", title: "Record", body: "Press the mic and say it." },
          { n: "3", title: "Result", body: "See your scores + native curve." },
        ].map((s) => (
          <div key={s.n} className="rounded-2xl border border-border/60 p-5">
            <div className="text-sm font-semibold text-primary">{s.n}.</div>
            <div className="mt-1 font-semibold">{s.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{s.body}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Button size="xl" onClick={onStart}>
          Start the test
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        We'll ask for microphone access. Your audio stays in your browser.
      </p>
    </div>
  );
}

function ResultBlock({
  result,
  onRetry,
  onNext,
  loadingFeedback,
  isLast,
}: {
  result: AttemptResult;
  onRetry: () => void;
  onNext: () => void;
  loadingFeedback: boolean;
  isLast: boolean;
}) {
  const matched = result.score.detectedTone === result.intendedTone;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-3">
        <Badge variant={matched ? "success" : "warning"}>
          {matched ? `Tone ${result.intendedTone} detected ✓` : `You said tone ${result.score.detectedTone} (target: ${result.intendedTone})`}
        </Badge>
        {!result.score.voiced && <Badge variant="danger">No voice detected</Badge>}
      </div>

      <PitchCurve userContour={result.score.contour} reference={result.score.reference} />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <ScoreCard label="Tone" value={result.score.toneScore} emphasis />
        <ScoreCard label="Initial" value={result.score.initialScore} />
        <ScoreCard label="Final" value={result.score.finalScore} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">AI tutor feedback</span>
            {result.explanationSource && (
              <Badge variant={result.explanationSource === "gemini" ? "default" : "secondary"}>
                {result.explanationSource === "gemini" ? "Gemini" : "Offline"}
              </Badge>
            )}
          </div>
          {loadingFeedback ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating personalized feedback…
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{result.explanation}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <audio src={result.recordingUrl} controls className="h-9 max-w-[220px]" preload="metadata" />
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
        <Button onClick={onNext}>
          {isLast ? "See summary" : "Next syllable"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Summary({ results, onRestart }: { results: AttemptResult[]; onRestart: () => void }) {
  const avg = useMemo(() => {
    const len = Math.max(results.length, 1);
    return {
      tone: results.reduce((s, r) => s + r.score.toneScore, 0) / len,
      initial: results.reduce((s, r) => s + r.score.initialScore, 0) / len,
      final: results.reduce((s, r) => s + r.score.finalScore, 0) / len,
      overall: results.reduce((s, r) => s + r.score.overall, 0) / len,
    };
  }, [results]);

  const level =
    avg.overall >= 85 ? "Advanced" :
    avg.overall >= 70 ? "Intermediate" :
    avg.overall >= 55 ? "Beginner+" : "Beginner";

  return (
    <div>
      <div className="text-center">
        <Badge variant="success" className="mb-3">Diagnostic complete</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Your starting level: <span className="text-primary">{level}</span></h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          You scored {Math.round(avg.overall)} / 100 across {results.length} syllables. Below are your component averages.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-4">
        <ScoreCard label="Tone" value={avg.tone} emphasis />
        <ScoreCard label="Initial" value={avg.initial} />
        <ScoreCard label="Final" value={avg.final} />
      </div>

      <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border/60 bg-card">
        <div className="border-b border-border/60 p-5">
          <h2 className="font-semibold">Attempt breakdown</h2>
        </div>
        <ul className="divide-y divide-border/60">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-3 p-4">
              <div className="font-chinese text-2xl">{DIAGNOSTIC_SET[i].hanzi}</div>
              <div className="flex-1">
                <div className="font-medium">{r.pinyin}</div>
                <div className="text-xs text-muted-foreground">Target tone {r.intendedTone} · Detected {r.score.detectedTone}</div>
              </div>
              <div className={cn(
                "rounded-md px-3 py-1 text-sm font-semibold tabular-nums",
                r.score.overall >= 85 ? "bg-emerald-500/10 text-emerald-700" :
                r.score.overall >= 70 ? "bg-amber-500/10 text-amber-700" :
                "bg-rose-500/10 text-rose-700"
              )}>
                {Math.round(r.score.overall)}
              </div>
              <Button asChild variant="ghost" size="icon" aria-label="Replay">
                <a href={r.recordingUrl} target="_blank" rel="noreferrer"><Volume2 className="h-4 w-4" /></a>
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link to="/practice">
            Start practicing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/dashboard">View dashboard</Link>
        </Button>
        <Button size="lg" variant="ghost" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" />
          Retake
        </Button>
      </div>
    </div>
  );
}
