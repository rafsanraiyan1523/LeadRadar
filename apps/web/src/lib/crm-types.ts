export type LeadStatus =
  | "NEW"
  | "SAVED"
  | "CONTACTED"
  | "REPLIED"
  | "INTERESTED"
  | "MEETING"
  | "PROPOSAL"
  | "WON"
  | "LOST";

export type WebsiteState = "NO_WEBSITE" | "UNAUDITED" | "WEAK" | "AVERAGE" | "STRONG";

export type GoogleProfileStatus = "FOUND" | "NOT_FOUND_IN_CURRENT_SEARCH" | "UNVERIFIED";

export interface LeadCardTag {
  id: string;
  name: string;
  color: string | null;
}

export interface LeadCardActivity {
  type: string;
  createdAt: string;
}

export interface LeadCardFollowUp {
  id: string;
  dueAt: string;
  note: string | null;
}

export interface LeadCardView {
  id: string;
  businessName: string;
  category: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  leadStatus: LeadStatus;
  opportunityScore: number | null;
  contactabilityScore: number;
  websiteState: WebsiteState;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  googleProfileStatus: GoogleProfileStatus;
  tags: LeadCardTag[];
  lastActivity: LeadCardActivity | null;
  nextFollowUp: LeadCardFollowUp | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedLeadCards {
  items: LeadCardView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PipelineResponse {
  items: LeadCardView[];
}

export interface ListLeadsFilters {
  page?: number;
  pageSize?: number;
  status?: LeadStatus;
  category?: string;
  location?: string;
  minScore?: number;
  maxScore?: number;
  website?: "ANY" | "HAS_WEBSITE" | "NO_WEBSITE";
  googleProfile?: "ANY" | "FOUND" | "NOT_FOUND_IN_CURRENT_SEARCH" | "UNVERIFIED";
  minContactability?: number;
  /** Free-text business-name search. */
  search?: string;
}

export interface LeadActivityEntry {
  id: string;
  leadId: string;
  type: string;
  metadata: unknown;
  createdAt: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  type: "lead.note_added";
  metadata: { text: string };
  createdAt: string;
  user: { id: string; name: string } | null;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export type FollowUpStatus = "PENDING" | "DONE" | "CANCELLED";

export interface FollowUp {
  id: string;
  leadId: string;
  dueAt: string;
  note: string | null;
  status: FollowUpStatus;
  completedAt: string | null;
  createdAt: string;
}

export const CLIENT_LOGGABLE_ACTIVITY_TYPES = [
  "lead.message_copied",
  "lead.email_opened",
  "lead.whatsapp_opened",
  "lead.facebook_opened",
] as const;

export type ClientLoggableActivityType = (typeof CLIENT_LOGGABLE_ACTIVITY_TYPES)[number];
