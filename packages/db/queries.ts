import type { UsageRecord } from "@knut/providers";
import type { AccountProfile, AccountProviderSummary, AccountSettingsInput, ProviderAccountInput, ProviderRegistryOption } from "@knut/shared";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { encryptCredential } from "./security/credentials";
import { providerAccounts, providerRegistry, users } from "./schema";

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

export async function listProviderAccountsForUser(userId: string): Promise<AccountProviderSummary[]> {
  const rows = await getDb()
    .select({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId,
      providerName: providerRegistry.providerName,
      displayName: providerAccounts.displayName,
      authType: providerAccounts.authType,
      planName: providerAccounts.planName,
      monthlyBudget: providerAccounts.monthlyBudget,
      resetRule: providerAccounts.resetRule,
      syncStatus: providerAccounts.syncStatus,
      lastSyncAt: providerAccounts.lastSyncAt,
      encryptedCredentials: providerAccounts.encryptedCredentials
    })
    .from(providerAccounts)
    .leftJoin(providerRegistry, eq(providerAccounts.providerId, providerRegistry.providerId))
    .where(and(eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)));

  return rows.map((row) => ({
    id: row.id,
    providerId: row.providerId,
    providerName: row.providerName ?? row.displayName,
    displayName: row.displayName,
    authType: row.authType,
    planName: row.planName,
    monthlyBudget: row.monthlyBudget == null ? null : Number(row.monthlyBudget),
    resetRule: row.resetRule,
    syncStatus: row.syncStatus,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    hasCredentials: Boolean(row.encryptedCredentials)
  }));
}

export async function listProviderRegistryOptions(): Promise<ProviderRegistryOption[]> {
  const rows = await getDb()
    .select({
      providerId: providerRegistry.providerId,
      providerName: providerRegistry.providerName,
      connectorType: providerRegistry.connectorType,
      connectorStatus: providerRegistry.connectorStatus,
      supportsAccountUsageApi: providerRegistry.supportsAccountUsageApi,
      supportsResponseUsageMetadata: providerRegistry.supportsResponseUsageMetadata,
      supportsManualImport: providerRegistry.supportsManualImport,
      supportsCsvImport: providerRegistry.supportsCsvImport,
      supportsJsonImport: providerRegistry.supportsJsonImport,
      priority: providerRegistry.priority
    })
    .from(providerRegistry)
    .orderBy(asc(providerRegistry.priority), asc(providerRegistry.providerName));

  return rows;
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
