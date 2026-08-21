"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-error";

const schema = z.object({
  newPassword: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/(?=.*[a-zA-Z])(?=.*\d)/, "Must contain a letter and a number"),
});
type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const resetPassword = useResetPassword();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          This reset link is missing its token. Request a new one from the{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            forgot password
          </Link>{" "}
          page.
        </CardContent>
      </Card>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await resetPassword.mutateAsync({ token, newPassword: values.newPassword });
      router.push("/login");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? "This link is invalid or has expired. Please request a new one."
          : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a strong password you haven&apos;t used before.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
