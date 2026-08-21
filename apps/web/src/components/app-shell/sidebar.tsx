import Link from "next/link";
import { LogoMark } from "@lead-radar/ui";
import { SidebarNav } from "./sidebar-nav";
import { HelpMenu } from "./help-menu";
import { UserMenu } from "./user-menu";
import type { CurrentUser } from "@/lib/types";

export function Sidebar({
  organizationName,
  user,
}: {
  organizationName: string;
  user: CurrentUser;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <Link href="/app" className="flex items-center gap-2">
          <LogoMark size={22} className="text-sidebar-primary" />
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            LeadRadar
          </span>
        </Link>
      </div>
      <div className="px-3 pb-2">
        <p className="truncate px-3 py-1 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/50">
          {organizationName}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <SidebarNav />
      </div>
      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-3 py-3">
        <HelpMenu />
        <UserMenu
          user={user}
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        />
      </div>
    </aside>
  );
}
