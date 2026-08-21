import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  icon: Icon,
  action,
  className,
  contentClassName,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-3", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
