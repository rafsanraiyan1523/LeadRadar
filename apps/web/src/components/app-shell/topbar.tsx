import { MobileNav } from "./mobile-nav";
import { GlobalSearchButton } from "./global-search-button";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";
import type { CurrentUser } from "@/lib/types";

export function Topbar({
  user,
  organizationName,
}: {
  user: CurrentUser;
  organizationName: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MobileNav organizationName={organizationName} user={user} />
        <GlobalSearchButton />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <NotificationsBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
