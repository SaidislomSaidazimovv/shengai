import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatScore, scoreBg, scoreColor } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  hint?: string;
  emphasis?: boolean;
}

export function ScoreCard({ label, value, hint, emphasis }: Props) {
  return (
    <Card className={cn(emphasis && "ring-2 ring-primary/20")}>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <TrendingUp className={cn("h-4 w-4", scoreColor(value))} />
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-4xl font-bold tracking-tight tabular-nums", scoreColor(value))}>
            {formatScore(value)}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <Progress value={value} indicatorClassName={scoreBg(value)} />
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
