import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronRight, Loader2, RotateCcw, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RecorderButton } from "@/components/Recorder";
import { PitchCurve } from "@/components/PitchCurve";
import { ScoreCard } from "@/components/ScoreCard";
import { SENTENCES, TONE_NAMES, type Sentence, type SyllableCard } from "@/lib/data";
import { scoreLocally, type LocalScore } from "@/lib/scoring";
import { api, withFallback } from "@/lib/api";
import { buildFallbackFeedback } from "@/lib/feedback";
import { useUserStore } from "@/store/userStore";
import { cn } from "@/lib/utils";
import type { Recording } from "@/lib/audio";

interface SylResult {
  score: LocalScore;
  explanation?: string;
}

export function Lesson() {
  const { id } = useParams<{ id: string }>();
  const sentence = SENTENCES.find((s) => s.id === id);

  if (!sentence) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-3xl font-bold">Lesson not found</h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/practice"><ArrowLeft className="h-4 w-4" /> Back to lessons</Link>
        </Button>
      </div>
    );
  }

  return <LessonView sentence={sentence} />;
}

function LessonView({ sentence }: { sentence: Sentence }) {
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Record<number, SylResult>>({});
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const language = useUserStore((s) => s.language);
  const pushAttempt = useUserStore((s) => s.pushAttempt);

  const syllable: SyllableCard = sentence.syllables[idx];
  const completed = useMemo(() => Object.keys(results).length, [results]);
  const progress = (completed / sentence.syllables.length) * 100;

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleSpeak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const handleRecording = async (rec: Recording) => {
    const score = scoreLocally(rec.samples, rec.sampleRate, syllable.tone);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return rec.url;
    });
    setResults((r) => ({ ...r, [idx]: { score } }));
    pushAttempt({
      id: `${Date.now()}-${idx}`,
      ts: Date.now(),
      pinyin: syllable.pinyin,
      intendedTone: syllable.tone,
      toneScore: score.toneScore,
      initialScore: score.initialScore,
      finalScore: score.finalScore,
      overall: score.overall,
      detectedTone: score.detectedTone,
    });

    setLoadingFeedback(true);
    const explained = await withFallback(
      async () => api.explain({
        pinyin: syllable.pinyin,
        intendedTone: syllable.tone,
        detectedTone: score.detectedTone,
        toneScore: score.toneScore,
        initialScore: score.initialScore,
        finalScore: score.finalScore,
        lang: language,
      }),
      () => ({
        text: buildFallbackFeedback({
          pinyin: syllable.pinyin,
          intendedTone: syllable.tone,
          detectedTone: score.detectedTone,
          toneScore: score.toneScore,
          initialScore: score.initialScore,
          finalScore: score.finalScore,
          lang: language,
        }),
        source: "fallback" as const,
      })
    );
    setResults((r) => ({
      ...r,
      [idx]: { score, explanation: explained.text },
    }));
    setLoadingFeedback(false);
  };

  const currentResult = results[idx];

  return (
    <div className="container max-w-4xl py-10 sm:py-14">
      <div className="mb-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/practice"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
      </div>

      <Badge variant="outline" className="mb-3">{sentence.level} · sentence lesson</Badge>
      <h1 className="font-chinese text-4xl sm:text-5xl">{sentence.hanzi}</h1>
      <div className="mt-2 text-lg text-muted-foreground">{sentence.pinyin}</div>
      <div className="mt-1 text-sm">{sentence.meaning_en}</div>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => handleSpeak(sentence.hanzi)}>
        <Volume2 className="h-4 w-4" />
        Hear sentence
      </Button>

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Syllable {idx + 1} of {sentence.syllables.length}</span>
          <span>{completed} completed</span>
        </div>
        <Progress value={progress} className="mt-2" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {sentence.syllables.map((s, i) => {
          const r = results[i];
          const tone = r?.score.toneScore;
          return (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                "rounded-xl border px-3 py-2 text-center transition-colors min-w-[64px]",
                i === idx ? "border-primary bg-primary/10" : "border-border hover:bg-secondary",
                tone !== undefined && tone >= 85 && "border-emerald-500/40",
                tone !== undefined && tone < 70 && tone >= 35 && "border-amber-500/40",
                tone !== undefined && tone < 35 && "border-rose-500/40",
              )}
            >
              <div className="font-chinese text-xl">{s.hanzi}</div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{s.pinyin}</div>
              {tone !== undefined && (
                <div className={cn("mt-0.5 text-[10px] font-semibold tabular-nums",
                  tone >= 85 ? "text-emerald-600" : tone >= 70 ? "text-amber-600" : "text-rose-600")}>
                  {Math.round(tone)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardContent className="pt-8">
          <div className="text-center">
            <Badge variant="outline" className="mb-3">Tone {syllable.tone} · {TONE_NAMES[syllable.tone]}</Badge>
            <div className="font-chinese text-7xl">{syllable.hanzi}</div>
            <div className="mt-2 text-2xl font-medium">{syllable.pinyin}</div>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{syllable.hint}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => handleSpeak(syllable.hanzi)}>
              <Volume2 className="h-4 w-4" />
              Native pronunciation
            </Button>
          </div>

          {!currentResult && (
            <div className="mt-10 flex justify-center">
              <RecorderButton maxSeconds={3} onComplete={handleRecording} />
            </div>
          )}

          {currentResult && (
            <div className="mt-8 space-y-5">
              <PitchCurve
                userContour={currentResult.score.contour}
                reference={currentResult.score.reference}
              />
              <div className="grid grid-cols-3 gap-3">
                <ScoreCard label="Tone" value={currentResult.score.toneScore} emphasis />
                <ScoreCard label="Initial" value={currentResult.score.initialScore} />
                <ScoreCard label="Final" value={currentResult.score.finalScore} />
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold">AI tutor feedback</div>
                  {loadingFeedback ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed">{currentResult.explanation}</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {audioUrl && <audio src={audioUrl} controls className="h-9" preload="metadata" />}
                  <Button variant="ghost" size="sm" onClick={() => setResults((r) => { const n = { ...r }; delete n[idx]; return n; })}>
                    <RotateCcw className="h-4 w-4" />
                    Retry
                  </Button>
                </div>
                <Button
                  onClick={() => setIdx(Math.min(idx + 1, sentence.syllables.length - 1))}
                  disabled={idx === sentence.syllables.length - 1}
                >
                  Next syllable
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {completed === sentence.syllables.length && (
        <div className="mt-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6 text-center">
          <Badge variant="success">Lesson complete</Badge>
          <h2 className="mt-3 text-2xl font-bold">Nice work!</h2>
          <p className="mt-1 text-muted-foreground">
            You completed every syllable in this sentence. Check your dashboard or move to the next lesson.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/dashboard">View dashboard <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/practice">Back to lessons</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
