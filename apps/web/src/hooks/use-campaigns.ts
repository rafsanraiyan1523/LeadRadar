"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  Campaign,
  CampaignDashboard,
  CampaignDetail,
  CampaignListItem,
  CreateCampaignInput,
  GenerateCampaignMessagesResult,
  UpdateCampaignInput,
} from "@/lib/campaign-types";

const LIST_KEY = ["campaigns"] as const;
const detailKey = (id: string) => ["campaigns", id] as const;
const dashboardKey = (id: string) => ["campaigns", id, "dashboard"] as const;

export function useCampaigns() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => apiFetch<CampaignListItem[]>("/campaigns"),
  });
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: id ? detailKey(id) : ["campaigns", "none"],
    queryFn: () => apiFetch<CampaignDetail>(`/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCampaignDashboard(id: string | null) {
  return useQuery({
    queryKey: id ? dashboardKey(id) : ["campaigns", "none", "dashboard"],
    queryFn: () => apiFetch<CampaignDashboard>(`/campaigns/${id}/dashboard`),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      apiFetch<Campaign>("/campaigns", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useUpdateCampaign(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCampaignInput) =>
      apiFetch<Campaign>(`/campaigns/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      if (id) void queryClient.invalidateQueries({ queryKey: detailKey(id) });
    },
  });
}

export function useAddCampaignLeads(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadIds: string[]) =>
      apiFetch<CampaignDetail>(`/campaigns/${id}/leads`, { method: "POST", body: { leadIds } }),
    onSuccess: () => {
      if (!id) return;
      void queryClient.invalidateQueries({ queryKey: detailKey(id) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useRemoveCampaignLead(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) =>
      apiFetch<{ ok: true }>(`/campaigns/${id}/leads/${leadId}`, { method: "DELETE" }),
    onSuccess: () => {
      if (!id) return;
      void queryClient.invalidateQueries({ queryKey: detailKey(id) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useGenerateCampaignMessages(id: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (language?: string) =>
      apiFetch<GenerateCampaignMessagesResult>(`/campaigns/${id}/generate-messages`, {
        method: "POST",
        body: { language },
      }),
    onSuccess: () => {
      if (!id) return;
      void queryClient.invalidateQueries({ queryKey: dashboardKey(id) });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
