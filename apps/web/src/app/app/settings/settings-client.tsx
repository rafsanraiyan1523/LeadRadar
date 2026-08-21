"use client";

import { useState } from "react";
import { History, Lock, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { SectionCard } from "@/components/leads/audit/section-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogTable } from "@/components/settings/audit-log-table";
import { useMyAuditLog, useOrgAuditLog } from "@/hooks/use-audit-log";
import { useCurrentUser } from "@/hooks/use-auth";

const ORG_ADMIN_ROLES = new Set(["OWNER", "ADMIN"]);

export function SettingsClient() {
  const { data: user } = useCurrentUser();
  const [myPage, setMyPage] = useState(1);
  const [orgPage, setOrgPage] = useState(1);

  const currentRole = user?.memberships[0]?.role;
  const canViewOrgLog = !!currentRole && ORG_ADMIN_ROLES.has(currentRole);

  const myLog = useMyAuditLog(myPage);
  const orgLog = useOrgAuditLog(orgPage, { enabled: canViewOrgLog });

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-5 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile, organization, and billing settings are coming in a later phase — your
          security activity is available today.
        </p>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <SectionCard title="Coming soon" icon={SettingsIcon}>
          <p className="text-sm text-muted-foreground">
            Profile editing, organization details, and billing management aren&apos;t built yet.
          </p>
        </SectionCard>

        <SectionCard title="Activity" icon={History}>
          <Tabs defaultValue="mine">
            <TabsList>
              <TabsTrigger value="mine" className="gap-1.5">
                <ShieldCheck className="size-3.5" />
                My activity
              </TabsTrigger>
              <TabsTrigger value="org" disabled={!canViewOrgLog} className="gap-1.5">
                <Lock className="size-3.5" />
                Organization activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mine" className="pt-3">
              <AuditLogTable
                data={myLog.data}
                isLoading={myLog.isLoading}
                page={myPage}
                onPageChange={setMyPage}
              />
            </TabsContent>

            <TabsContent value="org" className="pt-3">
              {canViewOrgLog ? (
                <AuditLogTable
                  data={orgLog.data}
                  isLoading={orgLog.isLoading}
                  page={orgPage}
                  onPageChange={setOrgPage}
                  showActor
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Only owners and admins can view organization-wide activity.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </SectionCard>
      </div>
    </div>
  );
}
