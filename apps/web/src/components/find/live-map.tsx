"use client";

import { useEffect, useRef } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { SearchResult } from "@/lib/lead-discovery-types";

let optionsSet = false;

/**
 * Real Google Maps JS API rendering — only mounted when
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured (see map-panel.tsx). The
 * map itself renders Google's own attribution/logo, satisfying the
 * "proper Google attribution" requirement without any extra markup here.
 */
export function LiveMap({
  apiKey,
  results,
  selectedId,
  onSelect,
}: {
  apiKey: string;
  results: SearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  useEffect(() => {
    // Read the ref synchronously up front — by the time the async loader
    // work below resolves (or this effect's cleanup runs), `.current`
    // could otherwise have moved on to a different Map instance.
    const markers = markersRef.current;
    let cancelled = false;

    if (!optionsSet) {
      setOptions({ key: apiKey, v: "weekly" });
      optionsSet = true;
    }

    void importLibrary("maps").then(async ({ Map }) => {
      if (cancelled || !containerRef.current) return;
      const { AdvancedMarkerElement } = await importLibrary("marker");

      mapRef.current = new Map(containerRef.current, {
        center: { lat: 23.7808, lng: 90.4074 },
        zoom: 13,
        mapId: "LEADRADAR_FIND_MAP",
      });

      for (const result of results) {
        if (result.latitude === null || result.longitude === null) continue;
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: result.latitude, lng: result.longitude },
          title: result.businessName,
        });
        marker.addListener("click", () => onSelect(result.id));
        markers.set(result.id, marker);
      }
    });

    return () => {
      cancelled = true;
      markers.forEach((marker) => (marker.map = null));
      markers.clear();
    };
    // Markers are rebuilt whenever the result set changes; selection is
    // handled separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, results]);

  useEffect(() => {
    if (!selectedId) return;
    const marker = markersRef.current.get(selectedId);
    const position = marker?.position;
    if (position && mapRef.current) {
      mapRef.current.panTo(position);
    }
  }, [selectedId]);

  return <div ref={containerRef} className="h-full w-full rounded-md" />;
}
