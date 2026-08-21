"use client";

import dynamic from "next/dynamic";
import type { SearchResult } from "@/lib/lead-discovery-types";
import { MockMap } from "./mock-map";

const LiveMap = dynamic(() => import("./live-map").then((m) => m.LiveMap), { ssr: false });

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function MapPanel({
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
  if (GOOGLE_MAPS_API_KEY) {
    return (
      <LiveMap
        apiKey={GOOGLE_MAPS_API_KEY}
        results={results}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    );
  }

  return (
    <MockMap
      results={results}
      selectedId={selectedId}
      hoveredId={hoveredId}
      onSelect={onSelect}
      onHover={onHover}
    />
  );
}
