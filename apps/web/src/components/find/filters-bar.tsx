"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useFindFiltersStore } from "@/stores/find-filters-store";

const RATING_OPTIONS = [0, 3, 3.5, 4, 4.5];
const REVIEW_OPTIONS = [0, 10, 25, 50, 100];

function FilterFields() {
  const { filters, setFilter, reset } = useFindFiltersStore();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Min rating</Label>
        <Select
          value={String(filters.minRating)}
          onValueChange={(v) => setFilter("minRating", Number(v))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATING_OPTIONS.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r === 0 ? "Any" : `${r}+`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Min reviews</Label>
        <Select
          value={String(filters.minReviews)}
          onValueChange={(v) => setFilter("minReviews", Number(v))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REVIEW_OPTIONS.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r === 0 ? "Any" : `${r}+`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Website</Label>
        <Select
          value={filters.website}
          onValueChange={(v) => setFilter("website", v as typeof filters.website)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">Any</SelectItem>
            <SelectItem value="HAS_WEBSITE">Has website</SelectItem>
            <SelectItem value="NO_WEBSITE">No website</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Google presence</Label>
        <Select
          value={filters.googlePresence}
          onValueChange={(v) => setFilter("googlePresence", v as typeof filters.googlePresence)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">Any</SelectItem>
            <SelectItem value="FOUND">Found</SelectItem>
            <SelectItem value="NOT_VERIFIED">Not verified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Opportunity</Label>
        <Select
          value={filters.opportunity}
          onValueChange={(v) => setFilter("opportunity", v as typeof filters.opportunity)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">Any</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4 pb-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-low-reviews"
            checked={filters.lowReviews}
            onCheckedChange={(checked) => setFilter("lowReviews", checked === true)}
          />
          <Label htmlFor="filter-low-reviews" className="text-sm font-normal">
            Low reviews
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-weak-presence"
            checked={filters.weakDigitalPresence}
            onCheckedChange={(checked) => setFilter("weakDigitalPresence", checked === true)}
          />
          <Label htmlFor="filter-weak-presence" className="text-sm font-normal">
            Weak digital presence
          </Label>
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
        Reset filters
      </Button>
    </div>
  );
}

export function FiltersBar() {
  return (
    <>
      <div className="hidden md:block">
        <FilterFields />
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="size-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <FilterFields />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
