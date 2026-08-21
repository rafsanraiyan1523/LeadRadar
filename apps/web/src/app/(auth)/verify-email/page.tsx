"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirmEmailVerification } from "@/hooks/use-auth";

type Status = "pending" | "success" | "error";

function VerifyEmailContent() {
  const token = useSearchParams().get("token");
  const confirm = useConfirmEmailVerification();
  const [status, setStatus] = useState<Status>(token ? "pending" : "error");

  useEffect(() => {
    if (!token) return;
    confirm.mutate(
      { token },
      {
        onSuccess: () => setStatus("success"),
        onError: () => setStatus("error"),
      },
    );
    // Only ever run once per token — confirm is a stable mutate function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>Confirming the link from your email…</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        {status === "pending" && <Loader2 className="size-8 animate-spin text-muted-foreground" />}
        {status === "success" && (
          <>
            <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-500" />
            <p className="font-medium">Your email is verified</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="size-8 text-destructive" />
            <p className="font-medium">This link is invalid or has expired</p>
          </>
        )}
        <Link href="/app/find" className="text-sm font-medium underline-offset-4 hover:underline">
          Continue to LeadRadar
        </Link>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
