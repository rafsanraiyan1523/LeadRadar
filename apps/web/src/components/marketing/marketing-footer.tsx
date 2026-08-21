import Link from "next/link";
import { Logo } from "@lead-radar/ui";

function currentYear(): number {
  return new Date().getFullYear();
}

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/register" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-3">
          <Logo size={20} wordmarkClassName="text-sm font-semibold tracking-tight" />
          <p className="max-w-xs text-sm text-muted-foreground">
            Find businesses that need your services.
          </p>
        </div>

        <div className="flex gap-16">
          {COLUMNS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {col.heading}
              </p>
              {col.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-border pt-6 text-xs text-muted-foreground">
        © {currentYear()} LeadRadar. All rights reserved.
      </div>
    </footer>
  );
}
