import { cn } from "@/lib/utils";

const SIZE_CONFIG = {
  lg: { box: 128, stroke: 10, text: "text-3xl", label: "text-xs" },
  md: { box: 72, stroke: 7, text: "text-lg", label: "text-[10px]" },
  sm: { box: 48, stroke: 5, text: "text-sm", label: "text-[9px]" },
} as const;

function tierColor(score: number, tone: "opportunity" | "quality"): string {
  // "opportunity" scores are good news when HIGH (a strong lead to chase);
  // "quality" scores (SEO, mobile, ...) are good news when HIGH in the ordinary sense.
  if (tone === "opportunity") {
    if (score >= 66) return "stroke-primary";
    if (score >= 33) return "stroke-amber-500";
    return "stroke-muted-foreground/40";
  }
  if (score >= 70) return "stroke-emerald-500";
  if (score >= 40) return "stroke-amber-500";
  return "stroke-destructive/70";
}

export function ScoreRing({
  score,
  size = "md",
  tone = "quality",
  label,
  className,
}: {
  score: number | null;
  size?: keyof typeof SIZE_CONFIG;
  tone?: "opportunity" | "quality";
  label?: string;
  className?: string;
}) {
  const { box, stroke, text, label: labelClass } = SIZE_CONFIG[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score ?? 0;
  const offset = circumference * (1 - value / 100);

  return (
    <div className={cn("relative inline-flex flex-col items-center justify-center", className)}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        {score !== null && (
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn("transition-[stroke-dashoffset] duration-500", tierColor(value, tone))}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={cn("font-heading font-semibold tabular-nums", text)}>{score ?? "—"}</span>
        {label && <span className={cn("text-muted-foreground", labelClass)}>{label}</span>}
      </div>
    </div>
  );
}
