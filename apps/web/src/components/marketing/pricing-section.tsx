import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try the full workflow in demo mode — no card, no API keys.",
    cta: "Start for free",
    href: "/register",
    highlighted: false,
    features: [
      "Mock lead discovery (no Google account needed)",
      "Digital Intelligence Engine audits",
      "AI outreach (template-based demo mode)",
      "Pipeline, tags, notes & follow-ups",
      "Up to 1 organization",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    period: "/ month",
    description: "For a single agency or consultant running real campaigns.",
    cta: "Start for free",
    href: "/register",
    highlighted: true,
    features: [
      "Everything in Free",
      "Live Google Places discovery",
      "Real AI-generated outreach",
      "Unlimited campaigns",
      "CSV export",
      "Priority support",
    ],
  },
  {
    name: "Agency",
    price: "Custom",
    period: "",
    description: "For teams managing prospecting across multiple clients.",
    cta: "Start for free",
    href: "/register",
    highlighted: false,
    features: [
      "Everything in Pro",
      "Multiple organizations & seats",
      "Role-based permissions",
      "Dedicated onboarding",
      "SLA & custom integrations",
    ],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free in demo mode — no credit card required.
          </p>
          <Badge variant="outline" className="mt-4 border-dashed text-muted-foreground">
            Product concept — billing isn&apos;t live yet
          </Badge>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col gap-6 rounded-2xl border p-6 sm:p-8",
                plan.highlighted
                  ? "border-primary/50 bg-primary/[0.03] shadow-lg shadow-primary/5"
                  : "border-border bg-card",
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{plan.name}</h3>
                  {plan.highlighted && <Badge>Popular</Badge>}
                </div>
                <p className="mt-3 flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  )}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="flex flex-1 flex-col gap-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button asChild variant={plan.highlighted ? "default" : "outline"}>
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
