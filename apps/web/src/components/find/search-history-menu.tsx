"use client";

import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSearchHistory } from "@/hooks/use-lead-discovery";

export function SearchHistoryMenu({ onOpenSearch }: { onOpenSearch: (searchId: string) => void }) {
  const { data } = useSearchHistory();
  const items = data?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <History className="size-4" />
          Recent searches
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Recent searches</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No searches yet</p>
        ) : (
          items.map((search) => (
            <DropdownMenuItem
              key={search.id}
              onClick={() => onOpenSearch(search.id)}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="text-sm font-medium">
                {search.query} · {search.location}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(search.createdAt).toLocaleString()} · {search.resultCount} results ·{" "}
                {search.providerMode === "MOCK" ? "Demo data" : "Live"}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
