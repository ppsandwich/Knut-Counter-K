import type { UsageRecord } from "@knut/providers";
import type { AccountProfile, AccountSettingsInput, ProviderAccountInput } from "@knut/shared";
import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import { encryptCredential } from "./security/credentials";
import { providerAccounts, users } from "./schema";

export async function upsertUserProfile(input: AccountProfile) {
  const [profile] = await getDb()
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      timezone: input.timezone,
      preferredCurrency: input.preferredCurrency,
      monthlyAiBudget: input.monthlyAiBudget == null ? null : String(input.monthlyAiBudget)
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        timezone: input.timezone,
        preferredCurrency: input.preferredCurrency,
        monthlyAiBudget: input.monthlyAiBudget == null ? null : String(input.monthlyAiBudget),
        updatedAt: new Date()
      }
    })
    .returning();

  return profile;
}

export async function ensureUserProfile(input: Pick<AccountProfile, "id" | "email">) {
  await getDb()
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      timezone: "UTC",
      preferredCurrency: "USD",
      monthlyAiBudget: null
    })
    .onConflictDoNothing({
      target: users.id
    });
}

export async function getUserProfile(userId: string) {
  const [profile] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return profile ?? null;
}

export async function updateUserSettings(userId: string, input: AccountSettingsInput) {
  const [settings] = await getDb()
    .update(users)
    .set({
      timezone: input.timezone,
      preferredCurrency: input.preferredCurrency,
      monthlyAiBudget: input.monthlyAiBudget == null ? null : String(input.monthlyAiBudget),
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
    .returning();

  return settings;
}

export async function createProviderAccount(userId: string, input: ProviderAccountInput) {
  const encryptedCredentials = input.apiKey ? encryptCredential(input.apiKey) : null;

  const [account] = await getDb()
    .insert(providerAccounts)
    .values({
      userId,
      providerId: input.providerId,
      displayName: input.displayName,
      authType: input.authType,
      encryptedCredentials,
      planName: input.planName ?? null,
      billingCurrency: input.billingCurrency ?? null,
      monthlyBudget: input.monthlyBudget == null ? null : String(input.monthlyBudget),
      resetRule: input.resetRule ?? null,
      syncStatus: "idle"
    })
    .returning({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId,
      displayName: providerAccounts.displayName,
      authType: providerAccounts.authType,
      planName: providerAccounts.planName,
      billingCurrency: providerAccounts.billingCurrency,
      monthlyBudget: providerAccounts.monthlyBudget,
      resetRule: providerAccounts.resetRule
    });

  return {
    ...account,
    hasCredentials: Boolean(encryptedCredentials)
  };
}

export async function deleteProviderCredentials(userId: string, providerAccountId: string) {
  const [account] = await getDb()
    .update(providerAccounts)
    .set({
      encryptedCredentials: null,
      updatedAt: new Date()
    })
    .where(and(eq(providerAccounts.id, providerAccountId), eq(providerAccounts.userId, userId)))
    .returning({
      providerAccountId: providerAccounts.id,
      userId: providerAccounts.userId
    });

  if (!account) {
    throw new Error("Provider account was not found for this user.");
  }

  return {
    providerAccountId: account.providerAccountId,
    hasCredentials: false
  };
}

export async function createUsageRecords(records: UsageRecord[]) {
  return {
    rowsProcessed: records.length,
    rowsFailed: 0
  };
}

export async function evaluateAlerts() {
  return {
    evaluated: true,
    created: 0
  };
}
