import type {
  AIProvider,
  FollowUpGenerationInput,
  GeneratedMessage,
  GeneratedText,
  GrowthOpportunityFinding,
  LeadIntelligenceContext,
  OutreachGenerationInput,
} from "@lead-radar/types";
import { GAP_PHRASES, PHRASES, STRENGTH_PHRASES, serviceLabel } from "./mock-phrases";

const MODEL_NAME = "leadradar-mock-v1";

const SEVERITY_RANK: Record<GrowthOpportunityFinding["severity"], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function sortBySeverity(findings: GrowthOpportunityFinding[]): GrowthOpportunityFinding[] {
  return [...findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

// Short noun-phrase framings for the lead summary — deliberately terse, in
// the style of "limited digital conversion infrastructure" rather than the
// full sentences used in outreach messages.
const WEAKNESS_NOUN_PHRASES: Record<string, string> = {
  "No website detected": "no website presence",
  "No online booking detected": "limited digital conversion infrastructure",
  "Weak calls-to-action": "limited digital conversion infrastructure",
  "Missing SEO metadata": "weak search visibility",
  "Weak mobile configuration": "a non-mobile-friendly website",
  "Site is not served over HTTPS": "an insecure website connection",
  "No social links found on website": "no social media presence on its site",
  "No clear service pages": "unclear service information online",
  "No Google Business Profile found": "no discoverable Google Business profile",
  "Strong rating but limited review volume": "a thin review base relative to its rating",
};

function leadSummaryStrengthClause(context: LeadIntelligenceContext): string | null {
  if (context.googleBusiness.status === "FOUND" && (context.googleBusiness.rating ?? 0) >= 4) {
    return "Strong local reputation";
  }
  if (context.contactability.score >= 70) return "Strong contactability";
  if (context.website.exists && (context.website.score ?? 0) >= 70) return "Solid website foundation";
  return null;
}

function leadSummaryWeaknessClause(context: LeadIntelligenceContext): string | null {
  const [top] = sortBySeverity(context.growthOpportunities);
  if (!top) return null;
  return WEAKNESS_NOUN_PHRASES[top.title] ?? top.title.toLowerCase();
}

/** LEAD SUMMARY — the exact composition style from the spec: "Strong local reputation but limited digital conversion infrastructure." */
export function buildMockLeadSummary(context: LeadIntelligenceContext): string {
  const strength = leadSummaryStrengthClause(context);
  const weakness = leadSummaryWeaknessClause(context);

  if (strength && weakness) return `${strength} but ${weakness}.`;
  if (strength) return `${strength}, with no significant gaps detected yet.`;
  if (weakness) return `${weakness[0]!.toUpperCase()}${weakness.slice(1)} detected.`;
  return "No significant strengths or gaps detected yet — run a full audit for more signal.";
}

/** GROWTH OPPORTUNITY ANALYSIS — a short paragraph synthesizing only the already-detected findings, most severe first. */
export function buildMockGrowthAnalysis(context: LeadIntelligenceContext): string {
  const findings = sortBySeverity(context.growthOpportunities);
  if (findings.length === 0) {
    return "No growth opportunities have been detected yet for this business.";
  }

  const [top, ...rest] = findings;
  const sentences = [`The biggest opportunity is addressing "${top!.title.toLowerCase()}" — ${top!.recommendation}`];
  if (rest.length > 0) {
    const nextTitles = rest.slice(0, 2).map((f) => f.title.toLowerCase());
    sentences.push(`Beyond that, there's also room to improve on ${nextTitles.join(" and ")}.`);
  }
  return sentences.join(" ");
}

function locationClause(context: LeadIntelligenceContext, language: OutreachGenerationInput["language"]): string {
  if (!context.location) return "";
  if (language === "ENGLISH") return ` in ${context.location}`;
  if (language === "BANGLA") return ` ${context.location}-এ`;
  return ` ${context.location}-e`;
}

function observationSentence(input: OutreachGenerationInput): string {
  const { context, language } = input;
  const phrases = PHRASES[language];

  let strength: string | null = null;
  if (context.googleBusiness.status === "FOUND" && (context.googleBusiness.rating ?? 0) >= 4) {
    strength = STRENGTH_PHRASES.strongGoogleRating[language](context.googleBusiness.rating!, context.googleBusiness.reviewCount);
  } else if (context.contactability.score >= 70) {
    strength = STRENGTH_PHRASES.easyToReach[language];
  }

  const [topFinding] = sortBySeverity(context.growthOpportunities);
  const gap = topFinding ? GAP_PHRASES[topFinding.title]?.[language] : undefined;

  if (strength && gap) return `${strength}, ${phrases.connectorBut} ${gap}.`;
  if (gap) return `${gap[0]!.toUpperCase()}${gap.slice(1)}.`;
  if (strength) return `${strength[0]!.toUpperCase()}${strength.slice(1)}.`;
  return "";
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [key, value]) => acc.split(`{${key}}`).join(value), template);
}

