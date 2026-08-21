"use client";

import { useTheme } from "next-themes";
import { SimpleBarChart } from "./simple-bar-chart";
import { statusColorsFor } from "@/lib/chart-colors";
import type { LeadStatus } from "@/lib/crm-types";

const RAW_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  SAVED: "Saved",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  MEETING: "Meeting",
  PROPOSAL: "Proposal",
  WON: "Won",
  LOST: "Lost",
};

export function LeadStatusChart({ data }: { data: { status: LeadStatus; count: number }[] }) {
  const { resolvedTheme } = useTheme();
  const statusColors = statusColorsFor(resolvedTheme === "dark");
  const visible = data.filter((d) => d.count > 0 || d.status === "SAVED");
  const rows = visible.map((d) => ({ label: RAW_STATUS_LABELS[d.status], count: d.count }));
  const colors = visible.map((d) => statusColors[d.status]);

  return <SimpleBarChart data={rows} colors={colors} orientation="bars" height={280} />;
}
