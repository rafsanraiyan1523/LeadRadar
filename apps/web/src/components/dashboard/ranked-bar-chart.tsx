"use client";

import { useTheme } from "next-themes";
import { SimpleBarChart } from "./simple-bar-chart";
import { useChartPrimary } from "@/lib/chart-colors";
import type { ChartBucket } from "@/lib/analytics-types";

/** Single-series horizontal ranking bar — used for Top Business Categories and Top Locations. */
export function RankedBarChart({ data }: { data: ChartBucket[] }) {
  const { resolvedTheme } = useTheme();
  const color = useChartPrimary(resolvedTheme === "dark");
  return (
    <SimpleBarChart
      data={data}
      colors={color}
      orientation="bars"
      height={Math.max(140, data.length * 32)}
    />
  );
}
