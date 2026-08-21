import { redirect } from "next/navigation";
import { serverApiFetch } from "@/lib/server-api";
import { ApiError } from "@/lib/api-error";
import type { CurrentUser } from "@/lib/types";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { CommandPalette } from "@/components/app-shell/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user: CurrentUser;
  try {
    user = await serverApiFetch<CurrentUser>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      redirect("/login");
    }
    throw error;
  }

  const organizationName = user.memberships[0]?.organizationName ?? "LeadRadar";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar organizationName={organizationName} user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} organizationName={organizationName} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      <CommandPalette />
    </div>
  );
}
