"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { CurrentUser } from "@/lib/types";

export const CURRENT_USER_QUERY_KEY = ["auth", "me"] as const;

export function useCurrentUser(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: () => apiFetch<CurrentUser>("/auth/me"),
    retry: false,
    enabled: options.enabled ?? true,
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      name: string;
      organizationName: string;
    }) => apiFetch<{ user: CurrentUser }>("/auth/register", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY }),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<{ user: CurrentUser }>("/auth/login", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>("/auth/logout", { method: "POST" }),
    onSuccess: () => queryClient.setQueryData(CURRENT_USER_QUERY_KEY, undefined),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) =>
      apiFetch<{ ok: true }>("/auth/forgot-password", { method: "POST", body: input }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; newPassword: string }) =>
      apiFetch<{ ok: true }>("/auth/reset-password", { method: "POST", body: input }),
  });
}

export function useConfirmEmailVerification() {
  return useMutation({
    mutationFn: (input: { token: string }) =>
      apiFetch<{ ok: true }>("/auth/verify-email/confirm", { method: "POST", body: input }),
  });
}
