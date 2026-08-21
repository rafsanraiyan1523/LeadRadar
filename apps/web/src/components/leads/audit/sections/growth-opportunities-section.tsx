import { TrendingUp } from "lucide-react";
import { SectionCard } from "../section-card";
import { GrowthOpportunityItem } from "../growth-opportunity-item";
import type { GrowthOpportunityView } from "@/lib/digital-intelligence-types";

export function GrowthOpportunitiesSection({ findings }: { findings: GrowthOpportunityView[] }) {
  return (
    <SectionCard title="Growth Opportunities" icon={TrendingUp}>
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No growth opportunities identified yet — run Enrich to generate findings.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {findings.map((finding) => (
            <GrowthOpportunityItem key={finding.id} finding={finding} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
