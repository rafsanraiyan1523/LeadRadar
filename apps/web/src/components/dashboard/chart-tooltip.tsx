import { cn } from "@/lib/utils";

interface TooltipPayloadItem {
  color?: string;
  name?: string;
  value?: number | string;
}

/**
 * Shared Recharts tooltip content — value leads (bold), label follows
 * (muted), each series keyed with a short color line rather than a filled
 * box, per the dataviz skill's tooltip anatomy.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  formatter,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  formatter?: (value: number | string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && (
        <p className="mb-1 font-medium text-foreground">{label}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {item.color && (
              <span
                className="h-0.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className="font-semibold tabular-nums text-foreground">
              {item.value !== undefined
                ? formatter
                  ? formatter(item.value)
                  : item.value
                : "—"}
            </span>
            {item.name && <span className="text-muted-foreground">{item.name}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function chartAxisTick(className?: string) {
  return { fontSize: 11, className: cn("fill-muted-foreground", className) };
}
