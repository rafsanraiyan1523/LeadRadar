"use client";

import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { PipelineColumnView } from "./pipeline-column";
import { LeadCardContent } from "@/components/leads/lead-card-content";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import { useUpdateLeadStatus } from "@/hooks/use-crm";
import { PIPELINE_COLUMNS, columnForStatus } from "@/lib/pipeline-config";
import { ApiError } from "@/lib/api-error";
import type { LeadCardView, LeadStatus } from "@/lib/crm-types";

export function KanbanBoard({ leads }: { leads: LeadCardView[] }) {
  const [activeLead, setActiveLead] = useState<LeadCardView | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const updateStatus = useUpdateLeadStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, LeadCardView[]>(PIPELINE_COLUMNS.map((c) => [c.key, []]));
    for (const lead of leads) {
      const column = columnForStatus(lead.leadStatus);
      map.get(column.key)?.push(lead);
    }
    return map;
  }, [leads]);

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const leadId = event.active.id as string;
    const columnKey = event.over?.id as string | undefined;
    if (!columnKey) return;

    const lead = leads.find((l) => l.id === leadId);
    const column = PIPELINE_COLUMNS.find((c) => c.key === columnKey);
    if (!lead || !column || column.statuses.includes(lead.leadStatus)) return;

    updateStatus.mutate(
      { leadId, status: column.dropStatus as LeadStatus },
      {
        onError: (error) => {
          toast.error(
            error instanceof ApiError ? error.message : "Couldn't move this lead — try again",
          );
        },
      },
    );
  }

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto px-4 pb-4 sm:px-6">
          {PIPELINE_COLUMNS.map((column) => (
            <PipelineColumnView
              key={column.key}
              column={column}
              leads={grouped.get(column.key) ?? []}
              onOpenLead={(lead) => setOpenLeadId(lead.id)}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
          {activeLead && (
            <div className="w-72 rotate-2 rounded-xl border border-primary/40 bg-card p-3 shadow-lg">
              <LeadCardContent lead={activeLead} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <LeadDetailSheet
        lead={openLead}
        open={!!openLead}
        onOpenChange={(open) => !open && setOpenLeadId(null)}
      />
    </>
  );
}
