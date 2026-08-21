import { Compass, LineChart, MessageSquareText, Search, Trophy } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "Discover",
    description: "Search any business type and location to surface real, local businesses.",
  },
  {
    icon: Compass,
    title: "Analyze",
    description: "We crawl their website and Google presence for real, observable signals.",
  },
  {
    icon: LineChart,
    title: "Understand",
    description: "A transparent Opportunity Score explains exactly what's missing and why.",
  },
  {
    icon: MessageSquareText,
    title: "Reach out",
    description: "Generate a personalized outreach message grounded only in verified facts.",
  },
  {
    icon: Trophy,
    title: "Convert",
    description: "Track replies, meetings, and wins through a purpose-built pipeline.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-border px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            Five steps from a search box to a signed client — every one of them explainable.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-primary">
                  <step.icon className="size-[18px]" />
                </div>
                <span className="font-heading text-sm text-muted-foreground/60 tabular-nums">
                  0{i + 1}
                </span>
              </div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
