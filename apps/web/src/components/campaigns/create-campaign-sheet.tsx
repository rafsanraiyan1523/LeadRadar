"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CampaignLeadPicker } from "./campaign-lead-picker";
import { useCreateCampaign } from "@/hooks/use-campaigns";
import { ApiError } from "@/lib/api-error";
import { CAMPAIGN_SERVICE_OPTIONS } from "@/lib/campaign-types";
import type { CampaignServiceType, OutreachChannel, OutreachTone } from "@/lib/campaign-types";

const TONE_OPTIONS: { value: OutreachTone; label: string }[] = [
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "FRIENDLY", label: "Friendly" },
  { value: "CONSULTATIVE", label: "Consultative" },
  { value: "SHORT", label: "Short" },
];
const CHANNEL_OPTIONS: { value: OutreachChannel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "SMS", label: "SMS" },
];

export function CreateCampaignSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (campaignId: string) => void;
}) {
  const createCampaign = useCreateCampaign();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetCategory, setTargetCategory] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [service, setService] = useState<CampaignServiceType>("WEBSITE_DEVELOPMENT");
  const [tone, setTone] = useState<OutreachTone>("PROFESSIONAL");
  const [channel, setChannel] = useState<OutreachChannel>("EMAIL");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  function toggleLead(leadId: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function reset() {
    setName("");
    setDescription("");
    setTargetCategory("");
    setTargetLocation("");
    setService("WEBSITE_DEVELOPMENT");
    setTone("PROFESSIONAL");
    setChannel("EMAIL");
    setSelectedLeadIds(new Set());
  }

  function handleCreate() {
    if (!name.trim()) return;
    createCampaign.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        targetCategory: targetCategory.trim() || undefined,
        targetLocation: targetLocation.trim() || undefined,
        service,
        tone,
        channel,
        leadIds: Array.from(selectedLeadIds),
      },
      {
        onSuccess: (campaign) => {
          toast.success("Campaign created");
          onOpenChange(false);
          onCreated(campaign.id);
          reset();
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Couldn't create the campaign");
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New campaign</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dhaka Restaurants Q1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea
              id="campaign-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this campaign about?"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campaign-category">Target category</Label>
              <Input
                id="campaign-category"
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                placeholder="e.g. Restaurant"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campaign-location">Target location</Label>
              <Input
                id="campaign-location"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                placeholder="e.g. Dhaka"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Service</Label>
              <Select value={service} onValueChange={(v) => setService(v as CampaignServiceType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_SERVICE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as OutreachTone)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as OutreachChannel)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CampaignLeadPicker
            category={targetCategory}
            location={targetLocation}
            selected={selectedLeadIds}
            onToggle={toggleLead}
          />

          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createCampaign.isPending}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Create campaign
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
