"use client";

import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateLeadStatus } from "@/hooks/use-crm";
import { ApiError } from "@/lib/api-error";
import { PIPELINE_COLUMNS, columnForStatus } from "@/lib/pipeline-config";
import type { LeadStatus } from "@/lib/crm-types";

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const updateStatus = useUpdateLeadStatus();
  const currentColumn = columnForStatus(status);

  function handleChange(columnKey: string) {
    const column = PIPELINE_COLUMNS.find((c) => c.key === columnKey);
    if (!column) return;
    updateStatus.mutate(
      { leadId, status: column.dropStatus },
      {
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Couldn't update the status");
        },
      },
    );
  }

  return (
    <Select value={currentColumn.key} onValueChange={handleChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PIPELINE_COLUMNS.map((column) => (
          <SelectItem key={column.key} value={column.key}>
            {column.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
