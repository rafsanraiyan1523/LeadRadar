"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAttachTag, useDetachTag, useLeadTags } from "@/hooks/use-crm";
import { ApiError } from "@/lib/api-error";
import { PRESET_TAGS } from "@/lib/pipeline-config";

export function LeadTagsEditor({ leadId }: { leadId: string }) {
  const { data: tags } = useLeadTags(leadId);
  const attachTag = useAttachTag(leadId);
  const detachTag = useDetachTag(leadId);
  const [customName, setCustomName] = useState("");
  const [open, setOpen] = useState(false);

  const current = tags ?? [];
  const currentNames = new Set(current.map((t) => t.name));

  function attach(name: string, color?: string) {
    attachTag.mutate(
      { name, color },
      {
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Couldn't add that tag");
        },
      },
    );
  }

  function handleAddCustom() {
    const name = customName.trim();
    if (!name) return;
    attach(name);
    setCustomName("");
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="gap-1 border-transparent pr-1"
          style={tag.color ? { backgroundColor: `${tag.color}1a`, color: tag.color } : undefined}
        >
          {tag.name}
          <button
            type="button"
            onClick={() => detachTag.mutate(tag.id)}
            className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            aria-label={`Remove ${tag.name} tag`}
          >
            <X className="size-2.5" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 gap-1 rounded-full px-2 text-xs">
            <Plus className="size-3" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TAGS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                disabled={currentNames.has(preset.name)}
                onClick={() => attach(preset.name, preset.color)}
                className="rounded-full px-2 py-0.5 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: `${preset.color}1a`, color: preset.color }}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <p className="pt-1 text-xs font-medium text-muted-foreground">Custom tag</p>
          <div className="flex gap-1.5">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
              placeholder="e.g. Referral partner"
              className="h-7 text-xs"
            />
            <Button size="sm" className="h-7" onClick={handleAddCustom} disabled={!customName.trim()}>
              Add
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
