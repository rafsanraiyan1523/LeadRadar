import { Button } from "@/components/ui/button";
import { AUDIT_ACTION_LABELS } from "@/lib/audit-log-types";
import type { PaginatedAuditLog } from "@/lib/audit-log-types";

export function AuditLogTable({
  data,
  isLoading,
  page,
  onPageChange,
  showActor,
}: {
  data: PaginatedAuditLog | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  /** Show the "who did this" column — only meaningful on the org-wide view; on "my activity" every row is already the viewer. */
  showActor?: boolean;
}) {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (!data || data.items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>;
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Event</th>
              {showActor && <th className="py-2 pr-3 font-medium">Who</th>}
              <th className="py-2 pr-3 font-medium">IP address</th>
              <th className="py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((entry) => (
              <tr key={entry.id} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 pr-3 font-medium">
                  {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                </td>
                {showActor && (
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {entry.user ? entry.user.name : "—"}
                  </td>
                )}
                <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                  {entry.ipAddress ?? "—"}
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
