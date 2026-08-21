"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarkAllNotificationsRead, useNotifications } from "@/hooks/use-notifications";

export function NotificationsBell() {
  const { data } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!data || data.items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        ) : (
          data.items.slice(0, 8).map((item) => (
            <DropdownMenuItem key={item.id} className="flex flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{item.title}</span>
              {item.body && <span className="text-xs text-muted-foreground">{item.body}</span>}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
