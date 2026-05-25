import type { UsageRecord } from "@knut/providers";
import type { NormalisedPrice } from "@knut/pricing";
import type { AccountProfile, AccountProviderSummary, AccountSettingsInput, DashboardSummary, ImportUsageInput, ManualUsageInput, ProviderAccountInput, ProviderRegistryOption, RecommendationInput, RecommendationResult } from "@knut/shared";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { getDb } from "./client";
import { encryptCredential } from "./security/credentials";
import { pricingSnapshots, providerAccounts, providerRegistry, usageRecords, users } from "./schema";

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function numberFromDecimal(value: unknown) {
  if (value == null) return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

const pricingProviderAliases: Record<string, string[]> = {
  openai_api: ["openai_api", "openai"],
  anthropic_api: ["anthropic_api", "anthropic"],
  google_gemini_api: ["google_gemini_api", "google", "gemini"],
  google_vertex_ai: ["google_vertex_ai", "vertex_ai", "vertex"],
  azure_openai: ["azure_openai", "azure"],
  aws_bedrock: ["aws_bedrock", "bedrock"],
  openrouter: ["openrouter"],
  mistral: ["mistral"],
  cohere: ["cohere"],
  xai: ["xai"],
  deepseek: ["deepseek"],
  groq: ["groq"],
  together_ai: ["together_ai", "together"],
  fireworks_ai: ["fireworks_ai", "fireworks"],
  perplexity_api: ["perplexity_api", "perplexity"],
  cerebras: ["cerebras"],
  sambanova: ["sambanova"],
  nebius: ["nebius"],
  nvidia_nim: ["nvidia", "nvidia_nim"],
  cloudflare_workers_ai: ["cloudflare", "cloudflare_workers_ai"]
};

function aliasesForProvider(providerId: string) {
  return new Set([providerId, ...(pricingProviderAliases[providerId] ?? [])]);
}

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
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    timezone: profile.timezone,
    preferredCurrency: profile.preferredCurrency,
    monthlyAiBudget: profile.monthlyAiBudget == null ? null : Number(profile.monthlyAiBudget)
  };
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
  const db = getDb();
  const rows = await db
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

  const currentMonthUsage = await db
    .select({
      providerAccountId: usageRecords.providerAccountId,
      totalTokens: usageRecords.totalTokens,
      costAmount: usageRecords.costAmount
    })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), gte(usageRecords.observedAt, monthStart())));

  const usageByAccount = currentMonthUsage.reduce<Record<string, { spend: number; tokens: number; records: number }>>((acc, record) => {
    const current = acc[record.providerAccountId] ?? { spend: 0, tokens: 0, records: 0 };
    current.spend += numberFromDecimal(record.costAmount);
    current.tokens += record.totalTokens ?? 0;
    current.records += 1;
    acc[record.providerAccountId] = current;
    return acc;
  }, {});

  return rows.map((row) => ({
    ...(() => {
      const usage = usageByAccount[row.id] ?? { spend: 0, tokens: 0, records: 0 };
      return {
        currentMonthSpend: usage.spend,
        currentMonthTokens: usage.tokens,
        currentMonthRecords: usage.records
      };
    })(),
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

export async function getDashboardSummaryForUser(userId: string, profile: AccountProfile | null): Promise<DashboardSummary> {
  const records = await getDb()
    .select({
      totalTokens: usageRecords.totalTokens,
      costAmount: usageRecords.costAmount
    })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), gte(usageRecords.observedAt, monthStart())));

  const monthlySpend = records.reduce((total, record) => total + numberFromDecimal(record.costAmount), 0);
  const totalTokens = records.reduce((total, record) => total + (record.totalTokens ?? 0), 0);
  const monthlyBudget = profile?.monthlyAiBudget ?? 0;
  const dayOfMonth = Math.max(new Date().getUTCDate(), 1);
  const daysInMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)).getUTCDate();
  const projectedSpend = records.length ? monthlySpend / dayOfMonth * daysInMonth : 0;
  const budgetRatio = monthlyBudget > 0 ? monthlySpend / monthlyBudget : 0;

  return {
    monthlySpend,
    monthlyBudget,
    totalTokens,
    projectedSpend,
    status: budgetRatio >= 1 ? "danger" : budgetRatio >= 0.75 ? "warning" : "healthy",
    statusText: records.length
      ? budgetRatio >= 1
        ? "Budget is officially making noises."
        : budgetRatio >= 0.75
          ? "Spend is getting a little crispy."
          : "Everything looks boring. Excellent."
      : "No usage records yet. The meter is waiting politely."
  };
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

