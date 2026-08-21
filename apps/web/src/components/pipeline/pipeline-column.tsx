"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { DraggableLeadCard } from "./draggable-lead-card";
import type { PipelineColumn } from "@/lib/pipeline-config";
import type { LeadCardView } from "@/lib/crm-types";

export function PipelineColumnView({
  column,
  leads,
  onOpenLead,
}: {
  column: PipelineColumn;
  leads: LeadCardView[];
  onOpenLead: (lead: LeadCardView) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", column.dot)} />
          <h3 className={cn("text-sm font-semibold", column.headerText)}>{column.label}</h3>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{leads.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-b-xl px-2 pb-2 transition-colors",
          isOver && "bg-primary/[0.06] ring-1 ring-inset ring-primary/30",
        )}
      >
        {leads.length === 0 ? (
          <p className="px-1.5 py-6 text-center text-xs text-muted-foreground">No leads here</p>
        ) : (
          leads.map((lead) => (
            <DraggableLeadCard key={lead.id} lead={lead} onOpen={() => onOpenLead(lead)} />
          ))
        )}
      </div>
    </div>
  );
}
