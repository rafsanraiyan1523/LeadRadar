import {
  CalendarCheck,
  CheckCircle2,
  Handshake,
  MailOpen,
  PhoneCall,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { MetricTile } from "./metric-tile";
import type { DashboardMetrics } from "@/lib/analytics-types";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function DashboardMetricsGrid({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricTile label="Total Leads" value={metrics.totalLeads.toLocaleString()} icon={Users} />
      <MetricTile
        label="High Opportunity"
        value={metrics.highOpportunity.toLocaleString()}
        icon={Sparkles}
        tone="accent"
      />
      <MetricTile label="Saved" value={metrics.saved.toLocaleString()} icon={CheckCircle2} />
      <MetricTile label="Contacted" value={metrics.contacted.toLocaleString()} icon={PhoneCall} />
      <MetricTile label="Replies" value={metrics.replies.toLocaleString()} icon={MailOpen} />
      <MetricTile label="Meetings" value={metrics.meetings.toLocaleString()} icon={CalendarCheck} />
      <MetricTile label="Won" value={metrics.won.toLocaleString()} icon={Handshake} tone="accent" />
      <MetricTile
        label="Conversion Rate"
        value={pct(metrics.conversionRate)}
        icon={TrendingUp}
        tone="accent"
      />
    </div>
  );
}
