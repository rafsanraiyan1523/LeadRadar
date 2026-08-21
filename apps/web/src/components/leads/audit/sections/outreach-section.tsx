"use client";

import { useState } from "react";
import {
  Copy,
  Globe,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  RefreshCw,
  Reply,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SectionCard } from "../section-card";
import {
  useGenerateFollowUp,
  useGenerateOutreach,
  useOutreachMessages,
  useUpdateOutreachMessage,
} from "@/hooks/use-ai";
import { useLogActivity } from "@/hooks/use-crm";
import { ApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { OutreachChannel, OutreachLanguage, OutreachMessage, OutreachTone } from "@/lib/ai-types";

const CHANNEL_OPTIONS: { value: OutreachChannel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "SMS", label: "SMS" },
];
const TONE_OPTIONS: { value: OutreachTone; label: string }[] = [
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "FRIENDLY", label: "Friendly" },
  { value: "CONSULTATIVE", label: "Consultative" },
  { value: "SHORT", label: "Short" },
];
const LANGUAGE_OPTIONS: { value: OutreachLanguage; label: string }[] = [
  { value: "ENGLISH", label: "English" },
  { value: "BANGLA", label: "Bangla" },
  { value: "BANGLISH", label: "Banglish" },
];

function waNumber(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function OutreachSection({
  leadId,
  phone,
  email,
  websiteUrl,
  facebookUrl,
}: {
  leadId: string;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
}) {
  const { data: messages } = useOutreachMessages(leadId);
  const generateOutreach = useGenerateOutreach(leadId);
  const generateFollowUp = useGenerateFollowUp(leadId);
  const updateMessage = useUpdateOutreachMessage(leadId);
  const logActivity = useLogActivity(leadId);

  const [channel, setChannel] = useState<OutreachChannel>("EMAIL");
  const [tone, setTone] = useState<OutreachTone>("PROFESSIONAL");
  const [language, setLanguage] = useState<OutreachLanguage>("ENGLISH");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  // Tracks which message's content the two draft fields above currently
  // reflect, so switching to a different message (or the first load)
  // re-syncs them — adjusted directly during render (React's endorsed
  // alternative to an effect for "derive state from a prop/query change")
  // rather than via useEffect, since editing a fetched message's draft copy
  // isn't itself an effect on an external system.
  const [syncedId, setSyncedId] = useState<string | null>(null);

  const list = messages ?? [];
  const selected: OutreachMessage | undefined = list.find((m) => m.id === selectedId) ?? list[0];

  if (selected && selected.id !== syncedId) {
    setSyncedId(selected.id);
    setDraftSubject(selected.subject ?? "");
    setDraftBody(selected.body);
  }

  function handleGenerate() {
    generateOutreach.mutate(
      { channel, tone, language },
      {
        onSuccess: (message) => {
          setSelectedId(message.id);
          setIsEditing(false);
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Couldn't generate the message");
        },
      },
    );
  }

  function handleFollowUp() {
    if (!selected) return;
    generateFollowUp.mutate(
      { channel, tone, language, previousMessageId: selected.id },
      {
        onSuccess: (message) => {
          setSelectedId(message.id);
          setIsEditing(false);
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Couldn't generate the follow-up");
        },
      },
    );
  }

  async function handleCopy() {
    const text = selected?.channel === "EMAIL" && draftSubject ? `Subject: ${draftSubject}\n\n${draftBody}` : draftBody;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copied");
      logActivity.mutate({ type: "lead.message_copied" });
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  function handleSaveEdit() {
    if (!selected) return;
    updateMessage.mutate(
      { messageId: selected.id, subject: draftSubject, body: draftBody },
      {
        onSuccess: () => setIsEditing(false),
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Couldn't save your edits");
        },
      },
    );
  }

  function handleMarkSent() {
    if (!selected) return;
    updateMessage.mutate(
      { messageId: selected.id, status: "SENT" },
      {
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : "Couldn't update the message");
        },
      },
    );
  }

  const busy = generateOutreach.isPending || generateFollowUp.isPending;
  const mailtoHref = email
    ? `mailto:${email}?subject=${encodeURIComponent(draftSubject)}&body=${encodeURIComponent(draftBody)}`
    : null;
  const waHref = phone ? `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(draftBody)}` : null;

  return (
    <SectionCard title="Outreach" icon={Send}>
      <div className="grid grid-cols-3 gap-2">
        <Select value={channel} onValueChange={(v) => setChannel(v as OutreachChannel)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tone} onValueChange={(v) => setTone(v as OutreachTone)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={language} onValueChange={(v) => setLanguage(v as OutreachLanguage)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleGenerate} disabled={busy} className="flex-1 gap-1.5">
          {generateOutreach.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {list.length === 0 ? "Generate message" : "Regenerate"}
        </Button>
        {selected && (
          <Button size="sm" variant="outline" onClick={handleFollowUp} disabled={busy} className="gap-1.5">
            {generateFollowUp.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Reply className="size-3.5" />}
            Follow-up
          </Button>
        )}
      </div>

      {!selected ? (
        <p className="text-sm text-muted-foreground italic">
          No message generated yet — pick a channel, tone, and language above and generate one.
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline">{selected.kind === "FOLLOW_UP" ? "Follow-up" : "Outreach"}</Badge>
              <Badge variant={selected.status === "SENT" ? "default" : "secondary"}>{selected.status}</Badge>
            </div>
            {list.length > 1 && (
              <Select value={selected.id} onValueChange={(v) => { setSelectedId(v); setIsEditing(false); }}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {list.map((m, i) => (
                    <SelectItem key={m.id} value={m.id}>
                      {i === 0 ? "Latest" : new Date(m.createdAt).toLocaleDateString()} — {m.channel.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selected.channel === "EMAIL" &&
            (isEditing ? (
              <input
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                placeholder="Subject"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            ) : (
              draftSubject && <p className="text-sm font-medium">{draftSubject}</p>
            ))}

          {isEditing ? (
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-lg border border-input bg-transparent p-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{draftBody}</p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{draftBody.length} characters</span>
            <span>
              {selected.providerMode.toLowerCase()} · {selected.model}
            </span>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-1.5">
            {isEditing ? (
              <Button size="sm" onClick={handleSaveEdit} disabled={updateMessage.isPending}>
                Save
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-1.5">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
              <Copy className="size-3.5" />
              Copy
            </Button>
            {selected.status !== "SENT" && (
              <Button size="sm" variant="outline" onClick={handleMarkSent} disabled={updateMessage.isPending}>
                Mark sent
              </Button>
            )}

            <div className="ml-auto flex flex-wrap gap-1.5">
              <OpenChannelButton
                icon={Mail}
                label="Email"
                href={mailtoHref}
                onOpen={() => logActivity.mutate({ type: "lead.email_opened" })}
              />
              <OpenChannelButton
                icon={MessageCircle}
                label="WhatsApp"
                href={waHref}
                external
                onOpen={() => logActivity.mutate({ type: "lead.whatsapp_opened" })}
              />
              <OpenChannelButton
                icon={Link2}
                label="Facebook"
                href={facebookUrl}
                external
                onOpen={() => logActivity.mutate({ type: "lead.facebook_opened" })}
              />
              <OpenChannelButton icon={Globe} label="Website" href={websiteUrl} external />
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function OpenChannelButton({
  icon: Icon,
  label,
  href,
  external,
  onOpen,
}: {
  icon: typeof Mail;
  label: string;
  href: string | null;
  external?: boolean;
  onOpen?: () => void;
}) {
  return (
    <Button variant="ghost" size="icon" disabled={!href} asChild={!!href} title={href ? `Open ${label}` : `No ${label} on file`}>
      {href ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          onClick={onOpen}
        >
          <Icon className={cn("size-4")} />
        </a>
      ) : (
        <Icon className="size-4" />
      )}
    </Button>
  );
}
