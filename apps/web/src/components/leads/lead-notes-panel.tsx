"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddNote, useLeadNotes } from "@/hooks/use-crm";
import { ApiError } from "@/lib/api-error";

export function LeadNotesPanel({ leadId }: { leadId: string }) {
  const { data: notes, isLoading } = useLeadNotes(leadId);
  const addNote = useAddNote(leadId);
  const [text, setText] = useState("");

  function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;
    addNote.mutate(trimmed, {
      onSuccess: () => setText(""),
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : "Couldn't save that note");
      },
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Owner replied. Asked for website pricing."
          rows={2}
          className="text-sm"
        />
        <Button
          size="sm"
          className="self-end"
          onClick={handleAdd}
          disabled={!text.trim() || addNote.isPending}
        >
          Add note
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading notes…</p>
      ) : !notes || notes.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">No notes yet — this is private to your team.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-border bg-muted/30 p-2.5">
              <p className="text-sm whitespace-pre-wrap">{note.metadata.text}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {note.user?.name ?? "Someone"} ·{" "}
                {new Date(note.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
