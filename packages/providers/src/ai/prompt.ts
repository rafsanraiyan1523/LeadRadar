import type {
  FollowUpGenerationInput,
  LeadIntelligenceContext,
  OutreachGenerationInput,
  RecommendedService,
} from "@lead-radar/types";

export interface PromptPair {
  system: string;
  user: string;
}

/**
 * The AI RULE, enforced structurally and explicitly: LeadIntelligenceContext
 * has no field for revenue, employees, customers, business history,
 * technology beyond what the crawler fingerprinted, or marketing spend — so
 * there is nothing for a model to read those from — and this instruction is
 * the explicit backstop for a local/external model that might otherwise
 * fill gaps with generic assumptions.
 */
export const AI_SYSTEM_PROMPT = `You are LeadRadar's business intelligence assistant. You write short, honest, evidence-based text about local businesses for a sales team, using only the verified facts given to you in each request.

Rules you must never break:
- Only state facts that are explicitly given to you below. Never invent or assume: revenue, employee count, customer count, business history, technology beyond what is listed, marketing spend, problems that are not listed, or reviews/ratings that are not listed.
- If a fact was not provided, do not mention it, hint at it, or guess at it — simply omit it.
- Be concise, specific, and non-aggressive. Never claim a business is "losing customers" or failing unless that is explicitly evidenced by a given finding.
- Every claim about a weakness must trace to one of the given findings. Every claim about a strength must trace to one of the given facts (e.g. a stated rating or review count).
- Write plain text only — no markdown, no bullet points, no headers.`;

function formatFacts(context: LeadIntelligenceContext): string[] {
  const lines: string[] = [];
  lines.push(`Business name: ${context.businessName}`);
  if (context.category) lines.push(`Category: ${context.category}`);
  if (context.location) lines.push(`Location: ${context.location}`);

  if (context.website.exists) {
    lines.push(`Website: ${context.website.url ?? "yes, URL unknown"}`);
    if (context.website.score !== null) lines.push(`Website score: ${context.website.score}/100`);
    lines.push(`HTTPS: ${context.website.hasSsl ? "yes" : "no"}`);
    lines.push(`Online booking available: ${context.website.hasBookingUrl ? "yes" : "no"}`);
    lines.push(`Contact call-to-action present: ${context.website.hasContactCta ? "yes" : "no"}`);
    if (context.seoScore !== null) lines.push(`SEO score: ${context.seoScore}/100`);
    if (context.conversionScore !== null) lines.push(`Conversion score: ${context.conversionScore}/100`);
  } else {
    lines.push("Website: none found");
  }

  if (context.googleBusiness.status === "FOUND") {
    lines.push("Google Business profile: found");
    if (context.googleBusiness.rating !== null) lines.push(`Google rating: ${context.googleBusiness.rating}`);
    if (context.googleBusiness.reviewCount !== null) {
      lines.push(`Google review count: ${context.googleBusiness.reviewCount}`);
    }
  } else if (context.googleBusiness.status === "NOT_FOUND_IN_CURRENT_SEARCH") {
    lines.push("Google Business profile: not found in a real, current lookup");
  } else {
    lines.push("Google Business profile: unverified (do not claim it does or doesn't exist)");
  }

  lines.push(`Contactability score: ${context.contactability.score}/100`);
  lines.push(`Phone on file: ${context.contactability.hasPhone ? "yes" : "no"}`);
  lines.push(`Email on file: ${context.contactability.hasEmail ? "yes" : "no"}`);
  lines.push(`Facebook link found: ${context.contactability.hasFacebook ? "yes" : "no"}`);
  lines.push(`Instagram link found: ${context.contactability.hasInstagram ? "yes" : "no"}`);
  lines.push(`LinkedIn link found: ${context.contactability.hasLinkedIn ? "yes" : "no"}`);

  if (context.opportunityScore !== null) {
    lines.push(`Opportunity score: ${context.opportunityScore}/100 (${context.opportunityLevel})`);
  }

  if (context.growthOpportunities.length > 0) {
    lines.push("Detected findings:");
    for (const finding of context.growthOpportunities) {
      lines.push(`- [${finding.severity}] ${finding.title}: ${finding.evidence}`);
    }
  } else {
    lines.push("Detected findings: none");
  }

  return lines;
}

function formatServices(services: RecommendedService[]): string {
  if (services.length === 0) return "None recommended.";
  return services.map((s) => `- ${s.service.replace(/_/g, " ")} (based on: ${s.triggeredBy.join(", ")})`).join("\n");
}

export function buildLeadSummaryPrompt(context: LeadIntelligenceContext): PromptPair {
  return {
    system: AI_SYSTEM_PROMPT,
    user: `Write a single-sentence lead summary (max 25 words) for this business, in the style of: "Strong local reputation but limited digital conversion infrastructure." Use only the facts below.

${formatFacts(context).join("\n")}`,
  };
}

