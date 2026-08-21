"use client";

import { BadgeCheck, Copy as CopyIcon, ExternalLink, Phone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "../section-card";
import type { LeadAuditResponse, LeadContactView } from "@/lib/digital-intelligence-types";

const SOURCE_LABELS: Record<LeadContactView["source"], string> = {
  GOOGLE_PLACES: "Google",
  WEBSITE: "Website",
  MANUAL: "Manual",
};

function findContact(contacts: LeadContactView[], type: LeadContactView["type"]) {
  return contacts.find((c) => c.type === type) ?? null;
}

export function ContactSection({ data }: { data: LeadAuditResponse }) {
  const { lead, contacts } = data;
  const phoneContact = findContact(contacts, "PHONE");
  const emailContact = findContact(contacts, "EMAIL");
  const bookingContact = findContact(contacts, "BOOKING_URL");

  const rows = [
    { label: "Phone", value: lead.phone, contact: phoneContact, href: lead.phone ? `tel:${lead.phone}` : null },
    { label: "Email", value: lead.email, contact: emailContact, href: lead.email ? `mailto:${lead.email}` : null },
    {
      label: "Booking",
      value: bookingContact?.value ?? null,
      contact: bookingContact,
      href: bookingContact?.value ?? null,
    },
  ];

  return (
    <SectionCard title="Contact" icon={Phone}>
      <div className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{row.label}</span>
                {row.contact?.verified && (
                  <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
                    <BadgeCheck className="size-3" />
                    Verified
                  </Badge>
                )}
              </div>
              {row.value ? (
                <p className="mt-0.5 truncate text-sm text-muted-foreground" title={row.value}>
                  {row.value}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground italic">Not found</p>
              )}
              {row.contact?.source && (
                <p className="mt-0.5 text-xs text-muted-foreground/70">Source: {SOURCE_LABELS[row.contact.source]}</p>
              )}
            </div>
            {row.href && (
              <a
                href={row.href}
                target={row.label === "Booking" ? "_blank" : undefined}
                rel={row.label === "Booking" ? "noreferrer" : undefined}
                aria-label={`Open ${row.label}`}
                className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        ))}
      </div>
      {lead.email && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(lead.email ?? "");
              toast.success("Email copied");
            } catch {
              toast.error("Couldn't copy to clipboard");
            }
          }}
          className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <CopyIcon className="size-3.5" />
          Copy email
        </button>
      )}
    </SectionCard>
  );
}
