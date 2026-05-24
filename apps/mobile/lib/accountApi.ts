import type { AccountSettingsInput, ProviderAccountInput } from "@knut/shared";
import { supabase } from "./supabase";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

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
  const response = await fetch(`${apiBaseUrl}/api/account/settings`, {
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
  const response = await fetch(`${apiBaseUrl}/api/provider-accounts`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
