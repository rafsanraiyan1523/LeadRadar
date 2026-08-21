import type { LeadStatus } from "./crm-types";
import type {
  OutreachChannel,
  OutreachLanguage,
  OutreachTone,
  RecommendedServiceType,
} from "./ai-types";

/** Mirrors the Prisma CampaignService enum — the same eight-service catalog as RecommendedServiceType. */
export type CampaignServiceType = RecommendedServiceType;

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
export type CampaignLeadStatus = "PENDING" | "SENT" | "RESPONDED";

export interface Campaign {
  id: string;
  organizationId: string;
  createdByUserId: string | null;
  name: string;
  description: string | null;
  targetCategory: string | null;
  targetLocation: string | null;
  service: CampaignServiceType;
  tone: OutreachTone;
  channel: OutreachChannel;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignListItem extends Campaign {
  leadCount: number;
  messageCount: number;
}

export interface CampaignLeadRow {
  id: string;
  businessName: string;
  category: string | null;
  city: string | null;
  opportunityScore: number | null;
  leadStatus: LeadStatus;
  websiteUrl: string | null;
  campaignLeadStatus: CampaignLeadStatus;
}

export interface CampaignDetail extends Campaign {
  leads: CampaignLeadRow[];
}

export interface CampaignDashboard {
  leads: number;
  messagesGenerated: number;
  contacted: number;
  replied: number;
  meetings: number;
  won: number;
  conversionRate: number;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  targetCategory?: string;
  targetLocation?: string;
  service: CampaignServiceType;
  tone: OutreachTone;
  channel: OutreachChannel;
  leadIds: string[];
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  targetCategory?: string;
  targetLocation?: string;
  service?: CampaignServiceType;
  tone?: OutreachTone;
  channel?: OutreachChannel;
  status?: CampaignStatus;
}

export interface GenerateCampaignMessagesResult {
  generated: number;
  failed: number;
  alreadyGenerated: number;
}

export const CAMPAIGN_SERVICE_OPTIONS: { value: CampaignServiceType; label: string }[] = [
  { value: "WEBSITE_DEVELOPMENT", label: "Website Development" },
  { value: "SEO", label: "SEO" },
  { value: "GOOGLE_BUSINESS_OPTIMIZATION", label: "Google Business Optimization" },
  { value: "ONLINE_BOOKING", label: "Online Booking" },
  { value: "ECOMMERCE", label: "E-commerce" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "PAID_ADS", label: "Paid Ads" },
  { value: "CUSTOM_SOFTWARE", label: "Custom Software" },
];

export type { OutreachChannel, OutreachLanguage, OutreachTone };
