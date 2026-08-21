"use client";

import { Bookmark, Download, ScanSearch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function BulkActionsBar({
  count,
  onClear,
  onSave,
  isSaving,
}: {
  count: number;
  onClear: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5">
          <Bookmark className="size-3.5" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" disabled className="gap-1.5">
                <ScanSearch className="size-3.5" />
                Bulk audit
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" disabled className="gap-1.5">
                <Download className="size-3.5" />
                Export
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
