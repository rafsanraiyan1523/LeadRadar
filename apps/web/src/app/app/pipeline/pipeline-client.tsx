"use client";

import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { usePipeline } from "@/hooks/use-crm";

export function PipelineClient() {
  const { data, isLoading, isError } = usePipeline();

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Drag a lead between stages, or open it to update tags, notes, and follow-ups.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 gap-3 overflow-x-auto px-4 py-4 sm:px-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-full w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the pipeline. Try refreshing.</p>
        </div>
      ) : (
        <KanbanBoard leads={data.items} />
      )}
    </div>
  );
}
