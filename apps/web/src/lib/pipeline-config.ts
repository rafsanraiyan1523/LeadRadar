import type { LeadStatus } from "./crm-types";

export interface PipelineColumn {
  key: string;
  label: string;
  /** Every status shown in this column. */
  statuses: LeadStatus[];
  /** The status a card is set to when dropped into this column. */
  dropStatus: LeadStatus;
  dot: string;
  headerText: string;
}

/**
 * "New" absorbs both NEW and SAVED — every lead enters the CRM already
 * SAVED (promoted from Find's bulk-save), and LeadStatus has no dedicated
 * "Saved" column in the spec's 8-column board, so SAVED is this board's
 * real starting state and NEW is folded into the same column for any lead
 * that ever gets created without going through Find.
 */
export const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    key: "NEW",
    label: "New",
    statuses: ["NEW", "SAVED"],
    dropStatus: "SAVED",
    dot: "bg-slate-400",
    headerText: "text-slate-600 dark:text-slate-300",
  },
  {
    key: "CONTACTED",
    label: "Contacted",
    statuses: ["CONTACTED"],
    dropStatus: "CONTACTED",
    dot: "bg-blue-500",
    headerText: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "REPLIED",
    label: "Replied",
    statuses: ["REPLIED"],
    dropStatus: "REPLIED",
    dot: "bg-violet-500",
    headerText: "text-violet-600 dark:text-violet-400",
  },
  {
    key: "INTERESTED",
    label: "Interested",
    statuses: ["INTERESTED"],
    dropStatus: "INTERESTED",
    dot: "bg-amber-500",
    headerText: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "MEETING",
    label: "Meeting",
    statuses: ["MEETING"],
    dropStatus: "MEETING",
    dot: "bg-cyan-500",
    headerText: "text-cyan-600 dark:text-cyan-400",
  },
  {
    key: "PROPOSAL",
    label: "Proposal",
    statuses: ["PROPOSAL"],
    dropStatus: "PROPOSAL",
    dot: "bg-orange-500",
    headerText: "text-orange-600 dark:text-orange-400",
  },
  {
    key: "WON",
    label: "Won",
    statuses: ["WON"],
    dropStatus: "WON",
    dot: "bg-emerald-500",
    headerText: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "LOST",
    label: "Lost",
    statuses: ["LOST"],
    dropStatus: "LOST",
    dot: "bg-rose-500",
    headerText: "text-rose-600 dark:text-rose-400",
  },
];

export function columnForStatus(status: LeadStatus): PipelineColumn {
  return PIPELINE_COLUMNS.find((c) => c.statuses.includes(status)) ?? PIPELINE_COLUMNS[0];
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  SAVED: "New",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  MEETING: "Meeting",
  PROPOSAL: "Proposal",
  WON: "Won",
  LOST: "Lost",
};

export const PRESET_TAGS = [
  { name: "Hot", color: "#e11d48" },
  { name: "Website Opportunity", color: "#2563eb" },
  { name: "SEO Opportunity", color: "#7c3aed" },
  { name: "Local Business", color: "#0891b2" },
  { name: "Dhaka", color: "#059669" },
  { name: "Follow Up", color: "#d97706" },
  { name: "Potential Client", color: "#4338ca" },
] as const;

export const WEBSITE_STATE_LABELS: Record<import("./crm-types").WebsiteState, string> = {
  NO_WEBSITE: "No website",
  UNAUDITED: "Not audited",
  WEAK: "Weak site",
  AVERAGE: "Average site",
  STRONG: "Strong site",
};
