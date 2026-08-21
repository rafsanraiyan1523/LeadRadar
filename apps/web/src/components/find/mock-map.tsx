"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/lead-discovery-types";

const VIEW_SIZE = 640;
const PADDING = 48;
const CLUSTER_RADIUS_PX = 22;

interface Projected {
  result: SearchResult;
  x: number;
  y: number;
}

interface Cluster {
  key: string;
  x: number;
  y: number;
  items: Projected[];
}

function project(results: SearchResult[]): Projected[] {
  const withCoords = results.filter(
    (r): r is SearchResult & { latitude: number; longitude: number } =>
      r.latitude !== null && r.longitude !== null,
  );
  if (withCoords.length === 0) return [];

  const lats = withCoords.map((r) => r.latitude);
  const lngs = withCoords.map((r) => r.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latSpan = Math.max(maxLat - minLat, 0.002);
  const lngSpan = Math.max(maxLng - minLng, 0.002);
  const usable = VIEW_SIZE - PADDING * 2;

  return withCoords.map((result) => {
    const x = PADDING + ((result.longitude - minLng) / lngSpan) * usable;
    // Latitude increases northward, SVG y increases downward — flip it.
    const y = PADDING + (1 - (result.latitude - minLat) / latSpan) * usable;
    return { result, x, y };
  });
}

function clusterPoints(points: Projected[]): Cluster[] {
  const clusters: Cluster[] = [];

  for (const point of points) {
    const nearby = clusters.find(
      (c) => Math.hypot(c.x - point.x, c.y - point.y) < CLUSTER_RADIUS_PX,
    );
    if (nearby) {
      nearby.items.push(point);
      nearby.x = nearby.items.reduce((sum, p) => sum + p.x, 0) / nearby.items.length;
      nearby.y = nearby.items.reduce((sum, p) => sum + p.y, 0) / nearby.items.length;
    } else {
      clusters.push({ key: point.result.id, x: point.x, y: point.y, items: [point] });
    }
  }

  return clusters;
}

export function MockMap({
  results,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  results: SearchResult[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const clusters = useMemo(() => clusterPoints(project(results)), [results]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-border bg-muted/40">
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="find-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" className="stroke-border" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={VIEW_SIZE} height={VIEW_SIZE} fill="url(#find-map-grid)" />

        {clusters.map((cluster) => {
          if (cluster.items.length > 1) {
            const isHovered = cluster.items.some((i) => i.result.id === hoveredId);
            return (
              <g
                key={cluster.key}
                transform={`translate(${cluster.x}, ${cluster.y})`}
                className="cursor-pointer"
                onClick={() => onSelect(cluster.items[0]!.result.id)}
              >
                <circle
                  r={16}
                  className={cn(
                    "fill-primary/90 stroke-background transition-all",
                    isHovered && "fill-primary",
                  )}
                  strokeWidth={2}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-primary-foreground text-[11px] font-semibold"
                >
                  {cluster.items.length}
                </text>
              </g>
            );
          }

          const point = cluster.items[0]!;
          const isSelected = point.result.id === selectedId;
          const isHovered = point.result.id === hoveredId;

          return (
            <g
              key={point.result.id}
              transform={`translate(${point.x}, ${point.y})`}
              className="cursor-pointer"
              onClick={() => onSelect(point.result.id)}
              onMouseEnter={() => onHover(point.result.id)}
              onMouseLeave={() => onHover(null)}
            >
              <circle
                r={isSelected || isHovered ? 9 : 6}
                className={cn(
                  "stroke-background transition-all",
                  isSelected ? "fill-primary" : "fill-foreground/70",
                )}
                strokeWidth={2}
              />
              {(isSelected || isHovered) && (
                <text
                  y={-16}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-medium"
                >
                  {point.result.businessName}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-sm bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
        Illustrative map — demo data
      </div>
    </div>
  );
}