export async function createManualUsageRecord(userId: string, input: ManualUsageInput) {
  const [account] = await getDb()
    .select({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId
    })
    .from(providerAccounts)
    .where(and(eq(providerAccounts.id, input.providerAccountId), eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)))
    .limit(1);

  if (!account) {
    throw new Error("Provider account was not found for this user.");
  }

  const inputTokens = input.inputTokens ?? null;
  const outputTokens = input.outputTokens ?? null;
  const totalTokens = input.totalTokens ?? (inputTokens ?? 0) + (outputTokens ?? 0);

  const [record] = await getDb()
    .insert(usageRecords)
    .values({
      userId,
      providerAccountId: account.id,
      providerId: account.providerId,
      modelId: input.modelId?.trim() || null,
      sourceType: "manual_usage_entry",
      sourceRef: input.sourceRef?.trim() || null,
      inputTokens,
      outputTokens,
      totalTokens,
      requestCount: input.requestCount ?? null,
      messageCount: input.messageCount ?? null,
      costAmount: input.costAmount == null ? null : String(input.costAmount),
      costCurrency: input.costCurrency ?? "USD",
      confidence: "manual",
      observedAt: new Date(input.observedAt)
    })
    .returning({
      id: usageRecords.id,
      providerAccountId: usageRecords.providerAccountId,
      providerId: usageRecords.providerId,
      totalTokens: usageRecords.totalTokens,
      costAmount: usageRecords.costAmount,
      costCurrency: usageRecords.costCurrency,
      confidence: usageRecords.confidence,
      observedAt: usageRecords.observedAt
    });

  return {
    ...record,
    costAmount: record.costAmount == null ? null : Number(record.costAmount),
    observedAt: record.observedAt.toISOString()
  };
}

