import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardPreview } from "./dashboard-preview";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Now scoring digital opportunity in real time
        </div>

        <h1 className="text-balance font-heading text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
          Find businesses that need your services.
        </h1>

        <p className="text-balance max-w-2xl text-lg text-muted-foreground">
          Discover local businesses, uncover digital growth opportunities, and turn them into
          qualified prospects.
        </p>

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" asChild className="gap-1.5 px-6">
            <Link href="/register">
              Find Your First Lead
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="gap-1.5 px-6">
            <a href="#product-showcase">
              <PlayCircle className="size-4" />
              View Demo
            </a>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-5xl">
        <DashboardPreview />
      </div>
    </section>
  );
}
