import { MousePointerClick } from "lucide-react";
import { SectionCard } from "../section-card";
import { ScoreRing } from "../score-ring";
import { BreakdownChecklist } from "../breakdown-checklist";
import type { ConversionAuditView } from "@/lib/digital-intelligence-types";

export function ConversionSection({ conversion, hasWebsite }: { conversion: ConversionAuditView; hasWebsite: boolean }) {
  return (
    <SectionCard title="Conversion" icon={MousePointerClick}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Contactability</p>
          <div className="flex items-start gap-4">
            <ScoreRing score={conversion.contactability.score} size="md" label="/100" />
            <div className="flex-1">
              <BreakdownChecklist breakdown={conversion.contactability.breakdown} />
            </div>
          </div>
        </div>

        {hasWebsite && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">On-site conversion path</p>
            {conversion.breakdown ? (
              <div className="flex items-start gap-4">
                <ScoreRing score={conversion.score} size="md" label="/100" />
                <div className="flex-1">
                  <BreakdownChecklist breakdown={conversion.breakdown} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not audited yet — run Enrich to check.</p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
