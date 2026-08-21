"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateSearchInput } from "@/lib/lead-discovery-types";

const BUSINESS_TYPE_SUGGESTIONS = [
  "Salon",
  "Beauty Salon",
  "Restaurant",
  "Dental Clinic",
  "Gym",
  "Hotel",
  "Real Estate Agency",
  "Clothing Store",
  "Cafe",
  "E-commerce Business",
];

const LOCATION_SUGGESTIONS = [
  "Banani, Dhaka",
  "Gulshan, Dhaka",
  "Dhanmondi, Dhaka",
  "Uttara, Dhaka",
];

const RADIUS_OPTIONS = [
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10_000 },
  { label: "20 km", value: 20_000 },
];

export function SearchForm({
  onSubmit,
  isSubmitting,
  defaultQuery = "",
  defaultLocation = "",
}: {
  onSubmit: (input: Pick<CreateSearchInput, "query" | "location" | "radiusMeters">) => void;
  isSubmitting: boolean;
  defaultQuery?: string;
  defaultLocation?: string;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [location, setLocation] = useState(defaultLocation);
  const [radiusMeters, setRadiusMeters] = useState(5000);

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!query.trim() || !location.trim()) return;
        onSubmit({ query: query.trim(), location: location.trim(), radiusMeters });
      }}
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="find-query">Business type</Label>
        <Input
          id="find-query"
          placeholder="e.g. Dental Clinic"
          list="business-type-suggestions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
        />
        <datalist id="business-type-suggestions">
          {BUSINESS_TYPE_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="find-location">Location</Label>
        <Input
          id="find-location"
          placeholder="e.g. Banani, Dhaka"
          list="location-suggestions"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />
        <datalist id="location-suggestions">
          {LOCATION_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="find-radius">Radius</Label>
        <Select value={String(radiusMeters)} onValueChange={(v) => setRadiusMeters(Number(v))}>
          <SelectTrigger id="find-radius" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isSubmitting} className="gap-2">
        <Search className="size-4" />
        {isSubmitting ? "Searching…" : "Search"}
      </Button>
    </form>
  );
}
