"use client";

import Link from "next/link";
import { ExternalLink, HelpCircle, Keyboard, Mail, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export function HelpMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-full justify-start gap-2 px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <HelpCircle className="size-4" />
          <span className="text-sm font-medium">Help</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 p-1.5">
        <Link
          href="/#faq"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <MessageCircleQuestion className="size-4 text-muted-foreground" />
          Frequently asked questions
        </Link>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
          <Keyboard className="size-4" />
          <span>
            Command palette —{" "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans text-[10px]">
              ⌘K
            </kbd>
          </span>
        </div>
        <Separator className="my-1" />
        <a
          href="mailto:support@leadradar.app"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <Mail className="size-4 text-muted-foreground" />
          Contact support
          <ExternalLink className="ml-auto size-3 text-muted-foreground" />
        </a>
      </PopoverContent>
    </Popover>
  );
}