function composeBody(input: OutreachGenerationInput, opening: string): { subject: string | null; body: string } {
  const { context, tone, language, channel, recommendedServices } = input;
  const phrases = PHRASES[language];
  const observation = observationSentence(input);
  const closing = phrases.closing[tone];

  const serviceSentence =
    recommendedServices.length > 0
      ? fillTemplate(phrases.serviceIntro, { service: serviceLabel(recommendedServices[0]!.service, language) })
      : "";

  const parts =
    tone === "SHORT"
      ? [opening, observation, closing]
      : [opening, observation, serviceSentence, closing].filter(Boolean);

  const body = parts.filter(Boolean).join(" ");
  const subject = channel === "EMAIL" ? fillTemplate(phrases.subjectLine, { business: context.businessName }) : null;

  return { subject, body };
}

/** OUTREACH GENERATOR: composes a message from language/tone/channel templates + the real observation sentence above. Deterministic — same input always yields the same output. */
export function buildMockOutreachMessage(input: OutreachGenerationInput): { subject: string | null; body: string } {
  const phrases = PHRASES[input.language];
  const opening = fillTemplate(phrases.opening[input.tone], {
    business: input.context.businessName,
    locationClause: locationClause(input.context, input.language),
  });
  return composeBody(input, opening);
}

export function buildMockFollowUpMessage(input: FollowUpGenerationInput): { subject: string | null; body: string } {
  const phrases = PHRASES[input.language];
  const opening = fillTemplate(phrases.followUpOpening, { business: input.context.businessName });
  return composeBody(input, opening);
}

/**
 * MockAIProvider — the zero-cost default. Fully deterministic (same input
 * always produces the same output) and template-based, but genuinely
 * composed from the verified LeadIntelligenceContext, not random filler —
 * see buildMockLeadSummary/buildMockGrowthAnalysis/buildMockOutreachMessage.
 */
export class MockAIProvider implements AIProvider {
  readonly mode = "MOCK" as const;

  async generateLeadSummary(context: LeadIntelligenceContext): Promise<GeneratedText> {
    return { text: buildMockLeadSummary(context), model: MODEL_NAME, providerMode: "MOCK" };
  }

  async generateGrowthOpportunityAnalysis(context: LeadIntelligenceContext): Promise<GeneratedText> {
    return { text: buildMockGrowthAnalysis(context), model: MODEL_NAME, providerMode: "MOCK" };
  }

  async generateOutreachMessage(input: OutreachGenerationInput): Promise<GeneratedMessage> {
    const { subject, body } = buildMockOutreachMessage(input);
    return { subject, body, model: MODEL_NAME, providerMode: "MOCK" };
  }

  async generateFollowUpMessage(input: FollowUpGenerationInput): Promise<GeneratedMessage> {
    const { subject, body } = buildMockFollowUpMessage(input);
    return { subject, body, model: MODEL_NAME, providerMode: "MOCK" };
  }
}
