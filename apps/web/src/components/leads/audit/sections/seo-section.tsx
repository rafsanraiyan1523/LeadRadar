import { Search } from "lucide-react";
import { SectionCard } from "../section-card";
import { ScoreRing } from "../score-ring";
import { BreakdownChecklist } from "../breakdown-checklist";
import type { SeoAuditView } from "@/lib/digital-intelligence-types";

export function SeoSection({ seo, hasWebsite }: { seo: SeoAuditView | null; hasWebsite: boolean }) {
  if (!hasWebsite) {
    return (
      <SectionCard title="SEO" icon={Search}>
        <p className="text-sm text-muted-foreground italic">No website to check SEO signals on.</p>
      </SectionCard>
    );
  }

  if (!seo || seo.breakdown === null) {
    return (
      <SectionCard title="SEO" icon={Search}>
        <p className="text-sm text-muted-foreground">Not audited yet — run Enrich to check SEO signals.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="SEO" icon={Search}>
      <div className="flex items-start gap-4">
        <ScoreRing score={seo.score} size="md" label="/100" />
        <div className="flex-1">
          <BreakdownChecklist breakdown={seo.breakdown} />
        </div>
      </div>
    </SectionCard>
  );
}
