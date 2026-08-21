import { ScoreRing } from "@/components/leads/audit/score-ring";

export function ScoreStatCard({
  label,
  score,
  detail,
}: {
  label: string;
  score: number | null;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <ScoreRing score={score} size="md" tone="quality" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail ?? "Across all matching leads"}</p>
      </div>
    </div>
  );
}
