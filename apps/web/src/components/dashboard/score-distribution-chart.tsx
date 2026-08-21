"use client";

import { useTheme } from "next-themes";
import { SimpleBarChart } from "./simple-bar-chart";
import { scoreRampFor } from "@/lib/chart-colors";
import type { ChartBucket } from "@/lib/analytics-types";

/** The 5 ordinal score buckets (0-20 … 81-100, plus "Not scored") rendered light→dark by bucket order — used for both Opportunity Distribution and the Contactability distribution. */
export function ScoreDistributionChart({ data }: { data: ChartBucket[] }) {
  const { resolvedTheme } = useTheme();
  const ramp = scoreRampFor(resolvedTheme === "dark");
  const NOT_SCORED_COLOR = resolvedTheme === "dark" ? "#3f3f46" : "#d4d4d8";
  const colors = data.map((d, i) => (d.label === "Not scored" ? NOT_SCORED_COLOR : ramp[i] ?? ramp.at(-1)!));

  return <SimpleBarChart data={data} colors={colors} orientation="columns" height={200} />;
}
