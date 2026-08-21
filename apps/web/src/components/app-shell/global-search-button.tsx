"use client";

import { Search } from "lucide-react";
import { useCommandPaletteStore } from "@/stores/command-palette-store";

export function GlobalSearchButton() {
  const toggle = useCommandPaletteStore((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-input/30 dark:hover:bg-input/50"
      aria-label="Open search and command palette"
    >
      <Search className="size-4 shrink-0" />
      <span className="hidden truncate sm:inline">Search or jump to…</span>
      <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
