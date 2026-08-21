"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, CalendarClock, History, StickyNote, Tags, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LeadCardContent } from "./lead-card-content";
import { LeadStatusSelect } from "./lead-status-select";
import { LeadTagsEditor } from "./lead-tags-editor";
import { LeadNotesPanel } from "./lead-notes-panel";
import { LeadFollowUpsPanel } from "./lead-follow-ups-panel";
import { LeadActivityTimeline } from "./lead-activity-timeline";
import { useSaveLead, useUnsaveLead } from "@/hooks/use-crm";
import { ApiError } from "@/lib/api-error";
import type { LeadCardView } from "@/lib/crm-types";

function SheetSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof StickyNote;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-3.5 text-muted-foreground" />
        {title}
      </div>
      {children}
    </div>
  );
}

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  bookmarked,
}: {
  lead: LeadCardView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass when the caller already knows bookmark state (e.g. /app/saved) — otherwise the toggle is a plain save action. */
  bookmarked?: boolean;
}) {
  const saveLead = useSaveLead();
  const unsaveLead = useUnsaveLead();

  if (!lead) return null;

  function handleToggleSave() {
    if (!lead) return;
    const mutation = bookmarked ? unsaveLead : saveLead;
    mutation.mutate(lead.id, {
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : "Couldn't update your saved leads");
      },
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{lead.businessName}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          <LeadCardContent lead={lead} />

          <div className="flex items-center gap-2">
            <Button
              variant={bookmarked ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={handleToggleSave}
              disabled={saveLead.isPending || unsaveLead.isPending}
            >
              {bookmarked ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
              {bookmarked ? "Saved" : "Save"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href={`/app/leads/${lead.id}`}>
                <BarChart3 className="size-3.5" />
                Full audit
              </Link>
            </Button>
          </div>

          <LeadStatusSelect leadId={lead.id} status={lead.leadStatus} />

          <Separator />

          <SheetSection icon={Tags} title="Tags">
            <LeadTagsEditor leadId={lead.id} />
          </SheetSection>

          <Separator />

          <SheetSection icon={StickyNote} title="Notes">
            <LeadNotesPanel leadId={lead.id} />
          </SheetSection>

          <Separator />

          <SheetSection icon={CalendarClock} title="Follow-ups">
            <LeadFollowUpsPanel leadId={lead.id} />
          </SheetSection>

          <Separator />

          <SheetSection icon={History} title="Activity">
            <LeadActivityTimeline leadId={lead.id} />
          </SheetSection>
        </div>
      </SheetContent>
    </Sheet>
  );
}
