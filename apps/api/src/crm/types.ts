import type { GoogleProfileStatus, LeadStatus } from '@lead-radar/db';

/**
 * Derived from the lead's own websiteUrl plus its latest WebsiteAudit.websiteScore
 * — never a separate stored field, so it can never drift from those two sources.
 */
export type WebsiteState =
  'NO_WEBSITE' | 'UNAUDITED' | 'WEAK' | 'AVERAGE' | 'STRONG';

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

/** The one shape the pipeline board, the leads list, and the saved-leads list all render. */
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
