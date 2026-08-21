import { Suspense } from "react";
import { LeadDetailClient } from "./lead-detail-client";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <LeadDetailClient leadId={id} />
    </Suspense>
  );
}
