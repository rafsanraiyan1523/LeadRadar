"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/format";
import {
  useCancelFollowUp,
  useCompleteFollowUp,
  useCreateFollowUp,
  useLeadFollowUps,
} from "@/hooks/use-crm";
import { ApiError } from "@/lib/api-error";

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LeadFollowUpsPanel({ leadId }: { leadId: string }) {
  const { data: followUps, isLoading } = useLeadFollowUps(leadId);
  const createFollowUp = useCreateFollowUp(leadId);
  const completeFollowUp = useCompleteFollowUp(leadId);
  const cancelFollowUp = useCancelFollowUp(leadId);

  const [dueAt, setDueAt] = useState(() => toDatetimeLocal(new Date(Date.now() + 86_400_000)));
  const [note, setNote] = useState("");

  function handleCreate() {
    if (!dueAt) return;
    createFollowUp.mutate(
      { dueAt: new Date(dueAt).toISOString(), note: note.trim() || undefined },
      {
        onSuccess: () => setNote(""),
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Couldn't schedule the follow-up");
        },
      },
    );
  }

  const pending = (followUps ?? []).filter((f) => f.status === "PENDING");
  const resolved = (followUps ?? []).filter((f) => f.status !== "PENDING");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5">
        <div className="flex gap-1.5">
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="text-xs"
          />
        </div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's this follow-up about?"
          className="text-xs"
        />
        <Button
          size="sm"
          className="self-end"
          onClick={handleCreate}
          disabled={!dueAt || createFollowUp.isPending}
        >
          Schedule follow-up
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading follow-ups…</p>
      ) : pending.length === 0 && resolved.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">No follow-ups scheduled.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...pending, ...resolved].map((followUp) => {
            const overdue = followUp.status === "PENDING" && isOverdue(followUp.dueAt);
            return (
              <li
                key={followUp.id}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-lg border p-2.5",
                  followUp.status === "PENDING"
                    ? overdue
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-border"
                    : "border-border/60 opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {new Date(followUp.dueAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {followUp.note && (
                    <p className="text-xs text-muted-foreground">{followUp.note}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {followUp.status === "PENDING"
                      ? overdue
                        ? "Overdue"
                        : "Pending"
                      : followUp.status === "DONE"
                        ? "Completed"
                        : "Cancelled"}
                  </p>
                </div>
                {followUp.status === "PENDING" && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => completeFollowUp.mutate(followUp.id)}
                      aria-label="Mark done"
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => cancelFollowUp.mutate(followUp.id)}
                      aria-label="Cancel"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
