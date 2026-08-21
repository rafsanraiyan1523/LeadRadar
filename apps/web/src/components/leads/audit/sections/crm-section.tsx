import { forwardRef } from "react";
import { CalendarClock, StickyNote, Tags } from "lucide-react";
import { SectionCard } from "../section-card";
import { Separator } from "@/components/ui/separator";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { LeadTagsEditor } from "@/components/leads/lead-tags-editor";
import { LeadNotesPanel } from "@/components/leads/lead-notes-panel";
import { LeadFollowUpsPanel } from "@/components/leads/lead-follow-ups-panel";
import type { LeadStatus } from "@/lib/crm-types";

/** The pipeline/CRM controls (status, tags, notes, follow-ups) — reuses the same panels the pipeline's LeadDetailSheet uses, so the audit page and the pipeline board never drift into two different note/tag experiences. */
export const CrmSection = forwardRef<HTMLDivElement, { leadId: string; status: LeadStatus }>(
  function CrmSection({ leadId, status }, ref) {
    return (
      <div ref={ref}>
        <SectionCard title="Pipeline & CRM" icon={Tags}>
          <LeadStatusSelect leadId={leadId} status={status} />

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Tags className="size-3.5 text-muted-foreground" />
              Tags
            </div>
            <LeadTagsEditor leadId={leadId} />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <StickyNote className="size-3.5 text-muted-foreground" />
              Notes
            </div>
            <LeadNotesPanel leadId={leadId} />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarClock className="size-3.5 text-muted-foreground" />
              Follow-ups
            </div>
            <LeadFollowUpsPanel leadId={leadId} />
          </div>
        </SectionCard>
      </div>
    );
  },
);
