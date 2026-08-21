"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

export interface SimpleBarDatum {
  label: string;
  count: number;
}

/**
 * One generic bar-chart primitive reused across the dashboard's category-
 * comparison charts (Opportunity/Contactability distribution, Pipeline
 * Funnel, Lead Status, Top Categories, Top Locations) — same mark spec
 * (thin bars, rounded data-end, hairline gridline, no dual axis) every
 * time. Each bar is axis-labeled, so color reinforces identity rather than
 * carrying it alone.
 */
export function SimpleBarChart({
  data,
  colors,
  orientation = "columns",
  height = 220,
  valueFormatter,
}: {
  data: SimpleBarDatum[];
  /** A single hex for every bar, or one hex per datum (same order/length as `data`). */
  colors: string | string[];
  orientation?: "columns" | "bars";
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const isHorizontalBars = orientation === "bars";
  const colorFor = (i: number) => (Array.isArray(colors) ? colors[i] : colors);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isHorizontalBars ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 8, bottom: 0, left: isHorizontalBars ? 8 : 0 }}
      >
        <CartesianGrid
          strokeDasharray="0"
          horizontal={!isHorizontalBars}
          vertical={isHorizontalBars}
          className="stroke-border"
        />
        {isHorizontalBars ? (
          <>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              interval={0}
              angle={data.length > 6 ? -25 : 0}
              textAnchor={data.length > 6 ? "end" : "middle"}
              height={data.length > 6 ? 40 : 24}
            />
            <YAxis hide />
          </>
        )}
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={<ChartTooltip formatter={(v) => (valueFormatter ? valueFormatter(Number(v)) : String(v))} />}
        />
        <Bar
          dataKey="count"
          radius={isHorizontalBars ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          maxBarSize={24}
          name="Leads"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colorFor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
