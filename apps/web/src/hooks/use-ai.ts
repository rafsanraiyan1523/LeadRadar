"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  AIInsight,
  OutreachChannel,
  OutreachLanguage,
  OutreachMessage,
  OutreachStatus,
  OutreachTone,
} from "@/lib/ai-types";

const insightKey = (leadId: string) => ["leads", leadId, "insight"] as const;
const outreachKey = (leadId: string) => ["leads", leadId, "outreach"] as const;

export function useLeadInsight(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? insightKey(leadId) : ["leads", "none", "insight"],
    queryFn: () => apiFetch<{ insight: AIInsight | null }>(`/leads/${leadId}/insight`),
    enabled: !!leadId,
  });
}

export function useGenerateInsight(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<AIInsight>(`/leads/${leadId}/insight/generate`, { method: "POST" }),
    onSuccess: () => {
      if (leadId) void queryClient.invalidateQueries({ queryKey: insightKey(leadId) });
    },
  });
}

export function useOutreachMessages(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? outreachKey(leadId) : ["leads", "none", "outreach"],
    queryFn: () => apiFetch<OutreachMessage[]>(`/leads/${leadId}/outreach`),
    enabled: !!leadId,
  });
}

export interface GenerateOutreachInput {
  channel: OutreachChannel;
  tone: OutreachTone;
  language: OutreachLanguage;
}

export function useGenerateOutreach(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateOutreachInput) =>
      apiFetch<OutreachMessage>(`/leads/${leadId}/outreach/generate`, { method: "POST", body }),
    onSuccess: () => {
      if (leadId) void queryClient.invalidateQueries({ queryKey: outreachKey(leadId) });
    },
  });
}

export function useGenerateFollowUp(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateOutreachInput & { previousMessageId: string }) =>
      apiFetch<OutreachMessage>(`/leads/${leadId}/outreach/follow-up`, { method: "POST", body }),
    onSuccess: () => {
      if (leadId) void queryClient.invalidateQueries({ queryKey: outreachKey(leadId) });
    },
  });
}

export interface UpdateOutreachMessageInput {
  messageId: string;
  subject?: string;
  body?: string;
  status?: OutreachStatus;
}

export function useUpdateOutreachMessage(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, ...body }: UpdateOutreachMessageInput) =>
      apiFetch<OutreachMessage>(`/leads/${leadId}/outreach/${messageId}`, { method: "PATCH", body }),
    onSuccess: () => {
      if (leadId) void queryClient.invalidateQueries({ queryKey: outreachKey(leadId) });
    },
  });
}
