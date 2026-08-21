"use client";

import { MapPin, Send, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "search", label: "Lead Search" },
  { value: "audit", label: "Lead Audit" },
  { value: "score", label: "Opportunity Score" },
  { value: "outreach", label: "AI Outreach" },
  { value: "pipeline", label: "Pipeline" },
];

function ShowcaseFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-5 shadow-lg shadow-black/5 dark:shadow-black/30 sm:p-8">
      {children}
    </div>
  );
}

function LeadSearchMock() {
  const results = [
    { name: "Riverside Dental Clinic", category: "Dental Clinic", rating: 4.6, opportunity: "High" },
    { name: "Blue Ocean Cafe", category: "Cafe", rating: 4.2, opportunity: "Medium" },
    { name: "Prime Fitness Studio", category: "Gym", rating: 4.8, opportunity: "Low" },
  ];
  return (
    <ShowcaseFrame>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="flex flex-col gap-2 md:col-span-3">
          {results.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.category}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="size-3 fill-amber-500 text-amber-500" />
                  {r.rating}
                </span>
                <Badge
                  variant={r.opportunity === "High" ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {r.opportunity}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 md:col-span-2">
          <MapPin className="size-6 text-muted-foreground/50" />
        </div>
      </div>
    </ShowcaseFrame>
  );
}

function LeadAuditMock() {
  const metrics = [
    { label: "SEO", value: 72 },
    { label: "Mobile", value: 58 },
    { label: "Conversion", value: 40 },
    { label: "Technical", value: 81 },
  ];
  return (
    <ShowcaseFrame>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{m.value}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${m.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </ShowcaseFrame>
  );
}

function OpportunityScoreMock() {
  const score = 78;
  const circumference = 2 * Math.PI * 42;
  return (
    <ShowcaseFrame>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
        <div className="relative flex size-32 items-center justify-center">
          <svg width="128" height="128" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r="42" fill="none" strokeWidth="8" className="stroke-muted" />
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - score / 100)}
              className="stroke-primary"
            />
          </svg>
          <span className="absolute font-heading text-3xl font-semibold tabular-nums">{score}</span>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <p className="font-medium">High opportunity</p>
          <p className="max-w-xs text-muted-foreground">
            No website detected, weak Google review volume, and no online booking — three
            verified gaps this business hasn&apos;t closed yet.
          </p>
        </div>
      </div>
    </ShowcaseFrame>
  );
}

function AiOutreachMock() {
  return (
    <ShowcaseFrame>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {["Email", "Professional", "English"].map((chip) => (
            <Badge key={chip} variant="outline">
              {chip}
            </Badge>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground/90">
          <p className="mb-2 font-medium">Subject: A quick note about Riverside Dental&apos;s website</p>
          <p className="text-muted-foreground">
            Hi there — I noticed Riverside Dental doesn&apos;t currently have a website, which
            likely means patients searching nearby aren&apos;t finding you. I help local clinics
            get a fast, professional site live...
          </p>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <Send className="size-3.5" />
          Generated from verified signals only
        </div>
      </div>
    </ShowcaseFrame>
  );
}

function PipelineMock() {
  const columns = [
    { name: "New", cards: ["Riverside Dental"], dot: "bg-slate-400" },
    { name: "Contacted", cards: ["Blue Ocean Cafe"], dot: "bg-blue-500" },
    { name: "Meeting", cards: ["Prime Fitness"], dot: "bg-cyan-500" },
    { name: "Won", cards: ["Oakwood Salon"], dot: "bg-emerald-500" },
  ];
  return (
    <ShowcaseFrame>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {columns.map((col) => (
          <div key={col.name} className="rounded-lg bg-muted/40 p-2">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className={`size-1.5 rounded-full ${col.dot}`} />
              <span className="text-xs font-medium">{col.name}</span>
            </div>
            {col.cards.map((card) => (
              <div key={card} className="rounded-md border border-border bg-card p-2 text-xs">
                {card}
              </div>
            ))}
          </div>
        ))}
      </div>
    </ShowcaseFrame>
  );
}

export function ProductShowcaseSection() {
  return (
    <section id="product-showcase" className="border-t border-border px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            See it in action
          </h2>
          <p className="mt-3 text-muted-foreground">
            A closer look at the screens you&apos;ll actually work in.
          </p>
        </div>

        <Tabs defaultValue="search" className="mt-12 items-center gap-6">
          <TabsList className="flex-wrap justify-center">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="w-full">
            <TabsContent value="search">
              <LeadSearchMock />
            </TabsContent>
            <TabsContent value="audit">
              <LeadAuditMock />
            </TabsContent>
            <TabsContent value="score">
              <OpportunityScoreMock />
            </TabsContent>
            <TabsContent value="outreach">
              <AiOutreachMock />
            </TabsContent>
            <TabsContent value="pipeline">
              <PipelineMock />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </section>
  );
}
