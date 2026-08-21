import { Link2, Share2 } from "lucide-react";
import { SectionCard } from "../section-card";
import type { LeadSocialProfileView } from "@/lib/digital-intelligence-types";

const PLATFORM_LABEL: Record<LeadSocialProfileView["platform"], string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
};

export function SocialSection({ profiles }: { profiles: LeadSocialProfileView[] }) {
  return (
    <SectionCard title="Social" icon={Share2}>
      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No social links found on the business&apos;s website.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {profiles.map((profile) => (
            <a
              key={profile.id}
              href={profile.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
            >
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              {PLATFORM_LABEL[profile.platform]}
            </a>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
