import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bookmark,
  History,
  Kanban,
  LayoutDashboard,
  Megaphone,
  Search,
  Settings,
  Users,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/app", icon: LayoutDashboard },
  { label: "Find Leads", href: "/app/find", icon: Search },
  { label: "Leads", href: "/app/leads", icon: Users },
  { label: "Saved Leads", href: "/app/saved", icon: Bookmark },
  { label: "Pipeline", href: "/app/pipeline", icon: Kanban },
  { label: "Campaigns", href: "/app/campaigns", icon: Megaphone },
  { label: "Analytics", href: "/app/analytics", icon: BarChart3 },
  { label: "Search History", href: "/app/searches", icon: History },
  { label: "Settings", href: "/app/settings", icon: Settings },
];