export async function importUsageRecordsForUser(userId: string, input: ImportUsageInput) {
  const [account] = await getDb()
    .select({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId
    })
    .from(providerAccounts)
    .where(and(eq(providerAccounts.id, input.providerAccountId), eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)))
    .limit(1);

  if (!account) {
    throw new Error("Provider account was not found for this user.");
  }

  const validRows = input.rows
    .map((row) => {
      const inputTokens = row.inputTokens ?? null;
      const outputTokens = row.outputTokens ?? null;
      const totalTokens = row.totalTokens ?? (inputTokens ?? 0) + (outputTokens ?? 0);
      const observedAt = new Date(row.observedAt);

      if (Number.isNaN(observedAt.getTime())) return null;

      return {
        userId,
        providerAccountId: account.id,
        providerId: account.providerId,
        modelId: row.modelId?.trim() || null,
        sourceType: "csv_json_import",
        sourceRef: row.sourceRef?.trim() || null,
        inputTokens,
        outputTokens,
        totalTokens,
        requestCount: row.requestCount ?? null,
        messageCount: row.messageCount ?? null,
        costAmount: row.costAmount == null ? null : String(row.costAmount),
        costCurrency: row.costCurrency ?? "USD",
        confidence: row.confidence ?? "provider_reported",
        observedAt
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!validRows.length) {
    return {
      rowsProcessed: 0,
      rowsFailed: input.rows.length
    };
  }

  await getDb().insert(usageRecords).values(validRows);

  return {
    rowsProcessed: validRows.length,
    rowsFailed: input.rows.length - validRows.length
  };
}

export async function insertPricingSnapshots(snapshots: NormalisedPrice[]) {
  if (!snapshots.length) {
    return { inserted: 0 };
  }

  const values = snapshots.map((snapshot) => ({
      providerId: snapshot.providerId,
      modelId: snapshot.modelId,
      modelDisplayName: snapshot.modelDisplayName,
      inputPricePer1mTokensUsd: snapshot.inputPricePer1mTokensUsd == null ? null : String(snapshot.inputPricePer1mTokensUsd),
      outputPricePer1mTokensUsd: snapshot.outputPricePer1mTokensUsd == null ? null : String(snapshot.outputPricePer1mTokensUsd),
      cachedInputPricePer1mTokensUsd: snapshot.cachedInputPricePer1mTokensUsd == null ? null : String(snapshot.cachedInputPricePer1mTokensUsd),
      reasoningPricePer1mTokensUsd: snapshot.reasoningPricePer1mTokensUsd == null ? null : String(snapshot.reasoningPricePer1mTokensUsd),
      contextWindow: snapshot.contextWindow ?? null,
      sourceName: snapshot.sourceName,
      sourceConfidence: snapshot.sourceConfidence,
      sourcePriority: snapshot.sourcePriority,
      fetchedAt: new Date(snapshot.fetchedAt),
      effectiveFrom: new Date(snapshot.fetchedAt)
    }));

  const chunkSize = 500;
  for (let index = 0; index < values.length; index += chunkSize) {
    await getDb().insert(pricingSnapshots).values(values.slice(index, index + chunkSize));
  }

  return { inserted: snapshots.length };
}

export async function recommendProviderForUser(userId: string, input: RecommendationInput): Promise<RecommendationResult | null> {
  const connectedProviders = await listProviderAccountsForUser(userId);
  if (!connectedProviders.length) {
    return null;
  }

  const rows = await getDb()
    .select({
      providerId: pricingSnapshots.providerId,
      modelId: pricingSnapshots.modelId,
      modelDisplayName: pricingSnapshots.modelDisplayName,
      inputPricePer1mTokensUsd: pricingSnapshots.inputPricePer1mTokensUsd,
      outputPricePer1mTokensUsd: pricingSnapshots.outputPricePer1mTokensUsd,
      sourceName: pricingSnapshots.sourceName,
      sourceConfidence: pricingSnapshots.sourceConfidence,
      sourcePriority: pricingSnapshots.sourcePriority,
      fetchedAt: pricingSnapshots.fetchedAt
    })
    .from(pricingSnapshots)
    .orderBy(asc(pricingSnapshots.sourcePriority), desc(pricingSnapshots.fetchedAt))
    .limit(10_000);

  const latestPrices = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const key = `${row.providerId}:${row.modelId}`;
    const existing = latestPrices.get(key);
    if (!existing) {
      latestPrices.set(key, row);
      continue;
    }

    if (row.sourcePriority < existing.sourcePriority || row.fetchedAt > existing.fetchedAt) {
      latestPrices.set(key, row);
    }
  }

  const inputTokens = Math.max(0, Math.trunc(input.estimatedInputTokens));
  const outputTokens = Math.max(0, Math.trunc(input.estimatedOutputTokens));
  const candidates = [];

  for (const account of connectedProviders) {
    const aliases = aliasesForProvider(account.providerId);
    const budgetRatio = account.monthlyBudget && account.monthlyBudget > 0 ? account.currentMonthSpend / account.monthlyBudget : 0;

    if (input.excludeNearCapProviders && budgetRatio >= 0.95) {
      continue;
    }

    for (const price of latestPrices.values()) {
      if (!aliases.has(price.providerId)) {
        continue;
      }

      const inputPrice = numberFromDecimal(price.inputPricePer1mTokensUsd);
      const outputPrice = numberFromDecimal(price.outputPricePer1mTokensUsd);
      if (inputPrice <= 0 && outputPrice <= 0) {
        continue;
      }

      const estimatedCostUsd = inputTokens / 1_000_000 * inputPrice + outputTokens / 1_000_000 * outputPrice;
      const capPenalty = budgetRatio >= 0.95 ? estimatedCostUsd * 4 : budgetRatio >= 0.8 ? estimatedCostUsd * 1.5 : 0;
      const confidencePenalty = price.sourceConfidence === "official" ? 0 : estimatedCostUsd * 0.05;

      candidates.push({
        account,
        price,
        estimatedCostUsd,
        score: estimatedCostUsd + capPenalty + confidencePenalty,
        budgetRatio
      });
    }
  }

  const best = candidates.sort((a, b) => a.score - b.score)[0];
  if (!best) {
    return null;
  }

  const capWarning = best.budgetRatio >= 0.95
    ? `${best.account.providerName} is above 95% of its monthly budget.`
    : best.budgetRatio >= 0.8
      ? `${best.account.providerName} is above 80% of its monthly budget.`
      : null;

  const freshnessDays = Math.floor((Date.now() - best.price.fetchedAt.getTime()) / 86_400_000);
  const staleNote = freshnessDays > 14 ? " Pricing is a bit stale, so keep one eyebrow raised." : "";
  const capNote = capWarning ? " It can do the job, but the budget meter is warm." : "";

  return {
    recommendedProvider: best.account.providerName,
    recommendedProviderId: best.account.providerId,
    providerAccountId: best.account.id,
    recommendedModel: best.price.modelDisplayName,
    estimatedCostUsd: best.estimatedCostUsd,
    capWarning,
    reason: `Cheapest connected option found from ${best.price.sourceName}.${capNote}${staleNote}`,
    priceSource: best.price.sourceName,
    priceConfidence: best.price.sourceConfidence,
    fetchedAt: best.price.fetchedAt.toISOString()
  };
}

export async function evaluateAlerts() {
  return {
    evaluated: true,
    created: 0
  };
}
