import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  hasTitle: "Page title",
  hasMetaDescription: "Meta description",
  hasH1: "H1 heading",
  hasCanonical: "Canonical URL",
  hasViewport: "Viewport meta tag",
  hasSitemap: "Sitemap",
  hasStructuredData: "Structured data",
  hasOpenGraph: "Open Graph tags",
  notBlockedByRobots: "Not blocked by robots",
  hasContactCta: "Contact call-to-action",
  phoneVisible: "Phone visible",
  emailVisible: "Email visible",
  hasBookingCta: "Booking call-to-action",
  hasContactPage: "Contact page",
  hasServicePages: "Service pages",
  hasViewportMeta: "Viewport meta tag",
  viewportConfiguredForDevice: "Device-width configured",
  https: "HTTPS",
  noBrokenLinksDetected: "No broken links detected",
  techStackDetected: "Tech stack fingerprint",
};

/** "LeadRadar checks" evidence panel — every row is a real, observed boolean signal. */
export function BreakdownChecklist({ breakdown }: { breakdown: Record<string, boolean> }) {
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
      {Object.entries(breakdown).map(([key, value]) => (
        <li key={key} className="flex items-center gap-1.5 text-xs">
          {value ? (
            <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <X className="size-3.5 shrink-0 text-muted-foreground/60" />
          )}
          <span className={cn(value ? "text-foreground" : "text-muted-foreground")}>
            {LABELS[key] ?? key}
          </span>
        </li>
      ))}
    </ul>
  );
}
