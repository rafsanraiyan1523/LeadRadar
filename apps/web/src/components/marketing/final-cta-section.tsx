import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCtaSection() {
  return (
    <section className="border-t border-border px-6 py-20 sm:py-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Start finding your next client today.
        </h2>
        <p className="text-muted-foreground">
          No credit card, no API keys — the full demo runs at zero cost.
        </p>
        <Button size="lg" asChild className="gap-1.5 px-6">
          <Link href="/register">
            Find Your First Lead
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
