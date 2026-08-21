"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PIPELINE_COLUMNS } from "@/lib/pipeline-config";
import type { ListLeadsFilters } from "@/lib/crm-types";

const SCORE_OPTIONS = [0, 33, 50, 66, 80];

function FilterFields({
  filters,
  onChange,
  onReset,
}: {
  filters: ListLeadsFilters;
  onChange: (patch: Partial<ListLeadsFilters>) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Status</Label>
        <Select
          value={filters.status ?? "ANY"}
          onValueChange={(v) => onChange({ status: v === "ANY" ? undefined : (v as ListLeadsFilters["status"]) })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">Any status</SelectItem>
            {PIPELINE_COLUMNS.map((c) => (
              <SelectItem key={c.dropStatus} value={c.dropStatus}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <Input
          value={filters.category ?? ""}
          onChange={(e) => onChange({ category: e.target.value || undefined })}
          placeholder="e.g. Restaurant"
          className="w-36"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Location</Label>
        <Input
          value={filters.location ?? ""}
          onChange={(e) => onChange({ location: e.target.value || undefined })}
          placeholder="e.g. Dhaka"
          className="w-36"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Min score</Label>
        <Select
          value={String(filters.minScore ?? 0)}
          onValueChange={(v) => onChange({ minScore: Number(v) || undefined })}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCORE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s === 0 ? "Any" : `${s}+`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Website</Label>
        <Select
          value={filters.website ?? "ANY"}
          onValueChange={(v) => onChange({ website: v as ListLeadsFilters["website"] })}
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
        <Label>Google profile</Label>
        <Select
          value={filters.googleProfile ?? "ANY"}
          onValueChange={(v) => onChange({ googleProfile: v as ListLeadsFilters["googleProfile"] })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">Any</SelectItem>
            <SelectItem value="FOUND">Found</SelectItem>
            <SelectItem value="NOT_FOUND_IN_CURRENT_SEARCH">Not found</SelectItem>
            <SelectItem value="UNVERIFIED">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Min contactability</Label>
        <Select
          value={String(filters.minContactability ?? 0)}
          onValueChange={(v) => onChange({ minContactability: Number(v) || undefined })}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCORE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s === 0 ? "Any" : `${s}+`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
        Reset filters
      </Button>
    </div>
  );
}

export function LeadsFilterBar(props: {
  filters: ListLeadsFilters;
  onChange: (patch: Partial<ListLeadsFilters>) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="hidden md:block">
        <FilterFields {...props} />
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
              <FilterFields {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
