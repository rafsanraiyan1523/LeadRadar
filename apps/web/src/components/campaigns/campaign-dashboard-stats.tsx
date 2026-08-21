import { CalendarCheck, Handshake, MailOpen, MessageSquare, PhoneCall, TrendingUp, Users } from "lucide-react";
import { MetricTile } from "@/components/dashboard/metric-tile";
import type { CampaignDashboard } from "@/lib/campaign-types";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function CampaignDashboardStats({ stats }: { stats: CampaignDashboard }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricTile label="Leads" value={stats.leads.toLocaleString()} icon={Users} />
      <MetricTile
        label="Messages Generated"
        value={stats.messagesGenerated.toLocaleString()}
        icon={MessageSquare}
      />
      <MetricTile label="Contacted" value={stats.contacted.toLocaleString()} icon={PhoneCall} />
      <MetricTile label="Replied" value={stats.replied.toLocaleString()} icon={MailOpen} />
      <MetricTile label="Meetings" value={stats.meetings.toLocaleString()} icon={CalendarCheck} />
      <MetricTile label="Won" value={stats.won.toLocaleString()} icon={Handshake} tone="accent" />
      <MetricTile
        label="Conversion Rate"
        value={pct(stats.conversionRate)}
        icon={TrendingUp}
        tone="accent"
      />
    </div>
  );
}