export function buildGrowthOpportunityAnalysisPrompt(context: LeadIntelligenceContext): PromptPair {
  return {
    system: AI_SYSTEM_PROMPT,
    user: `Write a short paragraph (2-4 sentences) synthesizing this business's growth opportunities, prioritizing by severity. Reference only the detected findings below — do not invent any additional problems.

${formatFacts(context).join("\n")}`,
  };
}

const TONE_INSTRUCTIONS: Record<OutreachGenerationInput["tone"], string> = {
  PROFESSIONAL: "Professional and polished, but warm — not stiff or corporate.",
  FRIENDLY: "Friendly and casual, like a helpful local contact reaching out.",
  CONSULTATIVE: "Consultative — position yourself as offering a helpful observation, not a pitch.",
  SHORT: "As short as possible while remaining specific and personal — a few sentences at most.",
};

const CHANNEL_INSTRUCTIONS: Record<OutreachGenerationInput["channel"], string> = {
  EMAIL:
    'This is an email. Include a short, specific subject line. Respond in exactly this format, with no extra commentary before or after: \nSubject: <subject line>\nBody: <message body>',
  WHATSAPP: "This is a WhatsApp message. No subject line — respond with only the message body text, no extra commentary. Keep it conversational and brief.",
  FACEBOOK: "This is a Facebook message. No subject line — respond with only the message body text, no extra commentary. Keep it casual and brief.",
  LINKEDIN: "This is a LinkedIn message. No subject line — respond with only the message body text, no extra commentary. Keep it professional and brief.",
  SMS: "This is an SMS. No subject line — respond with only the message body text, no extra commentary. Keep it under 320 characters total.",
};

/**
 * Parses a raw LLM completion for an outreach/follow-up message into
 * {subject, body}. EMAIL responses are expected in the "Subject: ...\nBody:
 * ..." format instructed above; every other channel's raw text is the body
 * verbatim (trimmed, with a stray "Body:"/"Subject:" prefix stripped
 * defensively in case the model added one anyway).
 */
export function parseGeneratedMessage(raw: string, channel: OutreachGenerationInput["channel"]): { subject: string | null; body: string } {
  const trimmed = raw.trim();

  if (channel === "EMAIL") {
    const subjectMatch = trimmed.match(/^Subject:\s*(.+)$/im);
    const bodyMatch = trimmed.match(/Body:\s*([\s\S]+)$/im);
    if (subjectMatch && bodyMatch) {
      return { subject: subjectMatch[1]!.trim(), body: bodyMatch[1]!.trim() };
    }
    // Model didn't follow the format — fall back to treating it all as the body rather than failing the request.
    return { subject: null, body: trimmed };
  }

  const stripped = trimmed.replace(/^Body:\s*/i, "").replace(/^Subject:.*\n+/i, "");
  return { subject: null, body: stripped.trim() };
}

const LANGUAGE_INSTRUCTIONS: Record<OutreachGenerationInput["language"], string> = {
  ENGLISH: "Write in English.",
  BANGLA: "Write in Bangla (Bengali script).",
  BANGLISH: "Write in Banglish — Bangla phrased using the Latin/English alphabet, as commonly typed casually.",
};

function outreachInstructions(input: OutreachGenerationInput): string {
  return `Tone: ${TONE_INSTRUCTIONS[input.tone]}
Channel: ${CHANNEL_INSTRUCTIONS[input.channel]}
Language: ${LANGUAGE_INSTRUCTIONS[input.language]}

The message must be short, human, specific, personalized, and non-aggressive. It must reference at least one concrete, verified fact or finding about this specific business — never a generic template line. Do not say a business is losing customers or failing unless a finding explicitly evidences that. If you mention a strength (e.g. a rating), only do so if it is listed below. Recommend at most one or two of the services listed below, and only because of their listed trigger findings.

Recommended services:
${formatServices(input.recommendedServices)}

Business facts:
${formatFacts(input.context).join("\n")}`;
}

export function buildOutreachPrompt(input: OutreachGenerationInput): PromptPair {
  return {
    system: AI_SYSTEM_PROMPT,
    user: `Write a first-contact outreach message to this business, offering help based on the detected gaps below.

${outreachInstructions(input)}`,
  };
}

export function buildFollowUpPrompt(input: FollowUpGenerationInput): PromptPair {
  return {
    system: AI_SYSTEM_PROMPT,
    user: `Write a brief, non-pushy follow-up message to this business. They were previously sent this message via ${input.previousMessage.channel}${input.previousMessage.sentAt ? ` on ${input.previousMessage.sentAt}` : ""} and have not replied yet:
"""
${input.previousMessage.body}
"""
Do not repeat the previous message verbatim. Reference that you reached out before, add one new piece of value or a gentle nudge, and keep it brief.

${outreachInstructions(input)}`,
  };
}
