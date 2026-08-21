"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useLeadsList } from "@/hooks/use-crm";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { NAV_ITEMS } from "./nav-items";

export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen, toggle } = useCommandPaletteStore();
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<"default" | "note">("default");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  function close() {
    setOpen(false);
    setQuery("");
    setIntent("default");
  }

  function go(href: string) {
    router.push(href);
    close();
  }

  const trimmed = query.trim();
  const searchActive = open && (intent === "note" || trimmed.length >= 2);
  const { data: leadResults, isFetching } = useLeadsList(
    { search: trimmed, pageSize: 6 },
    { enabled: searchActive },
  );
  const filteredNavItems = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(trimmed.toLowerCase()),
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setIntent("default");
        }
      }}
    >
      <CommandInput
        placeholder={intent === "note" ? "Search for a lead to add a note to…" : "Search leads or jump to a page…"}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searchActive && isFetching ? "Searching…" : "No results found."}
        </CommandEmpty>

        {searchActive && leadResults && leadResults.items.length > 0 && (
          <CommandGroup heading="Leads">
            {leadResults.items.map((lead) => (
              <CommandItem
                key={lead.id}
                value={`lead-${lead.id}-${lead.businessName}`}
                onSelect={() =>
                  go(intent === "note" ? `/app/leads/${lead.id}?openNotes=1` : `/app/leads/${lead.id}`)
                }
              >
                <span className="truncate">{lead.businessName}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {lead.category ?? "Business"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {intent === "default" && (
          <>
            {"create note".includes(trimmed.toLowerCase()) && (
              <CommandGroup heading="Actions">
                <CommandItem value="create note" onSelect={() => setIntent("note")}>
                  <NotebookPen />
                  Create Note
                </CommandItem>
              </CommandGroup>
            )}

            {filteredNavItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Navigate">
                  {filteredNavItems.map((item) => (
                    <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                      <item.icon />
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{intent === "note" ? "Pick a lead to add a note" : "Navigate with the arrow keys"}</span>
        <CommandShortcut className="ml-0 flex items-center gap-1">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans">Esc</kbd>
          to close
        </CommandShortcut>
      </div>
    </CommandDialog>
  );
}
