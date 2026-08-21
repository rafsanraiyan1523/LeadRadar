import { Building, Camera, Clock, MapPin, Phone, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "../section-card";
import { ScoreRing } from "../score-ring";
import type { GoogleBusinessAuditView } from "@/lib/digital-intelligence-types";

const STATUS_CONFIG: Record<
  GoogleBusinessAuditView["status"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  FOUND: { label: "Profile found", variant: "default" },
  NOT_FOUND_IN_CURRENT_SEARCH: { label: "Not found in current search", variant: "outline" },
  UNVERIFIED: { label: "Unverified", variant: "secondary" },
};

export function GoogleBusinessSection({ data }: { data: GoogleBusinessAuditView }) {
  const status = STATUS_CONFIG[data.status];

  return (
    <SectionCard
      title="Google Business"
      icon={Building}
      action={<Badge variant={status.variant}>{status.label}</Badge>}
    >
      {data.status !== "FOUND" ? (
        <p className="text-sm text-muted-foreground">
          {data.reason ?? "No verified Google Business data is available for this lead."}
        </p>
      ) : (
        <div className="flex items-start gap-4">
          <ScoreRing score={data.score} size="md" label="/100" />
          <div className="flex flex-1 flex-col gap-1.5 text-sm">
            {data.signals?.rating !== null && data.signals?.rating !== undefined && (
              <div className="flex items-center gap-1.5">
                <Star className="size-3.5 shrink-0 text-amber-500" fill="currentColor" />
                <span>
                  {data.signals.rating.toFixed(1)}
                  {data.signals.userRatingCount !== null && (
                    <span className="text-muted-foreground"> ({data.signals.userRatingCount} reviews)</span>
                  )}
                </span>
              </div>
            )}
            {data.signals?.address && (
              <div className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{data.signals.address}</span>
              </div>
            )}
            {data.signals?.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{data.signals.phone}</span>
              </div>
            )}
            {data.signals?.openingHours && data.signals.openingHours.length > 0 && (
              <div className="flex items-start gap-1.5">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{data.signals.openingHours[0]}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Camera className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">
                {data.signals?.photosAvailable ? "Photos available" : "No photos reported"}
              </span>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
