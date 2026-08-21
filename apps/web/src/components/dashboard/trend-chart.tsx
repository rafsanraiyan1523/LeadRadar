"use client";

import { useTheme } from "next-themes";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartPrimary } from "@/lib/chart-colors";
import { ChartTooltip } from "./chart-tooltip";

export function TrendChart({ data }: { data: { date: string; count: number }[] }) {
  const { resolvedTheme } = useTheme();
  const color = useChartPrimary(resolvedTheme === "dark");

  if (data.length < 2) {
    const total = data.reduce((sum, d) => sum + d.count, 0);
    return (
      <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center">
        <p className="font-heading text-2xl font-semibold tabular-nums">{total}</p>
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "No leads discovered yet" : "All discovered so far, in one day"}
        </p>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" vertical={false} className="stroke-border" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          minTickGap={24}
        />
        <YAxis hide />
        <Tooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          name="New leads"
          stroke={color}
          strokeWidth={2}
          fill="url(#trendFill)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
