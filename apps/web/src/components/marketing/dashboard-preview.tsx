import { LogoMark } from "@lead-radar/ui";

const NAV_LABELS = ["Overview", "Find Leads", "Pipeline", "Analytics"];
const FUNNEL = [
  { label: "New", value: 100 },
  { label: "Contacted", value: 74 },
  { label: "Replied", value: 46 },
  { label: "Meeting", value: 22 },
  { label: "Won", value: 11 },
];
const TREND = [22, 34, 28, 45, 40, 58, 51, 66, 60, 78, 72, 90];

/**
 * A purely illustrative static mockup of the real dashboard — not a live
 * component and not wired to any data. Built from the app's own tokens so
 * it reads as an honest preview of the real product rather than a generic
 * stock screenshot.
 */
export function DashboardPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-3xl"
      />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/40">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-3">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-3 truncate text-xs text-muted-foreground">app.leadradar.io</span>
        </div>

        <div className="flex">
          {/* sidebar sliver */}
          <div className="hidden w-40 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-3 sm:flex">
            <div className="mb-3 flex items-center gap-1.5 px-1">
              <LogoMark size={16} className="text-primary" />
              <span className="text-xs font-semibold">LeadRadar</span>
            </div>
            {NAV_LABELS.map((label, i) => (
              <div
                key={label}
                className={`rounded-md px-2 py-1.5 text-[11px] ${
                  i === 0
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* content */}
          <div className="flex-1 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Good morning, Alex.</p>
                <p className="text-xs text-muted-foreground">Find your next client.</p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-4 gap-2">
              {[
                { label: "Total Leads", value: "312" },
                { label: "High Opportunity", value: "58" },
                { label: "Contacted", value: "94" },
                { label: "Conversion", value: "18%" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border p-2">
                  <p className="truncate text-[9px] text-muted-foreground">{stat.label}</p>
                  <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3 rounded-lg border border-border p-3">
                <p className="mb-2 text-[10px] font-medium text-muted-foreground">
                  Lead Discovery Trend
                </p>
                <svg viewBox="0 0 220 60" className="h-14 w-full overflow-visible">
                  <polyline
                    points={TREND.map((v, i) => `${i * 20},${60 - v * 0.6}`).join(" ")}
                    fill="none"
                    className="stroke-primary"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="col-span-2 rounded-lg border border-border p-3">
                <p className="mb-2 text-[10px] font-medium text-muted-foreground">Pipeline Funnel</p>
                <div className="flex flex-col gap-1">
                  {FUNNEL.map((stage) => (
                    <div key={stage.label} className="flex items-center gap-1.5">
                      <span className="w-10 shrink-0 text-[8px] text-muted-foreground">
                        {stage.label}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${stage.value}%` }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
