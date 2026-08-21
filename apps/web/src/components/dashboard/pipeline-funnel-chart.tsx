"use client";

import { useTheme } from "next-themes";
import { SimpleBarChart } from "./simple-bar-chart";
import { statusColorsFor } from "@/lib/chart-colors";
import type { LeadStatus } from "@/lib/crm-types";
import type { ChartBucket } from "@/lib/analytics-types";

const LABEL_TO_STATUS: Record<string, LeadStatus> = {
  New: "SAVED",
  Contacted: "CONTACTED",
  Replied: "REPLIED",
  Interested: "INTERESTED",
  Meeting: "MEETING",
  Proposal: "PROPOSAL",
  Won: "WON",
  Lost: "LOST",
};

export function PipelineFunnelChart({ data }: { data: ChartBucket[] }) {
  const { resolvedTheme } = useTheme();
  const statusColors = statusColorsFor(resolvedTheme === "dark");
  const colors = data.map((d) => statusColors[LABEL_TO_STATUS[d.label] ?? "SAVED"]);
  return <SimpleBarChart data={data} colors={colors} orientation="bars" height={260} />;
}
