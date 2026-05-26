import type { AccountAlert, AccountExportPayload, AccountSettingsInput, AlertEvaluationResult, DashboardPayload, DeepSeekResponseImportInput, ImportUsageInput, ManualUsageInput, OpenRouterGenerationImportInput, PopularModelsPayload, ProviderAccountInput, ProviderAccountUpdateInput, ProviderRegistryOption, RecommendationBundle, RecommendationInput, XaiResponseImportInput } from "@knut/shared";
import { supabase } from "./supabase";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

function getApiUrl(path: string) {
  if (apiBaseUrl) return `${apiBaseUrl}${path}`;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Sign in before changing account data.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export async function saveAccountSettings(input: AccountSettingsInput) {
  const response = await fetch(getApiUrl("/api/account/settings"), {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function createAccountProvider(input: ProviderAccountInput) {
  const response = await fetch(getApiUrl("/api/provider-accounts"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function updateAccountProvider(input: ProviderAccountUpdateInput) {
  const response = await fetch(getApiUrl("/api/provider-accounts"), {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function deleteAccountProvider(providerAccountId: string) {
  const response = await fetch(getApiUrl("/api/provider-accounts"), {
    method: "DELETE",
    headers: await authHeaders(),
    body: JSON.stringify({ providerAccountId })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ ok: boolean; providerAccountId: string; deleted: boolean }>;
}

export async function removeProviderCredentials(providerAccountId: string) {
  const response = await fetch(getApiUrl("/api/provider-accounts/credentials"), {
    method: "DELETE",
    headers: await authHeaders(),
    body: JSON.stringify({ providerAccountId })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ ok: boolean; providerAccountId: string; hasCredentials: boolean }>;
}

export async function syncAccountProfile() {
  const response = await fetch(getApiUrl("/api/account/me"), {
    method: "GET",
    headers: await authHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function exportAccountData(): Promise<AccountExportPayload> {
  const response = await fetch(getApiUrl("/api/account/me?action=export"), {
    method: "GET",
    headers: await authHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json() as { export: AccountExportPayload };
  return data.export;
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  const response = await fetch(getApiUrl("/api/dashboard"), {
    method: "GET",
    headers: await authHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json() as DashboardPayload & { ok?: boolean };
  return {
    profile: data.profile,
    summary: data.summary,
    providers: data.providers
  };
}

export async function syncProviders(providerAccountId?: string): Promise<{ ok: boolean; synced: number; message: string }> {
  const response = await fetch(getApiUrl("/api/providers/sync"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ providerAccountId })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ ok: boolean; synced: number; message: string }>;
}

export async function fetchProviderRegistry(): Promise<ProviderRegistryOption[]> {
  const response = await fetch(getApiUrl("/api/providers/registry"), {
    method: "GET",
    headers: await authHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json() as { providers: ProviderRegistryOption[] };
  return data.providers;
}

export async function createManualUsage(input: ManualUsageInput) {
  const response = await fetch(getApiUrl("/api/usage/manual"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function importUsage(input: ImportUsageInput) {
  const response = await fetch(getApiUrl("/api/import"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ ok: boolean; rowsProcessed: number; rowsFailed: number }>;
}

export async function importOpenRouterGenerations(input: OpenRouterGenerationImportInput) {
  const response = await fetch(getApiUrl("/api/import"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      importType: "openrouter_generation_ids",
      ...input
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ ok: boolean; rowsProcessed: number; rowsFailed: number }>;
}

export async function importXaiResponses(input: XaiResponseImportInput) {
  const response = await fetch(getApiUrl("/api/import"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      importType: "xai_response_payloads",
      ...input
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ ok: boolean; rowsProcessed: number; rowsFailed: number }>;
}

export async function importDeepSeekResponses(input: DeepSeekResponseImportInput) {
  const response = await fetch(getApiUrl("/api/import"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      importType: "deepseek_response_payloads",
      ...input
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ ok: boolean; rowsProcessed: number; rowsFailed: number }>;
}

export async function recommendProvider(input: RecommendationInput): Promise<RecommendationBundle> {
  const response = await fetch(getApiUrl("/api/recommend"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json() as { recommendations: RecommendationBundle };
  return data.recommendations;
}

export async function fetchPopularModels(refresh = false): Promise<PopularModelsPayload> {
  const response = await fetch(getApiUrl("/api/models"), {
    method: refresh ? "POST" : "GET",
    headers: refresh ? await authHeaders() : { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<PopularModelsPayload>;
}

export async function fetchAlerts(): Promise<AccountAlert[]> {
  const response = await fetch(getApiUrl("/api/alerts"), {
    method: "GET",
    headers: await authHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json() as { alerts: AccountAlert[] };
  return data.alerts;
}

export async function evaluateAlerts(): Promise<AlertEvaluationResult> {
  const response = await fetch(getApiUrl("/api/alerts?action=evaluate"), {
    method: "POST",
    headers: await authHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<AlertEvaluationResult>;
}

export async function clearAlerts(): Promise<{ ok: boolean; cleared: number; alerts: AccountAlert[] }> {
  const response = await fetch(getApiUrl("/api/alerts?action=clear"), {
    method: "DELETE",
    headers: await authHeaders()
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ ok: boolean; cleared: number; alerts: AccountAlert[] }>;
}
