import {
  BarChart3,
  Building2,
  Kanban,
  Mail,
  MapPinned,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: MapPinned,
    title: "Business Discovery",
    description: "Search by business type and location to surface real, local prospects.",
  },
  {
    icon: Mail,
    title: "Contact Enrichment",
    description: "Emails, phones, and social profiles pulled from the business's own site.",
  },
  {
    icon: Building2,
    title: "Website Audit",
    description: "SEO, mobile, conversion, and technical checks against real page signals.",
  },
  {
    icon: Target,
    title: "Google Business Insights",
    description: "A verified read on their Google presence — rating, reviews, and status.",
  },
  {
    icon: Zap,
    title: "Opportunity Scoring",
    description: "One transparent score, fully traceable to the signals behind it.",
  },
  {
    icon: Sparkles,
    title: "AI Outreach",
    description: "Personalized messages grounded only in facts LeadRadar actually verified.",
  },
  {
    icon: Kanban,
    title: "CRM",
    description: "A pipeline built for outbound — notes, tags, follow-ups, drag-and-drop.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Live dashboards over your own data — never a hardcoded number.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="border-t border-border px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to prospect intelligently
          </h2>
          <p className="mt-3 text-muted-foreground">
            One connected workflow, from first search to signed client.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="size-[18px]" />
              </div>
              <h3 className="text-sm font-medium">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
