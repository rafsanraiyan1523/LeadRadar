import type { GeoPoint } from "@lead-radar/types";

export interface LocationTemplate {
  label: string;
  city: string;
  country: string;
  center: GeoPoint;
  /** Street/road name pool used to build plausible addresses for this area. */
  roadNames: string[];
}

// Real, publicly-known approximate neighborhood centers — used only to
// place synthetic demo businesses on a plausible map, not sourced from any
// scrape of business listings.
export const LOCATION_TEMPLATES: LocationTemplate[] = [
  {
    label: "Banani, Dhaka",
    city: "Dhaka",
    country: "Bangladesh",
    center: { latitude: 23.7936, longitude: 90.4066 },
    roadNames: ["Road 11", "Road 17", "Road 23", "Kemal Ataturk Avenue", "Road 27"],
  },
  {
    label: "Gulshan, Dhaka",
    city: "Dhaka",
    country: "Bangladesh",
    center: { latitude: 23.7925, longitude: 90.4078 },
    roadNames: ["Gulshan Avenue", "Road 11", "Road 46", "Road 79", "Road 103"],
  },
  {
    label: "Dhanmondi, Dhaka",
    city: "Dhaka",
    country: "Bangladesh",
    center: { latitude: 23.7461, longitude: 90.3742 },
    roadNames: ["Road 2", "Road 7", "Road 11", "Satmasjid Road", "Road 27"],
  },
  {
    label: "Uttara, Dhaka",
    city: "Dhaka",
    country: "Bangladesh",
    center: { latitude: 23.8759, longitude: 90.3795 },
    roadNames: [
      "Sector 7 Road",
      "Sector 11 Road",
      "Sector 4 Road",
      "Rabindra Sarani",
      "Sector 13 Road",
    ],
  },
];

const FALLBACK_CENTER: GeoPoint = { latitude: 23.7808, longitude: 90.4074 }; // Dhaka city center

export function resolveLocationTemplate(location: string): LocationTemplate {
  const normalized = location.trim().toLowerCase();
  const match = LOCATION_TEMPLATES.find((l) => l.label.toLowerCase() === normalized);
  if (match) {
    return match;
  }

  const partial = LOCATION_TEMPLATES.find((l) =>
    normalized.includes(l.label.split(",")[0]!.toLowerCase()),
  );
  if (partial) {
    return partial;
  }

  const [areaPart, cityPart] = location.split(",").map((s) => s.trim());
  return {
    label: location.trim() || "Dhaka",
    city: cityPart || areaPart || "Dhaka",
    country: "Bangladesh",
    center: FALLBACK_CENTER,
    roadNames: ["Main Road", "Central Avenue", "Market Road", "Station Road", "Circular Road"],
  };
}
