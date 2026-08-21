"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  ClientLoggableActivityType,
  FollowUp,
  LeadActivityEntry,
  LeadCardView,
  LeadNote,
  LeadStatus,
  ListLeadsFilters,
  PaginatedLeadCards,
  PipelineResponse,
  Tag,
} from "@/lib/crm-types";

const PIPELINE_KEY = ["pipeline"] as const;
const LEADS_LIST_KEY = (filters: ListLeadsFilters) => ["leads-list", filters] as const;
const SAVED_LEADS_KEY = (filters: ListLeadsFilters) => ["saved-leads", filters] as const;
const notesKey = (leadId: string) => ["leads", leadId, "notes"] as const;
const tagsKey = (leadId: string) => ["leads", leadId, "tags"] as const;
const orgTagsKey = ["tags"] as const;
const followUpsKey = (leadId: string) => ["leads", leadId, "follow-ups"] as const;
const activitiesKey = (leadId: string) => ["leads", leadId, "activities"] as const;

export function toQueryString(filters: ListLeadsFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== "ANY") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function usePipeline() {
  return useQuery({
    queryKey: PIPELINE_KEY,
    queryFn: () => apiFetch<PipelineResponse>("/pipeline"),
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: LeadStatus }) =>
      apiFetch<LeadCardView>(`/leads/${leadId}/status`, { method: "PATCH", body: { status } }),
    onMutate: async ({ leadId, status }) => {
      await queryClient.cancelQueries({ queryKey: PIPELINE_KEY });
      const previous = queryClient.getQueryData<PipelineResponse>(PIPELINE_KEY);
      if (previous) {
        queryClient.setQueryData<PipelineResponse>(PIPELINE_KEY, {
          items: previous.items.map((lead) =>
            lead.id === leadId ? { ...lead, leadStatus: status } : lead,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PIPELINE_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PIPELINE_KEY });
      void queryClient.invalidateQueries({ queryKey: ["leads-list"] });
      void queryClient.invalidateQueries({ queryKey: ["saved-leads"] });
    },
  });
}

export function useLeadsList(filters: ListLeadsFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: LEADS_LIST_KEY(filters),
    queryFn: () => apiFetch<PaginatedLeadCards>(`/leads${toQueryString(filters)}`),
    enabled: options.enabled ?? true,
  });
}

export function useSavedLeads(filters: ListLeadsFilters) {
  return useQuery({
    queryKey: SAVED_LEADS_KEY(filters),
    queryFn: () => apiFetch<PaginatedLeadCards>(`/saved-leads${toQueryString(filters)}`),
  });
}

function invalidateLeadLists(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["saved-leads"] });
  void queryClient.invalidateQueries({ queryKey: ["leads-list"] });
  void queryClient.invalidateQueries({ queryKey: PIPELINE_KEY });
}

export function useSaveLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) =>
      apiFetch<{ saved: true }>(`/leads/${leadId}/save`, { method: "POST" }),
    onSuccess: () => invalidateLeadLists(queryClient),
  });
}

export function useUnsaveLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) =>
      apiFetch<{ saved: false }>(`/leads/${leadId}/save`, { method: "DELETE" }),
    onSuccess: () => invalidateLeadLists(queryClient),
  });
}

export function useLeadActivities(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? activitiesKey(leadId) : ["leads", "none", "activities"],
    queryFn: () => apiFetch<LeadActivityEntry[]>(`/leads/${leadId}/activities`),
    enabled: !!leadId,
  });
}

export function useLogActivity(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: ClientLoggableActivityType; metadata?: Record<string, unknown> }) =>
      apiFetch<LeadActivityEntry>(`/leads/${leadId}/activity`, { method: "POST", body: input }),
    onSuccess: () => {
      if (leadId) void queryClient.invalidateQueries({ queryKey: activitiesKey(leadId) });
    },
  });
}

export function useLeadNotes(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? notesKey(leadId) : ["leads", "none", "notes"],
    queryFn: () => apiFetch<LeadNote[]>(`/leads/${leadId}/notes`),
    enabled: !!leadId,
  });
}

export function useAddNote(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      apiFetch<LeadNote>(`/leads/${leadId}/notes`, { method: "POST", body: { text } }),
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: notesKey(leadId) });
      void queryClient.invalidateQueries({ queryKey: activitiesKey(leadId) });
      invalidateLeadLists(queryClient);
    },
  });
}

export function useOrgTags() {
  return useQuery({
    queryKey: orgTagsKey,
    queryFn: () => apiFetch<Tag[]>("/tags"),
  });
}

export function useLeadTags(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? tagsKey(leadId) : ["leads", "none", "tags"],
    queryFn: () => apiFetch<Tag[]>(`/leads/${leadId}/tags`),
    enabled: !!leadId,
  });
}

export function useAttachTag(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) =>
      apiFetch<Tag>(`/leads/${leadId}/tags`, { method: "POST", body: input }),
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: tagsKey(leadId) });
      void queryClient.invalidateQueries({ queryKey: orgTagsKey });
      invalidateLeadLists(queryClient);
    },
  });
}

export function useDetachTag(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) =>
      apiFetch<{ ok: true }>(`/leads/${leadId}/tags/${tagId}`, { method: "DELETE" }),
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: tagsKey(leadId) });
      invalidateLeadLists(queryClient);
    },
  });
}

export function useLeadFollowUps(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? followUpsKey(leadId) : ["leads", "none", "follow-ups"],
    queryFn: () => apiFetch<FollowUp[]>(`/leads/${leadId}/follow-ups`),
    enabled: !!leadId,
  });
}

export function useCreateFollowUp(leadId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { dueAt: string; note?: string }) =>
      apiFetch<FollowUp>(`/leads/${leadId}/follow-ups`, { method: "POST", body: input }),
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: followUpsKey(leadId) });
      void queryClient.invalidateQueries({ queryKey: activitiesKey(leadId) });
      invalidateLeadLists(queryClient);
    },
  });
}

function useUpdateFollowUpStatus(leadId: string | null, action: "complete" | "cancel") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (followUpId: string) =>
      apiFetch<FollowUp>(`/follow-ups/${followUpId}/${action}`, { method: "PATCH" }),
    onSuccess: () => {
      if (!leadId) return;
      void queryClient.invalidateQueries({ queryKey: followUpsKey(leadId) });
      invalidateLeadLists(queryClient);
    },
  });
}

export function useCompleteFollowUp(leadId: string | null) {
  return useUpdateFollowUpStatus(leadId, "complete");
}

export function useCancelFollowUp(leadId: string | null) {
  return useUpdateFollowUpStatus(leadId, "cancel");
}
