import { Loader2 } from "lucide-react";
import type { Search } from "@/lib/lead-discovery-types";

export function SearchProgress({ search }: { search: Search }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm font-medium">
        Searching for &ldquo;{search.query}&rdquo; near {search.location}…
      </p>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.max(search.progress, 5)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {search.providerMode === "MOCK" ? "Generating demo results" : "Querying Google Places"}
      </p>
    </div>
  );
}
