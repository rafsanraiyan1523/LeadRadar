"use client";

import { useDraggable } from "@dnd-kit/core";
import { LeadCardContent } from "@/components/leads/lead-card-content";
import { cn } from "@/lib/utils";
import type { LeadCardView } from "@/lib/crm-types";

export function DraggableLeadCard({
  lead,
  onOpen,
}: {
  lead: LeadCardView;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn(
        "cursor-grab rounded-xl border border-border bg-card p-3 shadow-xs transition-shadow hover:shadow-sm active:cursor-grabbing",
        isDragging && "z-10 opacity-40",
      )}
    >
      <LeadCardContent lead={lead} />
    </div>
  );
}
