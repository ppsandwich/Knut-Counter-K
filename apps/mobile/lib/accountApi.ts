import type { AccountSettingsInput, DashboardPayload, ProviderAccountInput } from "@knut/shared";
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
    providers: data.providers
  };
}
