import type { LeadStatus } from "./crm-types";

/** The app's own brand primary — used for single-series charts (trend line, top categories/locations) so dashboard charts stay visually consistent with buttons/links elsewhere. */
export const CHART_PRIMARY = { light: "#3355d8", dark: "#7189ff" } as const;

/**
 * Ordinal ramp (light→dark, one hue) for the two 5-bucket score
 * distributions (Opportunity, Contactability) — low buckets read as
 * "receding toward the surface," high buckets as saturated, per the
 * dataviz skill's ordinal-ramp guidance. Steps stay ≥2:1 against the
 * surface in both modes.
 */
export const SCORE_RAMP = {
  light: ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#184f95"],
  dark: ["#184f95", "#2a78d6", "#3987e5", "#5598e7", "#86b6ef"],
} as const;

/**
 * Status colors for the dashboard's Lead Status / Pipeline Funnel bar
 * charts. NEW/SAVED stay a neutral gray (an "inactive" state, deliberately
 * outside the categorical set); the seven active-pipeline hues are
 * validated with `dataviz`'s `validate_palette.js` — ALL CHECKS PASS in
 * both modes (adjacent-pair CVD ΔE, lightness band, chroma floor). The
 * ordering (not the original Tailwind picks) is what makes it pass, so
 * don't reorder these without re-running the validator. Every bar these
 * color is also axis-labeled with the status name — color reinforces
 * identity here, it never carries it alone.
 */
const STATUS_COLORS_LIGHT: Record<LeadStatus, string> = {
  NEW: "#94a3b8",
  SAVED: "#94a3b8",
  CONTACTED: "#2a78d6",
  REPLIED: "#eb6834",
  INTERESTED: "#1baf7a",
  MEETING: "#4a3aa7",
  PROPOSAL: "#eda100",
  WON: "#008300",
  LOST: "#e34948",
};
const STATUS_COLORS_DARK: Record<LeadStatus, string> = {
  NEW: "#a1a1aa",
  SAVED: "#a1a1aa",
  CONTACTED: "#3987e5",
  REPLIED: "#d95926",
  INTERESTED: "#199e70",
  MEETING: "#9085e9",
  PROPOSAL: "#c98500",
  WON: "#008300",
  LOST: "#e66767",
};

export function statusColorsFor(isDark: boolean): Record<LeadStatus, string> {
  return isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
}

export function useChartPrimary(isDark: boolean): string {
  return isDark ? CHART_PRIMARY.dark : CHART_PRIMARY.light;
}

export function scoreRampFor(isDark: boolean): readonly string[] {
  return isDark ? SCORE_RAMP.dark : SCORE_RAMP.light;
}
