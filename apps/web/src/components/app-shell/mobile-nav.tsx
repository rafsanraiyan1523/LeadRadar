"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { LogoMark } from "@lead-radar/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { HelpMenu } from "./help-menu";
import { UserMenu } from "./user-menu";
import type { CurrentUser } from "@/lib/types";

export function MobileNav({
  organizationName,
  user,
}: {
  organizationName: string;
  user: CurrentUser;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle asChild>
            <Link href="/app" className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <LogoMark size={22} className="text-primary" />
              <span className="text-base font-semibold tracking-tight">LeadRadar</span>
            </Link>
          </SheetTitle>
        </SheetHeader>
        <p className="truncate px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {organizationName}
        </p>
        <div className="flex-1 overflow-y-auto px-3">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
        <div className="flex flex-col gap-0.5 border-t border-border px-3 py-3">
          <HelpMenu />
          <UserMenu user={user} className="w-full justify-start" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
