import type { ContactSource, LeadEnrichment } from "./lead-enrichment-types";

export type ContactChannelKey =
  | "PHONE"
  | "EMAIL"
  | "WEBSITE"
  | "BOOKING"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "LINKEDIN";

export interface ContactChannel {
  key: ContactChannelKey;
  label: string;
  value: string | null;
  verified: boolean;
  /** Human-readable provenance. Null only when there's no value to attribute. */
  source: string | null;
  openHref: string | null;
}

const SOURCE_LABELS: Record<ContactSource, string> = {
  GOOGLE_PLACES: "Google",
  WEBSITE: "Website",
  MANUAL: "Manual",
};

const CHANNEL_LABELS: Record<ContactChannelKey, string> = {
  PHONE: "Phone",
  EMAIL: "Email",
  WEBSITE: "Website",
  BOOKING: "Booking",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
};

/**
 * Merges the lead's on-file phone/email/website with LeadContact/
 * LeadSocialProfile rows into one normalized row per channel for the
 * ContactInfoPanel. A value can be "on file" (from Google Places at
 * discovery time, or entered manually) without a matching LeadContact
 * row — that's shown as unverified with source "On file" rather than
 * fabricating a source we can't actually trace.
 */
export function buildContactChannels(enrichment: LeadEnrichment): ContactChannel[] {
  const { contacts, socialProfiles, website } = enrichment;

  const phoneContact = contacts.find((c) => c.type === "PHONE");
  const emailContact = contacts.find((c) => c.type === "EMAIL");
  const bookingContact = contacts.find((c) => c.type === "BOOKING_URL");

  const channels: ContactChannel[] = [
    onFileChannel("PHONE", enrichment.phone, phoneContact?.source, phoneContact?.verified, (v) => `tel:${v}`),
    onFileChannel("EMAIL", enrichment.email, emailContact?.source, emailContact?.verified, (v) => `mailto:${v}`),
    {
      key: "WEBSITE",
      label: CHANNEL_LABELS.WEBSITE,
      value: enrichment.websiteUrl,
      verified: website?.isReachable === true,
      source: enrichment.websiteUrl ? (website ? "Website" : "On file") : null,
      openHref: enrichment.websiteUrl,
    },
    onFileChannel("BOOKING", bookingContact?.value ?? null, bookingContact?.source, bookingContact?.verified, (v) => v),
  ];

  for (const key of ["FACEBOOK", "INSTAGRAM", "LINKEDIN"] as const) {
    const profile = socialProfiles.find((s) => s.platform === key);
    channels.push({
      key,
      label: CHANNEL_LABELS[key],
      value: profile?.url ?? null,
      verified: !!profile,
      source: profile ? "Website" : null,
      openHref: profile?.url ?? null,
    });
  }

  return channels;
}

function onFileChannel(
  key: ContactChannelKey,
  value: string | null,
  contactSource: ContactSource | undefined,
  contactVerified: boolean | undefined,
  toHref: (value: string) => string,
): ContactChannel {
  return {
    key,
    label: CHANNEL_LABELS[key],
    value,
    verified: contactVerified ?? false,
    source: value ? (contactSource ? SOURCE_LABELS[contactSource] : "On file") : null,
    openHref: value ? toHref(value) : null,
  };
}
