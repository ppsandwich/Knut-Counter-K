import { anthropicConnector, deepSeekConnector, geminiConnector, openAiConnector, openRouterConnector, xaiConnector, type UsageCap, type UsageRecord } from "@knut/providers";
import type { ArtificialAnalysisBenchmark, NormalisedPrice } from "@knut/pricing";
import type { AccountAlert, AccountExportPayload, AccountProfile, AccountProviderSummary, AccountSettingsInput, AlertEvaluationResult, DashboardModelPick, DashboardModelPicks, DashboardSummary, ImportUsageInput, ManualUsageInput, ProviderAccountInput, ProviderAccountUpdateInput, ProviderRegistryOption, RecommendationBundle, RecommendationInput, RecommendationResult } from "@knut/shared";
import { and, asc, desc, eq, gte, inArray, ne, or } from "drizzle-orm";
import { getDb } from "./client";
import { decryptCredential, encryptCredential } from "./security/credentials";
import { alerts, importJobs, modelBenchmarkSnapshots, pricingSnapshots, providerAccounts, providerRegistry, usageCaps, usageRecords, users } from "./schema";

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function dayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function numberFromDecimal(value: unknown) {
  if (value == null) return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function optionalNumberFromDecimal(value: unknown) {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
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

function displayProviderName(providerId: string) {
  return providerId
    .replace(/^~/, "")
    .split(/[-_]/)
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function alertKey(input: { alertType: string; providerAccountId: string | null; title: string }) {
  return `${input.alertType}:${input.providerAccountId ?? "account"}:${input.title}`;
}

function toAccountAlert(row: typeof alerts.$inferSelect): AccountAlert {
  return {
    id: row.id,
    providerAccountId: row.providerAccountId,
    alertType: row.alertType,
    severity: row.severity as AccountAlert["severity"],
    title: row.title,
    body: row.body,
    isRead: row.isRead,
    isSnoozed: row.isSnoozed,
    createdAt: row.createdAt.toISOString()
  };
}

function estimateModelIntelligenceScore(modelId: string, modelDisplayName: string, providerId: string) {
  const text = `${providerId} ${modelId} ${modelDisplayName}`.toLowerCase();
  let score = 50;

  if (text.includes("opus") || text.includes("gpt-5") || text.includes("o3") || text.includes("o4") || text.includes("pro")) score += 34;
  if (text.includes("sonnet") || text.includes("gpt-4") || text.includes("gemini-2.5") || text.includes("gemini 2.5") || text.includes("qwen3") || text.includes("llama-4")) score += 26;
  if (text.includes("deepseek-r1") || text.includes("reason") || text.includes("thinking")) score += 22;
  if (text.includes("70b") || text.includes("72b") || text.includes("120b") || text.includes("405b") || text.includes("671b")) score += 18;
  if (text.includes("mistral-large") || text.includes("command-r-plus")) score += 18;
  if (text.includes("haiku") || text.includes("mini") || text.includes("flash") || text.includes("small") || text.includes("lite") || text.includes("8b")) score -= 12;
  if (text.includes("embedding") || text.includes("moderation") || text.includes("rerank") || text.includes("tts") || text.includes("whisper") || text.includes("image")) score -= 35;

  return Math.min(100, Math.max(10, score));
}

type RecommendationTaskKind = "coding" | "summarising" | "writing" | "analysis" | "image" | "general";

function taskKindForRecommendation(taskType: string | undefined): RecommendationTaskKind {
  const text = (taskType ?? "").toLowerCase();

  if (/\b(code|coding|debug|logs?|stack traces?|pull request|pr\b|diff|tests?|refactor|codebase|website|web app|app from scratch|product feature|full-stack|app feature|moderni[sz]e|audit)\b/.test(text)) {
    return "coding";
  }

  if (/\b(summarise|summarize|summary|pasted text|pdf)\b/.test(text)) {
    return "summarising";
  }

  if (/\b(write|writing|draft|report|email|message|polish|rewrite|copy)\b/.test(text)) {
    return "writing";
  }

  if (/\b(research|compare|synthesis|analy[sz]e|data|spreadsheet|math)\b/.test(text)) {
    return "analysis";
  }

  if (/\b(image|photo|illustration|video|visual)\b/.test(text)) {
    return "image";
  }

  return "general";
}

function normaliseModelMatchKey(value: string) {
  return value
    .toLowerCase()
    .replace(/^~/, "")
    .replace(/:.+$/, "")
    .replace(/^(openai|anthropic|google|x-ai|xai|deepseek|mistralai|mistral|cohere|groq|perplexity|openrouter)[/:_-]+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function modelMatchKeys(modelId: string, modelDisplayName: string) {
  const keys = [
    normaliseModelMatchKey(modelId),
    normaliseModelMatchKey(modelDisplayName)
  ];
  const [, modelIdWithoutProvider] = modelId.replace(/^~/, "").split("/");
  if (modelIdWithoutProvider) {
    keys.push(normaliseModelMatchKey(modelIdWithoutProvider));
  }

  return [...new Set(keys.filter(Boolean))];
}

function modelVersionParts(modelId: string, modelDisplayName: string) {
  const text = `${modelId} ${modelDisplayName}`.toLowerCase();
  const geminiVersionMatch = text.match(/gemini[^0-9]*(\d+(?:[._-]\d+){0,3})/);
  if (geminiVersionMatch) {
    const parts = geminiVersionMatch[1].split(/[._-]/).map((part) => Number(part));
    return parts.every((part) => Number.isFinite(part)) ? parts : null;
  }

  const versionMatch = text.match(/(?:^|[^a-z0-9])(?:v|version)?(\d+(?:[._-]\d+){0,3})(?=$|[^a-z0-9])/);
  if (!versionMatch) return null;

  const parts = versionMatch[1].split(/[._-]/).map((part) => Number(part));
  return parts.every((part) => Number.isFinite(part)) ? parts : null;
}

function modelFamilyKey(modelId: string, modelDisplayName: string) {
  const normalisedText = `${modelId} ${modelDisplayName}`
    .toLowerCase()
    .replace(/^~/, "")
    .replace(/:.+$/, "")
    .replace(/^(openai|anthropic|google|x-ai|xai|deepseek|mistralai|mistral|cohere|groq|perplexity|openrouter)[/:_-]+/, "")
    .replace(/[^a-z0-9]+/g, " ");

  if (normalisedText.includes("gemini")) {
    if (/\bdeep think\b/.test(normalisedText)) return "gemini-deep-think";
    if (/\bflash lite\b|\bflashlite\b/.test(normalisedText)) return "gemini-flash-lite";
    if (/\bflash\b/.test(normalisedText)) return "gemini-flash";
    if (/\bpro\b/.test(normalisedText)) return normalisedText.includes("image") ? "gemini-pro-image" : "gemini-pro";
  }

  const text = `${modelId} ${modelDisplayName}`
    .toLowerCase()
    .replace(/^~/, "")
    .replace(/:.+$/, "")
    .replace(/^(openai|anthropic|google|x-ai|xai|deepseek|mistralai|mistral|cohere|groq|perplexity|openrouter)[/:_-]+/, "")
    .replace(/\b(\d+(?:\.\d+)?)([bkmt]b)\b/g, " size$1$2 ")
    .replace(/\b(?:v|version)?\d+(?:[._-]\d+){0,3}\b/g, " ")
    .replace(/\b(?:20\d{2}[._-]?\d{2}[._-]?\d{2}|20\d{2}[._-]?\d{2}|20\d{2})\b/g, " ")
    .replace(/\b(?:latest|preview|beta|alpha|experimental|instruct|chat|turbo)\b/g, " ")
    .replace(/[^a-z]+/g, "");

  return text || null;
}

function compareVersionParts(a: number[], b: number[]) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const aPart = a[index] ?? 0;
    const bPart = b[index] ?? 0;
    if (aPart !== bPart) return aPart - bPart;
  }

  return 0;
}

function scaledBenchmarkScore(value: unknown) {
  const parsed = numberFromDecimal(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function weightedBenchmarkScore(
  benchmarks: Array<{ value: unknown; weight: number }>
) {
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const benchmark of benchmarks) {
    const score = scaledBenchmarkScore(benchmark.value);
    if (score == null) continue;

    weightedTotal += score * benchmark.weight;
    totalWeight += benchmark.weight;
  }

  if (!totalWeight) return null;
  return Math.round(Math.min(100, Math.max(0, weightedTotal / totalWeight)));
}

function median(values: number[]) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;

  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rankScores<T>(items: T[], sortedItems: T[]) {
  const denominator = Math.max(1, sortedItems.length - 1);
  const scores = new Map<T, number>();

  sortedItems.forEach((item, index) => {
    scores.set(item, 1 - index / denominator);
  });

  return scores;
}

function positiveNumberFromDecimal(value: unknown) {
  const parsed = numberFromDecimal(value);
  return parsed > 0 ? parsed : null;
}

function nestedPositiveNumber(source: unknown, ...keys: string[]) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const directValue = positiveNumberFromDecimal(record[key]);
    if (directValue != null) return directValue;

    const pathValue = key.split(".").reduce<unknown>((value, segment) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
      return (value as Record<string, unknown>)[segment];
    }, record);
    const parsedPathValue = positiveNumberFromDecimal(pathValue);
    if (parsedPathValue != null) return parsedPathValue;
  }

  return null;
}

function firstPositiveNumber(source: unknown): number | null {
  if (!source || typeof source !== "object") return positiveNumberFromDecimal(source);

  if (Array.isArray(source)) {
    for (const item of source) {
      const parsed = firstPositiveNumber(item);
      if (parsed != null) return parsed;
    }

    return null;
  }

  const record = source as Record<string, unknown>;
  for (const key of ["total", "total_tokens", "tokens", "token_use", "token_usage", "output", "output_tokens", "reasoning", "reasoning_tokens", "answer", "answer_tokens"]) {
    const parsed = positiveNumberFromDecimal(record[key]);
    if (parsed != null) return parsed;
  }

  for (const value of Object.values(record)) {
    const parsed = firstPositiveNumber(value);
    if (parsed != null) return parsed;
  }

  return null;
}

function findPositiveNumberByKey(source: unknown, predicate: (key: string) => boolean): number | null {
  if (!source || typeof source !== "object") return null;

  if (Array.isArray(source)) {
    for (const item of source) {
      const nestedValue = findPositiveNumberByKey(item, predicate);
      if (nestedValue != null) return nestedValue;
    }

    return null;
  }

  for (const [key, value] of Object.entries(source)) {
    if (predicate(key)) {
      const parsed = positiveNumberFromDecimal(value);
      if (parsed != null) return parsed;

      const nestedParsed = firstPositiveNumber(value);
      if (nestedParsed != null) return nestedParsed;
    }

    const nestedValue = findPositiveNumberByKey(value, predicate);
    if (nestedValue != null) return nestedValue;
  }

  return null;
}

function isTokenUseKey(key: string) {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (!normalised.includes("token")) return false;
  if (/(price|cost|usd|dollar|rate|per|second|latency|speed|throughput|context|window|limit)/.test(normalised)) return false;

  return (
    /(output|reasoning|answer|completion).*(used|use|count|total)/.test(normalised)
    || /(used|use|count|total).*(output|reasoning|answer|completion)/.test(normalised)
    || /intelligence.*index.*token/.test(normalised)
    || /token.*(use|usage|used|count|total)/.test(normalised)
    || /(use|usage|used|count|total).*token/.test(normalised)
  );
}

function isTokenEfficiencyKey(key: string) {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (/(price|cost|usd|dollar|rate|per|second|latency|speed|throughput|context|window|limit)/.test(normalised)) return false;

  return normalised.includes("token") && /(efficiency|efficient|verbosity|verbose)/.test(normalised);
}

function knownArtificialAnalysisOutputTokensUsed(modelId: string, modelDisplayName: string) {
  const text = `${modelId} ${modelDisplayName}`.toLowerCase();

  if (/gpt[-\s]?5\.?5/.test(text)) {
    if (/\b(non[-\s]?reasoning|minimal)\b/.test(text)) return 2_800_000;
    if (/\blow\b/.test(text)) return 7_000_000;
    if (/\bmedium\b/.test(text)) return 22_000_000;
    if (/\bhigh\b/.test(text) && !/\bxhigh\b/.test(text)) return 45_000_000;
    if (/\bxhigh\b|\bgpt[-\s]?5\.?5\b/.test(text)) return 75_000_000;
  }

  if (/\b(ring|ling)[-\s]?2\.?6\b/.test(text)) {
    return 100_000_000;
  }

  return null;
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

export async function exportAccountData(userId: string): Promise<AccountExportPayload> {
  const db = getDb();
  const profile = await getUserProfile(userId);
  const providerAccountRows = await db
    .select({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId,
      displayName: providerAccounts.displayName,
      authType: providerAccounts.authType,
      planName: providerAccounts.planName,
      billingCurrency: providerAccounts.billingCurrency,
      billingCycleStart: providerAccounts.billingCycleStart,
      billingCycleEnd: providerAccounts.billingCycleEnd,
      resetRule: providerAccounts.resetRule,
      monthlyBudget: providerAccounts.monthlyBudget,
      isActive: providerAccounts.isActive,
      lastSyncAt: providerAccounts.lastSyncAt,
      syncStatus: providerAccounts.syncStatus,
      createdAt: providerAccounts.createdAt,
      updatedAt: providerAccounts.updatedAt,
      encryptedCredentials: providerAccounts.encryptedCredentials
    })
    .from(providerAccounts)
    .where(eq(providerAccounts.userId, userId));
  const usageRecordRows = await db.select().from(usageRecords).where(eq(usageRecords.userId, userId)).orderBy(desc(usageRecords.observedAt));
  const usageCapRows = await db.select().from(usageCaps).where(eq(usageCaps.userId, userId)).orderBy(desc(usageCaps.createdAt));
  const alertRows = await db.select().from(alerts).where(eq(alerts.userId, userId)).orderBy(desc(alerts.createdAt));
  const importJobRows = await db.select().from(importJobs).where(eq(importJobs.userId, userId)).orderBy(desc(importJobs.createdAt));

  return {
    exportedAt: new Date().toISOString(),
    profile,
    providerAccounts: providerAccountRows.map(({ encryptedCredentials, ...account }) => ({
      ...account,
      hasCredentials: Boolean(encryptedCredentials)
    })),
    usageRecords: usageRecordRows,
    usageCaps: usageCapRows,
    alerts: alertRows,
    importJobs: importJobRows
  };
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

export async function updateProviderAccount(userId: string, input: ProviderAccountUpdateInput) {
  const updates: Partial<typeof providerAccounts.$inferInsert> = {
    updatedAt: new Date()
  };

  if (input.displayName !== undefined) updates.displayName = input.displayName;
  if (input.planName !== undefined) updates.planName = input.planName;
  if (input.billingCurrency !== undefined) updates.billingCurrency = input.billingCurrency;
  if (input.monthlyBudget !== undefined) updates.monthlyBudget = input.monthlyBudget == null ? null : String(input.monthlyBudget);
  if (input.resetRule !== undefined) updates.resetRule = input.resetRule;
  if (input.syncStatus !== undefined) updates.syncStatus = input.syncStatus;

  const [account] = await getDb()
    .update(providerAccounts)
    .set(updates)
    .where(and(eq(providerAccounts.id, input.providerAccountId), eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)))
    .returning({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId,
      displayName: providerAccounts.displayName,
      authType: providerAccounts.authType,
      planName: providerAccounts.planName,
      billingCurrency: providerAccounts.billingCurrency,
      monthlyBudget: providerAccounts.monthlyBudget,
      resetRule: providerAccounts.resetRule,
      syncStatus: providerAccounts.syncStatus,
      encryptedCredentials: providerAccounts.encryptedCredentials
    });

  if (!account) {
    throw new Error("Provider account was not found for this user.");
  }

  return {
    ...account,
    monthlyBudget: account.monthlyBudget == null ? null : Number(account.monthlyBudget),
    hasCredentials: Boolean(account.encryptedCredentials),
    encryptedCredentials: undefined
  };
}

export async function softDeleteProviderAccount(userId: string, providerAccountId: string) {
  const [account] = await getDb()
    .update(providerAccounts)
    .set({
      isActive: false,
      encryptedCredentials: null,
      syncStatus: "paused",
      updatedAt: new Date()
    })
    .where(and(eq(providerAccounts.id, providerAccountId), eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)))
    .returning({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId,
      userId: providerAccounts.userId
    });

  if (!account) {
    throw new Error("Provider account was not found for this user.");
  }

  return {
    providerAccountId: account.id,
    deleted: true
  };
}

async function upsertUsageCapsForAccount(userId: string, providerAccountId: string, caps: UsageCap[]) {
  let processed = 0;

  for (const cap of caps) {
    const [existing] = await getDb()
      .select({
        id: usageCaps.id
      })
      .from(usageCaps)
      .where(and(eq(usageCaps.userId, userId), eq(usageCaps.providerAccountId, providerAccountId), eq(usageCaps.capType, cap.capType)))
      .limit(1);

    const values = {
      capLabel: cap.capLabel,
      capAmount: String(cap.capAmount),
      capUnit: cap.capUnit,
      usedAmount: String(cap.usedAmount),
      resetAt: cap.resetAt ? new Date(cap.resetAt) : null,
      resetCadence: null,
      confidence: cap.confidence,
      updatedAt: new Date()
    };

    if (existing) {
      await getDb().update(usageCaps).set(values).where(eq(usageCaps.id, existing.id));
    } else {
      await getDb().insert(usageCaps).values({
        userId,
        providerAccountId,
        capType: cap.capType,
        ...values
      });
    }

    processed += 1;
  }

  return processed;
}

async function insertSyncedUsageRecords(userId: string, providerAccountId: string, providerId: string, records: UsageRecord[]) {
  const validRecords = records.filter((record) => record.sourceRef);
  if (!validRecords.length) {
    return {
      rowsProcessed: 0,
      rowsSkipped: records.length
    };
  }

  const sourceRefs = validRecords.map((record) => record.sourceRef!);
  const existingRows = await getDb()
    .select({
      sourceRef: usageRecords.sourceRef
    })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), eq(usageRecords.providerAccountId, providerAccountId), inArray(usageRecords.sourceRef, sourceRefs)));
  const existingRefs = new Set(existingRows.map((row) => row.sourceRef).filter(Boolean));
  const rowsToInsert = validRecords
    .filter((record) => !existingRefs.has(record.sourceRef ?? null))
    .map((record) => {
      const inputTokens = record.inputTokens ?? null;
      const outputTokens = record.outputTokens ?? null;
      const cachedTokens = record.cachedTokens ?? null;
      const reasoningTokens = record.reasoningTokens ?? null;
      const totalTokens = (inputTokens ?? 0) + (outputTokens ?? 0) + (reasoningTokens ?? 0);

      return {
        userId,
        providerAccountId,
        providerId,
        modelId: record.modelId ?? null,
        sourceType: record.sourceType ?? "provider_usage_api",
        sourceRef: record.sourceRef ?? null,
        inputTokens,
        outputTokens,
        cachedTokens,
        reasoningTokens,
        imageUnits: record.imageUnits == null ? null : String(record.imageUnits),
        totalTokens: totalTokens || null,
        requestCount: record.requestCount ?? null,
        costAmount: record.costAmount == null ? null : String(record.costAmount),
        costCurrency: record.costCurrency ?? null,
        confidence: record.confidence,
        observedAt: new Date(record.observedAt)
      };
    });

  if (rowsToInsert.length) {
    await getDb().insert(usageRecords).values(rowsToInsert);
  }

  return {
    rowsProcessed: rowsToInsert.length,
    rowsSkipped: validRecords.length - rowsToInsert.length
  };
}

export async function markProviderAccountsSynced(userId: string, providerAccountId?: string) {
  const db = getDb();
  const targetRows = await db
    .select({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId,
      displayName: providerAccounts.displayName,
      encryptedCredentials: providerAccounts.encryptedCredentials,
      syncStatus: providerAccounts.syncStatus
    })
    .from(providerAccounts)
    .where(providerAccountId
      ? and(eq(providerAccounts.userId, userId), eq(providerAccounts.id, providerAccountId), eq(providerAccounts.isActive, true))
      : and(eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)));

  let synced = 0;
  let capsProcessed = 0;
  const messages: string[] = [];

  for (const account of targetRows) {
    if (account.syncStatus === "paused") {
      messages.push(`${account.displayName} is paused.`);
      continue;
    }

    if (account.providerId === "openrouter") {
      if (!account.encryptedCredentials) {
        messages.push(`${account.displayName} needs an API key before OpenRouter can refresh.`);
        continue;
      }

      const apiKey = decryptCredential(account.encryptedCredentials);
      const caps = await openRouterConnector.fetchCaps?.({
        providerAccountId: account.id,
        credentials: { apiKey }
      });
      capsProcessed += await upsertUsageCapsForAccount(userId, account.id, caps ?? []);
      messages.push(`${account.displayName} refreshed OpenRouter credits.`);
    } else if (account.providerId === "openai_api") {
      if (!account.encryptedCredentials) {
        messages.push(`${account.displayName} needs an API key before OpenAI can refresh.`);
        continue;
      }

      const apiKey = decryptCredential(account.encryptedCredentials);
      const usage = await openAiConnector.fetchUsage?.({
        providerAccountId: account.id,
        credentials: { apiKey },
        since: monthStart().toISOString(),
        until: new Date().toISOString()
      });
      const inserted = await insertSyncedUsageRecords(userId, account.id, account.providerId, usage ?? []);
      messages.push(`${account.displayName} pulled ${inserted.rowsProcessed} OpenAI usage/cost rows${inserted.rowsSkipped ? ` and skipped ${inserted.rowsSkipped} duplicates` : ""}.`);
    } else if (account.providerId === "anthropic_api") {
      if (!account.encryptedCredentials) {
        messages.push(`${account.displayName} needs an API key before Anthropic can refresh.`);
        continue;
      }

      const apiKey = decryptCredential(account.encryptedCredentials);
      const usage = await anthropicConnector.fetchUsage?.({
        providerAccountId: account.id,
        credentials: { apiKey },
        since: monthStart().toISOString(),
        until: new Date().toISOString()
      });
      const inserted = await insertSyncedUsageRecords(userId, account.id, account.providerId, usage ?? []);
      messages.push(`${account.displayName} pulled ${inserted.rowsProcessed} Anthropic usage/cost rows${inserted.rowsSkipped ? ` and skipped ${inserted.rowsSkipped} duplicates` : ""}.`);
    } else if (account.providerId === "google_gemini_api") {
      if (!account.encryptedCredentials) {
        messages.push(`${account.displayName} needs an API key before Gemini can validate the connector.`);
        continue;
      }

      const apiKey = decryptCredential(account.encryptedCredentials);
      const validation = await geminiConnector.validateCredentials?.({ apiKey });
      messages.push(`${account.displayName}: ${validation?.message ?? "Gemini key validated. Usage still requires response metadata, import, or future Cloud Billing integration."}`);
    } else if (account.providerId === "xai") {
      if (!account.encryptedCredentials) {
        messages.push(`${account.displayName} needs an API key before xAI can validate the connector.`);
        continue;
      }

      const apiKey = decryptCredential(account.encryptedCredentials);
      const validation = await xaiConnector.validateCredentials?.({ apiKey });
      messages.push(`${account.displayName}: ${validation?.message ?? "xAI key validated. Paste response JSON to import exact usage and cost."}`);
    } else if (account.providerId === "deepseek") {
      if (!account.encryptedCredentials) {
        messages.push(`${account.displayName} needs an API key before DeepSeek can refresh.`);
        continue;
      }

      const apiKey = decryptCredential(account.encryptedCredentials);
      const caps = await deepSeekConnector.fetchCaps?.({
        providerAccountId: account.id,
        credentials: { apiKey }
      });
      capsProcessed += await upsertUsageCapsForAccount(userId, account.id, caps ?? []);
      messages.push(`${account.displayName} refreshed DeepSeek balance. Paste response JSON to import exact token usage.`);
    } else {
      messages.push(`${account.displayName} is manual/import only until its live connector is implemented.`);
    }

    await db
      .update(providerAccounts)
      .set({
        lastSyncAt: new Date(),
        syncStatus: "idle",
        updatedAt: new Date()
      })
      .where(and(eq(providerAccounts.userId, userId), eq(providerAccounts.id, account.id)));

    synced += 1;
  }

  return {
    synced,
    capsProcessed,
    providerAccountIds: targetRows.map((row) => row.id),
    message: messages.join(" ")
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
      costAmount: usageRecords.costAmount,
      observedAt: usageRecords.observedAt
    })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), gte(usageRecords.observedAt, monthStart())));

  const last24hStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last7dStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const currentMonthStart = monthStart();
  const now = new Date();
  const bucketCount = 12;
  const bucketMs = Math.max(1, (now.getTime() - currentMonthStart.getTime()) / bucketCount);
  const usageByAccount = currentMonthUsage.reduce<Record<string, { spend: number; tokens: number; records: number; last24hSpend: number; last24hTokens: number; last7dSpend: number; last7dTokens: number; sparklineData: number[] }>>((acc, record) => {
    const current = acc[record.providerAccountId] ?? { spend: 0, tokens: 0, records: 0, last24hSpend: 0, last24hTokens: 0, last7dSpend: 0, last7dTokens: 0, sparklineData: Array.from({ length: bucketCount }, () => 0) };
    const costAmount = numberFromDecimal(record.costAmount);
    const totalTokens = record.totalTokens ?? 0;
    const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor((record.observedAt.getTime() - currentMonthStart.getTime()) / bucketMs)));
    current.spend += costAmount;
    current.tokens += totalTokens;
    current.records += 1;
    current.sparklineData[bucketIndex] += costAmount;
    if (record.observedAt >= last24hStart) {
      current.last24hSpend += costAmount;
      current.last24hTokens += totalTokens;
    }
    if (record.observedAt >= last7dStart) {
      current.last7dSpend += costAmount;
      current.last7dTokens += totalTokens;
    }
    acc[record.providerAccountId] = current;
    return acc;
  }, {});

  const creditCaps = await db
    .select({
      providerAccountId: usageCaps.providerAccountId,
      capAmount: usageCaps.capAmount,
      usedAmount: usageCaps.usedAmount,
      confidence: usageCaps.confidence
    })
    .from(usageCaps)
    .where(eq(usageCaps.capType, "credit_balance"));

  const creditByAccount = creditCaps.reduce<Record<string, { capAmount: number; usedAmount: number; confidence: string }>>((acc, cap) => {
    acc[cap.providerAccountId] = {
      capAmount: numberFromDecimal(cap.capAmount),
      usedAmount: numberFromDecimal(cap.usedAmount),
      confidence: cap.confidence
    };
    return acc;
  }, {});

  return rows.map((row) => ({
    ...(() => {
      const usage = usageByAccount[row.id] ?? { spend: 0, tokens: 0, records: 0, last24hSpend: 0, last24hTokens: 0, last7dSpend: 0, last7dTokens: 0, sparklineData: Array.from({ length: bucketCount }, () => 0) };
      const credit = creditByAccount[row.id] ?? null;
      return {
        currentMonthSpend: usage.spend,
        currentMonthTokens: usage.tokens,
        currentMonthRecords: usage.records,
        last24hSpend: usage.last24hSpend,
        last24hTokens: usage.last24hTokens,
        last7dSpend: usage.last7dSpend,
        last7dTokens: usage.last7dTokens,
        sparklineData: usage.sparklineData,
        creditCapAmount: credit?.capAmount ?? null,
        creditUsedAmount: credit?.usedAmount ?? null,
        creditBalanceAmount: credit ? Math.max(0, credit.capAmount - credit.usedAmount) : null,
        creditConfidence: credit?.confidence ?? null
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
  const db = getDb();
  const records = await db
    .select({
      providerAccountId: usageRecords.providerAccountId,
      totalTokens: usageRecords.totalTokens,
      costAmount: usageRecords.costAmount
    })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), gte(usageRecords.observedAt, monthStart())));

  const spendByAccount = records.reduce<Record<string, number>>((acc, record) => {
    acc[record.providerAccountId] = (acc[record.providerAccountId] ?? 0) + numberFromDecimal(record.costAmount);
    return acc;
  }, {});
  const creditCaps = await db
    .select({
      providerAccountId: usageCaps.providerAccountId,
      usedAmount: usageCaps.usedAmount
    })
    .from(usageCaps)
    .where(and(eq(usageCaps.userId, userId), eq(usageCaps.capType, "credit_balance")));
  const creditSpendFallback = creditCaps.reduce((total, cap) => {
    if ((spendByAccount[cap.providerAccountId] ?? 0) > 0) return total;
    return total + numberFromDecimal(cap.usedAmount);
  }, 0);

  const monthlySpend = records.reduce((total, record) => total + numberFromDecimal(record.costAmount), 0) + creditSpendFallback;
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
    .where(and(
      ne(providerRegistry.connectorStatus, "planned"),
      or(
        eq(providerRegistry.supportsAccountUsageApi, true),
        eq(providerRegistry.supportsResponseUsageMetadata, true),
        eq(providerRegistry.supportsCreditBalanceApi, true),
        eq(providerRegistry.providerId, "other_custom")
      )
    ))
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

export async function importOpenRouterGenerationsForUser(userId: string, providerAccountId: string, generationIds: string[]) {
  const [account] = await getDb()
    .select({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId,
      encryptedCredentials: providerAccounts.encryptedCredentials
    })
    .from(providerAccounts)
    .where(and(eq(providerAccounts.id, providerAccountId), eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)))
    .limit(1);

  if (!account) {
    throw new Error("Provider account was not found for this user.");
  }
  if (account.providerId !== "openrouter") {
    throw new Error("OpenRouter generation import only works with OpenRouter provider accounts.");
  }
  if (!account.encryptedCredentials) {
    throw new Error("OpenRouter API key is required before importing generation IDs.");
  }

  const uniqueGenerationIds = [...new Set(generationIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueGenerationIds.length) {
    return {
      rowsProcessed: 0,
      rowsFailed: generationIds.length
    };
  }

  const apiKey = decryptCredential(account.encryptedCredentials);
  const usage = await openRouterConnector.fetchUsage?.({
    providerAccountId: account.id,
    credentials: { apiKey },
    since: monthStart().toISOString(),
    until: new Date().toISOString(),
    generationIds: uniqueGenerationIds
  });
  const result = await insertSyncedUsageRecords(userId, account.id, account.providerId, usage ?? []);

  return {
    rowsProcessed: result.rowsProcessed,
    rowsFailed: uniqueGenerationIds.length - result.rowsProcessed - result.rowsSkipped
  };
}

export async function importXaiResponsesForUser(userId: string, providerAccountId: string, responsePayloads: unknown[]) {
  const [account] = await getDb()
    .select({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId
    })
    .from(providerAccounts)
    .where(and(eq(providerAccounts.id, providerAccountId), eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)))
    .limit(1);

  if (!account) {
    throw new Error("Provider account was not found for this user.");
  }
  if (account.providerId !== "xai") {
    throw new Error("xAI response import only works with xAI provider accounts.");
  }

  const usage = await xaiConnector.fetchUsage?.({
    providerAccountId: account.id,
    since: monthStart().toISOString(),
    until: new Date().toISOString(),
    responsePayloads
  });
  const result = await insertSyncedUsageRecords(userId, account.id, account.providerId, usage ?? []);

  return {
    rowsProcessed: result.rowsProcessed,
    rowsFailed: responsePayloads.length - result.rowsProcessed - result.rowsSkipped
  };
}

export async function importDeepSeekResponsesForUser(userId: string, providerAccountId: string, responsePayloads: unknown[]) {
  const [account] = await getDb()
    .select({
      id: providerAccounts.id,
      providerId: providerAccounts.providerId
    })
    .from(providerAccounts)
    .where(and(eq(providerAccounts.id, providerAccountId), eq(providerAccounts.userId, userId), eq(providerAccounts.isActive, true)))
    .limit(1);

  if (!account) {
    throw new Error("Provider account was not found for this user.");
  }
  if (account.providerId !== "deepseek") {
    throw new Error("DeepSeek response import only works with DeepSeek provider accounts.");
  }

  const usage = await deepSeekConnector.fetchUsage?.({
    providerAccountId: account.id,
    since: monthStart().toISOString(),
    until: new Date().toISOString(),
    responsePayloads
  });
  const result = await insertSyncedUsageRecords(userId, account.id, account.providerId, usage ?? []);

  return {
    rowsProcessed: result.rowsProcessed,
    rowsFailed: responsePayloads.length - result.rowsProcessed - result.rowsSkipped
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

export async function insertModelBenchmarkSnapshots(snapshots: ArtificialAnalysisBenchmark[]) {
  if (!snapshots.length) {
    return { inserted: 0 };
  }

  const decimalValue = (value: number | undefined) => value == null ? null : String(value);
  const values = snapshots.map((snapshot) => ({
    providerId: snapshot.providerId,
    modelId: snapshot.modelId,
    modelDisplayName: snapshot.modelDisplayName,
    sourceModelId: snapshot.sourceModelId,
    sourceModelSlug: snapshot.sourceModelSlug,
    modelCreatorId: snapshot.modelCreatorId,
    modelCreatorName: snapshot.modelCreatorName,
    modelCreatorSlug: snapshot.modelCreatorSlug,
    evaluations: snapshot.evaluations,
    pricing: snapshot.pricing,
    artificialAnalysisIntelligenceIndex: decimalValue(snapshot.artificialAnalysisIntelligenceIndex),
    artificialAnalysisCodingIndex: decimalValue(snapshot.artificialAnalysisCodingIndex),
    artificialAnalysisMathIndex: decimalValue(snapshot.artificialAnalysisMathIndex),
    mmluPro: decimalValue(snapshot.mmluPro),
    gpqa: decimalValue(snapshot.gpqa),
    hle: decimalValue(snapshot.hle),
    livecodebench: decimalValue(snapshot.livecodebench),
    scicode: decimalValue(snapshot.scicode),
    math500: decimalValue(snapshot.math500),
    aime: decimalValue(snapshot.aime),
    medianOutputTokensPerSecond: decimalValue(snapshot.medianOutputTokensPerSecond),
    medianTimeToFirstTokenSeconds: decimalValue(snapshot.medianTimeToFirstTokenSeconds),
    medianTimeToFirstAnswerTokenSeconds: decimalValue(snapshot.medianTimeToFirstAnswerTokenSeconds),
    sourceName: snapshot.sourceName,
    sourceConfidence: snapshot.sourceConfidence,
    fetchedAt: new Date(snapshot.fetchedAt)
  }));

  const chunkSize = 500;
  for (let index = 0; index < values.length; index += chunkSize) {
    await getDb().insert(modelBenchmarkSnapshots).values(values.slice(index, index + chunkSize));
  }

  return { inserted: snapshots.length };
}

export async function listLatestModelBenchmarkSummaries(limit = 10_000) {
  return getDb()
    .select({
      providerId: modelBenchmarkSnapshots.providerId,
      modelId: modelBenchmarkSnapshots.modelId,
      modelDisplayName: modelBenchmarkSnapshots.modelDisplayName,
      artificialAnalysisIntelligenceIndex: modelBenchmarkSnapshots.artificialAnalysisIntelligenceIndex,
      artificialAnalysisCodingIndex: modelBenchmarkSnapshots.artificialAnalysisCodingIndex,
      medianOutputTokensPerSecond: modelBenchmarkSnapshots.medianOutputTokensPerSecond,
      fetchedAt: modelBenchmarkSnapshots.fetchedAt
    })
    .from(modelBenchmarkSnapshots)
    .orderBy(desc(modelBenchmarkSnapshots.fetchedAt))
    .limit(limit);
}

export async function getDashboardModelPicks(): Promise<DashboardModelPicks> {
  const [priceRows, benchmarkRows] = await Promise.all([
    getDb()
      .select({
        providerId: pricingSnapshots.providerId,
        modelId: pricingSnapshots.modelId,
        modelDisplayName: pricingSnapshots.modelDisplayName,
        inputPricePer1mTokensUsd: pricingSnapshots.inputPricePer1mTokensUsd,
        outputPricePer1mTokensUsd: pricingSnapshots.outputPricePer1mTokensUsd,
        sourcePriority: pricingSnapshots.sourcePriority,
        fetchedAt: pricingSnapshots.fetchedAt
      })
      .from(pricingSnapshots)
      .orderBy(asc(pricingSnapshots.sourcePriority), desc(pricingSnapshots.fetchedAt))
      .limit(10_000),
    getDb()
      .select({
        providerId: modelBenchmarkSnapshots.providerId,
        modelId: modelBenchmarkSnapshots.modelId,
        modelDisplayName: modelBenchmarkSnapshots.modelDisplayName,
        modelCreatorName: modelBenchmarkSnapshots.modelCreatorName,
        artificialAnalysisIntelligenceIndex: modelBenchmarkSnapshots.artificialAnalysisIntelligenceIndex,
        fetchedAt: modelBenchmarkSnapshots.fetchedAt
      })
      .from(modelBenchmarkSnapshots)
      .orderBy(desc(modelBenchmarkSnapshots.fetchedAt))
      .limit(10_000)
  ]);

  const latestPrices = new Map<string, typeof priceRows[number]>();
  for (const row of priceRows) {
    const key = `${row.providerId}:${row.modelId}`;
    const existing = latestPrices.get(key);
    if (!existing || row.sourcePriority < existing.sourcePriority || row.fetchedAt > existing.fetchedAt) {
      latestPrices.set(key, row);
    }
  }

  const benchmarksByProviderModelKey = new Map<string, typeof benchmarkRows[number]>();
  const benchmarksByModelKey = new Map<string, typeof benchmarkRows[number]>();
  for (const row of benchmarkRows) {
    for (const modelKey of modelMatchKeys(row.modelId, row.modelDisplayName)) {
      const providerKey = `${row.providerId}:${modelKey}`;
      if (!benchmarksByProviderModelKey.has(providerKey)) {
        benchmarksByProviderModelKey.set(providerKey, row);
      }

      if (!benchmarksByModelKey.has(modelKey)) {
        benchmarksByModelKey.set(modelKey, row);
      }
    }
  }

  function benchmarkForPrice(price: typeof priceRows[number]) {
    const providerIds = aliasesForProvider(price.providerId);
    const modelKeys = modelMatchKeys(price.modelId, price.modelDisplayName);

    for (const providerId of providerIds) {
      for (const modelKey of modelKeys) {
        const benchmark = benchmarksByProviderModelKey.get(`${providerId}:${modelKey}`);
        if (benchmark) return benchmark;
      }
    }

    for (const modelKey of modelKeys) {
      const benchmark = benchmarksByModelKey.get(modelKey);
      if (benchmark) return benchmark;
    }

    return null;
  }

  function toPick(candidate: {
    price: typeof priceRows[number];
    benchmark: typeof benchmarkRows[number] | null;
    inputCost: number | null;
    outputCost: number | null;
    intelligenceScore: number | null;
  }): DashboardModelPick {
    return {
      modelId: candidate.price.modelId,
      modelName: candidate.price.modelDisplayName,
      provider: candidate.benchmark?.modelCreatorName ?? displayProviderName(candidate.price.providerId),
      inputCostPer1mUsd: candidate.inputCost,
      outputCostPer1mUsd: candidate.outputCost,
      intelligenceScore: candidate.intelligenceScore
    };
  }

  const candidates = [...latestPrices.values()]
    .map((price) => {
      const inputCost = optionalNumberFromDecimal(price.inputPricePer1mTokensUsd);
      const outputCost = optionalNumberFromDecimal(price.outputPricePer1mTokensUsd);
      const combinedCost = (inputCost ?? 0) + (outputCost ?? 0);
      const benchmark = benchmarkForPrice(price);
      const intelligenceScore = scaledBenchmarkScore(benchmark?.artificialAnalysisIntelligenceIndex);

      return {
        price,
        benchmark,
        inputCost,
        outputCost,
        combinedCost,
        intelligenceScore
      };
    })
    .filter((candidate) => candidate.inputCost != null || candidate.outputCost != null);

  const scoredCandidates = candidates.filter((candidate) => candidate.intelligenceScore != null);
  const smartest = scoredCandidates.length
    ? [...scoredCandidates].sort((a, b) => (b.intelligenceScore ?? 0) - (a.intelligenceScore ?? 0) || a.combinedCost - b.combinedCost)[0]
    : null;
  const bestValue = scoredCandidates.length
    ? [...scoredCandidates]
      .filter((candidate) => candidate.combinedCost > 0)
      .sort((a, b) => ((b.intelligenceScore ?? 0) / b.combinedCost) - ((a.intelligenceScore ?? 0) / a.combinedCost))[0] ?? null
    : null;
  const cheapest = candidates.length
    ? [...candidates].sort((a, b) => a.combinedCost - b.combinedCost || (b.intelligenceScore ?? 0) - (a.intelligenceScore ?? 0))[0]
    : null;

  return {
    smartest: smartest ? toPick(smartest) : null,
    bestValue: bestValue ? toPick(bestValue) : null,
    cheapest: cheapest ? toPick(cheapest) : null
  };
}

export async function recommendProviderForUser(userId: string, input: RecommendationInput): Promise<RecommendationBundle | null> {
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

  const benchmarkRows = await getDb()
    .select({
      providerId: modelBenchmarkSnapshots.providerId,
      modelId: modelBenchmarkSnapshots.modelId,
      modelDisplayName: modelBenchmarkSnapshots.modelDisplayName,
      evaluations: modelBenchmarkSnapshots.evaluations,
      pricing: modelBenchmarkSnapshots.pricing,
      artificialAnalysisIntelligenceIndex: modelBenchmarkSnapshots.artificialAnalysisIntelligenceIndex,
      artificialAnalysisCodingIndex: modelBenchmarkSnapshots.artificialAnalysisCodingIndex,
      artificialAnalysisMathIndex: modelBenchmarkSnapshots.artificialAnalysisMathIndex,
      mmluPro: modelBenchmarkSnapshots.mmluPro,
      gpqa: modelBenchmarkSnapshots.gpqa,
      hle: modelBenchmarkSnapshots.hle,
      livecodebench: modelBenchmarkSnapshots.livecodebench,
      scicode: modelBenchmarkSnapshots.scicode,
      math500: modelBenchmarkSnapshots.math500,
      aime: modelBenchmarkSnapshots.aime,
      sourceName: modelBenchmarkSnapshots.sourceName,
      fetchedAt: modelBenchmarkSnapshots.fetchedAt
    })
    .from(modelBenchmarkSnapshots)
    .orderBy(desc(modelBenchmarkSnapshots.fetchedAt))
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

  const latestVersionsByFamily = new Map<string, number[]>();
  for (const price of latestPrices.values()) {
    const familyKey = modelFamilyKey(price.modelId, price.modelDisplayName);
    const versionParts = modelVersionParts(price.modelId, price.modelDisplayName);
    if (!familyKey || !versionParts) continue;

    const key = `${price.providerId}:${familyKey}`;
    const existing = latestVersionsByFamily.get(key);
    if (!existing || compareVersionParts(versionParts, existing) > 0) {
      latestVersionsByFamily.set(key, versionParts);
    }
  }

  function isLatestModelVersion(price: typeof rows[number]) {
    const familyKey = modelFamilyKey(price.modelId, price.modelDisplayName);
    const versionParts = modelVersionParts(price.modelId, price.modelDisplayName);
    if (!familyKey || !versionParts) return true;

    const latestVersionParts = latestVersionsByFamily.get(`${price.providerId}:${familyKey}`);
    return !latestVersionParts || compareVersionParts(versionParts, latestVersionParts) === 0;
  }

  const latestBenchmarks = new Map<string, typeof benchmarkRows[number]>();
  const latestBenchmarksByModel = new Map<string, typeof benchmarkRows[number]>();
  for (const row of benchmarkRows) {
    const keys = modelMatchKeys(row.modelId, row.modelDisplayName);

    for (const modelKey of keys) {
      const providerKey = `${row.providerId}:${modelKey}`;
      if (!latestBenchmarks.has(providerKey)) {
        latestBenchmarks.set(providerKey, row);
      }

      if (!latestBenchmarksByModel.has(modelKey)) {
        latestBenchmarksByModel.set(modelKey, row);
      }
    }
  }

  const inputTokens = Math.max(0, Math.trunc(input.estimatedInputTokens));
  const outputTokens = Math.max(0, Math.trunc(input.estimatedOutputTokens));
  const taskKind = taskKindForRecommendation(input.taskType);
  const qualityPreference = Math.min(1, Math.max(0, input.qualityPreference ?? 0.5));

  function benchmarkForPrice(price: typeof rows[number]) {
    const providerIds = aliasesForProvider(price.providerId);
    const modelKeys = modelMatchKeys(price.modelId, price.modelDisplayName);

    for (const providerId of providerIds) {
      for (const modelKey of modelKeys) {
        const benchmark = latestBenchmarks.get(`${providerId}:${modelKey}`);
        if (benchmark) return benchmark;
      }
    }

    for (const modelKey of modelKeys) {
      const benchmark = latestBenchmarksByModel.get(modelKey);
      if (benchmark) return benchmark;
    }

    return null;
  }

  function benchmarkScoreForTask(benchmark: typeof benchmarkRows[number]) {
    const generalBenchmarks = [
      { value: benchmark.artificialAnalysisIntelligenceIndex, weight: 0.55 },
      { value: benchmark.gpqa, weight: 0.15 },
      { value: benchmark.mmluPro, weight: 0.15 },
      { value: benchmark.hle, weight: 0.15 }
    ];

    const score = taskKind === "coding"
      ? weightedBenchmarkScore([
          { value: benchmark.artificialAnalysisCodingIndex, weight: 0.45 },
          { value: benchmark.livecodebench, weight: 0.25 },
          { value: benchmark.scicode, weight: 0.15 },
          { value: benchmark.artificialAnalysisIntelligenceIndex, weight: 0.15 }
        ])
      : taskKind === "analysis"
        ? weightedBenchmarkScore([
            { value: benchmark.artificialAnalysisMathIndex, weight: 0.25 },
            { value: benchmark.gpqa, weight: 0.25 },
            { value: benchmark.artificialAnalysisIntelligenceIndex, weight: 0.2 },
            { value: benchmark.math500, weight: 0.15 },
            { value: benchmark.aime, weight: 0.15 }
          ])
        : taskKind === "summarising"
          ? weightedBenchmarkScore([
              { value: benchmark.artificialAnalysisIntelligenceIndex, weight: 0.45 },
              { value: benchmark.mmluPro, weight: 0.25 },
              { value: benchmark.gpqa, weight: 0.2 },
              { value: benchmark.hle, weight: 0.1 }
            ])
          : taskKind === "writing"
            ? weightedBenchmarkScore([
                { value: benchmark.artificialAnalysisIntelligenceIndex, weight: 0.55 },
                { value: benchmark.mmluPro, weight: 0.25 },
                { value: benchmark.gpqa, weight: 0.1 },
                { value: benchmark.hle, weight: 0.1 }
              ])
          : weightedBenchmarkScore(generalBenchmarks);

    return score;
  }

  const latestUniqueBenchmarkRows = new Map<string, typeof benchmarkRows[number]>();
  for (const benchmark of benchmarkRows) {
    const key = `${benchmark.providerId}:${benchmark.modelId}`;
    if (!latestUniqueBenchmarkRows.has(key)) {
      latestUniqueBenchmarkRows.set(key, benchmark);
    }
  }

  const topBenchmarkScores = [...latestUniqueBenchmarkRows.values()]
    .map(benchmarkScoreForTask)
    .filter((score): score is number => score != null)
    .sort((a, b) => b - a)
    .slice(0, 20);
  const benchmarkTop20AverageScore = topBenchmarkScores.length
    ? Math.round(topBenchmarkScores.reduce((total, score) => total + score, 0) / topBenchmarkScores.length)
    : null;

  function qualityScoreForPrice(price: typeof rows[number]) {
    const benchmark = benchmarkForPrice(price);

    if (!benchmark) {
      return {
        score: estimateModelIntelligenceScore(price.modelId, price.modelDisplayName, price.providerId),
        source: "inferred" as const
      };
    }

    const score = benchmarkScoreForTask(benchmark);

    return {
      score: score ?? estimateModelIntelligenceScore(price.modelId, price.modelDisplayName, price.providerId),
      source: score == null ? "inferred" as const : "benchmark" as const
    };
  }

  function tokenEfficiencyForPrice(price: typeof rows[number]) {
    const benchmark = benchmarkForPrice(price);
    if (!benchmark) {
      return {
        outputTokensUsed: null,
        tokenEfficiency: null
      };
    }

    const outputTokensUsed = nestedPositiveNumber(
      benchmark.evaluations,
      "artificial_analysis_output_tokens_used",
      "output_tokens_used",
      "output_tokens_used_to_run_artificial_analysis_intelligence_index",
      "intelligence_index_output_tokens",
      "intelligence_index.output_tokens_used",
      "intelligence_index_token_counts.output_tokens"
    )
      ?? findPositiveNumberByKey(benchmark.evaluations, isTokenUseKey)
      ?? findPositiveNumberByKey(benchmark.pricing, isTokenUseKey)
      ?? knownArtificialAnalysisOutputTokensUsed(benchmark.modelId, benchmark.modelDisplayName)
      ?? knownArtificialAnalysisOutputTokensUsed(price.modelId, price.modelDisplayName);
    const tokenEfficiency = nestedPositiveNumber(
      benchmark.evaluations,
      "artificial_analysis_token_efficiency",
      "token_efficiency",
      "token_efficiency_index",
      "tokenizer_efficiency"
    )
      ?? findPositiveNumberByKey(benchmark.evaluations, isTokenEfficiencyKey)
      ?? findPositiveNumberByKey(benchmark.pricing, isTokenEfficiencyKey);

    return {
      outputTokensUsed,
      tokenEfficiency
    };
  }

  type RecommendationCandidate = {
    account: AccountProviderSummary;
    price: typeof rows[number];
    baseInputCostUsd: number;
    baseOutputCostUsd: number;
    estimatedCostUsd: number;
    estimatedTokens: number;
    score: number;
    intelligenceScore: number;
    intelligenceSource: "benchmark" | "inferred";
    artificialAnalysisOutputTokensUsed: number | null;
    artificialAnalysisTokenEfficiency: number | null;
    tokenEfficiencyMultiplier: number;
    budgetRatio: number;
  };
  const candidates: RecommendationCandidate[] = [];

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
      if (!isLatestModelVersion(price)) {
        continue;
      }

      const inputPrice = numberFromDecimal(price.inputPricePer1mTokensUsd);
      const outputPrice = numberFromDecimal(price.outputPricePer1mTokensUsd);
      if (inputPrice <= 0 && outputPrice <= 0) {
        continue;
      }

      const estimatedCostUsd = inputTokens / 1_000_000 * inputPrice + outputTokens / 1_000_000 * outputPrice;
      const quality = qualityScoreForPrice(price);
      const tokenEfficiency = tokenEfficiencyForPrice(price);

      candidates.push({
        account,
        price,
        baseInputCostUsd: inputTokens / 1_000_000 * inputPrice,
        baseOutputCostUsd: outputTokens / 1_000_000 * outputPrice,
        estimatedCostUsd,
        estimatedTokens: inputTokens + outputTokens,
        score: estimatedCostUsd,
        intelligenceScore: quality.score,
        intelligenceSource: quality.source,
        artificialAnalysisOutputTokensUsed: tokenEfficiency.outputTokensUsed,
        artificialAnalysisTokenEfficiency: tokenEfficiency.tokenEfficiency,
        tokenEfficiencyMultiplier: 1,
        budgetRatio
      });
    }
  }

  if (!candidates.length) {
    return null;
  }

  const medianOutputTokensUsed = median(candidates.map((candidate) => candidate.artificialAnalysisOutputTokensUsed ?? 0));
  const medianTokenEfficiency = median(candidates.map((candidate) => candidate.artificialAnalysisTokenEfficiency ?? 0));

  for (const candidate of candidates) {
    const outputTokensMultiplier = candidate.artificialAnalysisOutputTokensUsed && medianOutputTokensUsed
      ? candidate.artificialAnalysisOutputTokensUsed / medianOutputTokensUsed
      : null;
    const explicitEfficiencyMultiplier = candidate.artificialAnalysisTokenEfficiency && medianTokenEfficiency
      ? medianTokenEfficiency / candidate.artificialAnalysisTokenEfficiency
      : null;
    const multiplier = clamp(outputTokensMultiplier ?? explicitEfficiencyMultiplier ?? 1, 0.35, 3);

    candidate.tokenEfficiencyMultiplier = multiplier;
    candidate.estimatedCostUsd = candidate.baseInputCostUsd + candidate.baseOutputCostUsd * multiplier;
    candidate.estimatedTokens = Math.round((inputTokens + outputTokens) * multiplier);
    candidate.score = candidate.estimatedCostUsd
      + (candidate.budgetRatio >= 0.95 ? candidate.estimatedCostUsd * 4 : candidate.budgetRatio >= 0.8 ? candidate.estimatedCostUsd * 1.5 : 0)
      + (candidate.price.sourceConfidence === "official" ? 0 : candidate.estimatedCostUsd * 0.05);
  }

  const pricedProviderIds = new Set(candidates.map((candidate) => candidate.account.providerId));
  const pricedModelKeys = new Set(candidates.map((candidate) => `${candidate.account.providerId}:${candidate.price.modelId}`));
  const tokenEfficiencyCandidates = candidates.filter((candidate) => candidate.artificialAnalysisOutputTokensUsed != null || candidate.artificialAnalysisTokenEfficiency != null);
  const tokenEfficiencyProviderIds = new Set(tokenEfficiencyCandidates.map((candidate) => candidate.account.providerId));
  const tokenEfficiencyModelKeys = new Set(tokenEfficiencyCandidates.map((candidate) => `${candidate.account.providerId}:${candidate.price.modelId}`));
  const stats = {
    pricedProviderCount: pricedProviderIds.size,
    pricedModelCount: pricedModelKeys.size,
    tokenEfficiencyProviderCount: tokenEfficiencyProviderIds.size,
    tokenEfficiencyModelCount: tokenEfficiencyModelKeys.size
  };

  const cheapestCandidate = [...candidates].sort((a, b) => a.score - b.score)[0];
  const hasBenchmarkCandidates = candidates.some((candidate) => candidate.intelligenceSource === "benchmark");
  const qualityCandidate = [...candidates].sort((a, b) => {
    if (hasBenchmarkCandidates && a.intelligenceSource !== b.intelligenceSource) {
      return a.intelligenceSource === "benchmark" ? -1 : 1;
    }

    if (b.intelligenceScore !== a.intelligenceScore) {
      return b.intelligenceScore - a.intelligenceScore;
    }
    return a.score - b.score;
  })[0];
  const costRanks = rankScores(candidates, [...candidates].sort((a, b) => a.score - b.score));
  const qualityRanks = rankScores(candidates, [...candidates].sort((a, b) => {
    if (hasBenchmarkCandidates && a.intelligenceSource !== b.intelligenceSource) {
      return a.intelligenceSource === "benchmark" ? -1 : 1;
    }

    if (b.intelligenceScore !== a.intelligenceScore) {
      return b.intelligenceScore - a.intelligenceScore;
    }
    return a.score - b.score;
  }));
  const balancedPool = qualityPreference <= 0
    ? [cheapestCandidate]
    : candidates.filter((candidate) => {
      const minimumQualityScore = qualityCandidate.intelligenceScore - (55 - qualityPreference * 40);
      return candidate.intelligenceSource === "benchmark" || !hasBenchmarkCandidates
        ? candidate.intelligenceScore >= minimumQualityScore
        : false;
    });
  const recommendedQualityFloor = qualityPreference >= 0.5 ? benchmarkTop20AverageScore : null;
  const aboveRecommendedQualityFloor = recommendedQualityFloor == null
    ? balancedPool
    : balancedPool.filter((candidate) => candidate.intelligenceScore >= recommendedQualityFloor);
  const balancedCandidates = aboveRecommendedQualityFloor.length
    ? aboveRecommendedQualityFloor
    : balancedPool.length
      ? balancedPool
      : candidates;
  const balancedCandidate = qualityPreference <= 0
    ? cheapestCandidate
    : qualityPreference >= 1
    ? qualityCandidate
    : [...balancedCandidates].sort((a, b) => {
      const qualityWeight = 0.35 + qualityPreference * 0.65;
      const costWeight = 1 - qualityWeight;
      const budgetWeight = 0.15 * (1 - qualityPreference);
      const scoreA = (qualityRanks.get(a) ?? 0) * qualityWeight + (costRanks.get(a) ?? 0) * costWeight - a.budgetRatio * budgetWeight;
      const scoreB = (qualityRanks.get(b) ?? 0) * qualityWeight + (costRanks.get(b) ?? 0) * costWeight - b.budgetRatio * budgetWeight;
      return scoreB - scoreA;
    })[0];

  function toRecommendation(
    candidate: RecommendationCandidate,
    kind: "cheapest" | "quality" | "balanced",
    label: string
  ): RecommendationResult {
    const capWarning = candidate.budgetRatio >= 0.95
      ? `${candidate.account.providerName} is above 95% of its monthly budget.`
      : candidate.budgetRatio >= 0.8
        ? `${candidate.account.providerName} is above 80% of its monthly budget.`
        : null;

    const freshnessDays = Math.floor((Date.now() - candidate.price.fetchedAt.getTime()) / 86_400_000);
    const staleNote = freshnessDays > 14 ? " Pricing is a bit stale, so keep one eyebrow raised." : "";
    const capNote = capWarning ? " Budget pressure included in the score." : "";
    const tokenEfficiencyNote = candidate.tokenEfficiencyMultiplier < 0.95
      ? " Token efficiency lowers the effective output cost."
      : candidate.tokenEfficiencyMultiplier > 1.05
        ? " Higher token use raises the effective output cost."
        : "";
    const taskLabel = taskKind === "coding"
      ? "coding"
      : taskKind === "summarising"
        ? "summarising"
        : taskKind === "writing"
          ? "writing"
          : taskKind === "analysis"
            ? "analysis"
            : taskKind === "image"
              ? "image"
              : "general";
    const qualityDescriptor = candidate.intelligenceSource === "benchmark" ? `${taskLabel} benchmark` : "inferred";
    const qualityNote = candidate.intelligenceScore >= 80
      ? ` Strong ${qualityDescriptor} quality.`
      : candidate.intelligenceScore >= 65
        ? ` Solid ${qualityDescriptor} quality.`
        : ` ${qualityDescriptor[0].toUpperCase()}${qualityDescriptor.slice(1)} quality is probably modest.`;
    const reasonPrefix = kind === "cheapest"
      ? "Lowest estimated cost among connected priced models."
      : kind === "quality"
        ? `Highest ${qualityDescriptor} score among connected priced models.`
        : `Best blend of ${qualityDescriptor} quality, estimated cost, and budget pressure.`;

    return {
      kind,
      label,
      recommendedProvider: candidate.account.providerName,
      recommendedProviderId: candidate.account.providerId,
      providerAccountId: candidate.account.id,
      recommendedModel: candidate.price.modelDisplayName,
      estimatedCostUsd: candidate.estimatedCostUsd,
      estimatedTokens: candidate.estimatedTokens,
      intelligenceScore: candidate.intelligenceScore,
      intelligenceSource: candidate.intelligenceSource,
      intelligenceBenchmark: candidate.intelligenceSource === "benchmark" ? taskLabel : undefined,
      benchmarkTop20AverageScore: benchmarkTop20AverageScore ?? undefined,
      capWarning,
      reason: `${reasonPrefix} ${qualityNote}${tokenEfficiencyNote}${capNote}${staleNote}`,
      priceSource: candidate.price.sourceName,
      priceConfidence: candidate.price.sourceConfidence,
      fetchedAt: candidate.price.fetchedAt.toISOString()
    };
  }

  return {
    cheapest: toRecommendation(cheapestCandidate, "cheapest", "Cheapest"),
    quality: toRecommendation(qualityCandidate, "quality", "Best quality"),
    balanced: toRecommendation(balancedCandidate, "balanced", "Best balance"),
    stats
  };
}

export async function listAlertsForUser(userId: string): Promise<AccountAlert[]> {
  const rows = await getDb()
    .select()
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false), eq(alerts.isSnoozed, false)))
    .orderBy(desc(alerts.createdAt))
    .limit(100);

  return rows.map(toAccountAlert);
}

export async function clearAlertsForUser(userId: string) {
  const rows = await getDb()
    .update(alerts)
    .set({
      isRead: true
    })
    .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false)))
    .returning({
      id: alerts.id
    });

  return {
    cleared: rows.length
  };
}

type AlertCandidate = {
  userId: string;
  providerAccountId: string | null;
  alertType: string;
  severity: AccountAlert["severity"];
  title: string;
  body: string;
};

export async function evaluateAlertsForUser(userId: string): Promise<AlertEvaluationResult> {
  const db = getDb();
  const profile = await getUserProfile(userId);
  const summary = await getDashboardSummaryForUser(userId, profile);
  const providers = await listProviderAccountsForUser(userId);
  const candidates: AlertCandidate[] = [];

  if (summary.monthlyBudget > 0) {
    const ratio = summary.monthlySpend / summary.monthlyBudget;
    const threshold = ratio >= 1 ? 100 : ratio >= 0.9 ? 90 : ratio >= 0.75 ? 75 : ratio >= 0.5 ? 50 : 0;
    if (threshold) {
      candidates.push({
        userId,
        providerAccountId: null,
        alertType: "budget_threshold",
        severity: threshold >= 100 ? "danger" : threshold >= 75 ? "warning" : "info",
        title: `Monthly AI budget is ${threshold}% used.`,
        body: `You have spent $${summary.monthlySpend.toFixed(2)} of $${summary.monthlyBudget.toFixed(2)} this month. The wallet is still standing, but it noticed.`
      });
    }
  }

  for (const provider of providers) {
    if (provider.monthlyBudget && provider.monthlyBudget > 0) {
      const ratio = provider.currentMonthSpend / provider.monthlyBudget;
      const threshold = ratio >= 1 ? 100 : ratio >= 0.9 ? 90 : ratio >= 0.75 ? 75 : ratio >= 0.5 ? 50 : 0;
      if (threshold) {
        candidates.push({
          userId,
          providerAccountId: provider.id,
          alertType: "provider_budget_threshold",
          severity: threshold >= 100 ? "danger" : threshold >= 75 ? "warning" : "info",
          title: `${provider.providerName} budget is ${threshold}% used.`,
          body: `${provider.displayName} has spent $${provider.currentMonthSpend.toFixed(2)} of $${provider.monthlyBudget.toFixed(2)} this month.`
        });
      }
    }

    if (provider.lastSyncAt) {
      const hoursSinceSync = (Date.now() - new Date(provider.lastSyncAt).getTime()) / 3_600_000;
      if (hoursSinceSync > 24) {
        candidates.push({
          userId,
          providerAccountId: provider.id,
          alertType: "stale_provider_sync",
          severity: hoursSinceSync > 72 ? "danger" : "warning",
          title: `${provider.providerName} has stale data.`,
          body: `Last sync was ${Math.floor(hoursSinceSync)} hours ago. These numbers may be wearing yesterday's hat.`
        });
      }
    }
  }

  const today = dayStart();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);
  const recentUsage = await db
    .select({
      providerAccountId: usageRecords.providerAccountId,
      providerId: usageRecords.providerId,
      modelId: usageRecords.modelId,
      costAmount: usageRecords.costAmount,
      observedAt: usageRecords.observedAt
    })
    .from(usageRecords)
    .where(and(eq(usageRecords.userId, userId), gte(usageRecords.observedAt, sevenDaysAgo)));

  const todaySpend = recentUsage
    .filter((record) => record.observedAt >= today)
    .reduce((total, record) => total + numberFromDecimal(record.costAmount), 0);
  const previousSevenDaySpend = recentUsage
    .filter((record) => record.observedAt < today)
    .reduce((total, record) => total + numberFromDecimal(record.costAmount), 0);
  const trailingDailyAverage = previousSevenDaySpend / 7;

  if (todaySpend > 0.1 && trailingDailyAverage > 0 && todaySpend > trailingDailyAverage * 2) {
    candidates.push({
      userId,
      providerAccountId: null,
      alertType: "unusual_spend",
      severity: "warning",
      title: "Today's spend is unusually high.",
      body: `Today is at $${todaySpend.toFixed(2)}, more than 2x your trailing daily average of $${trailingDailyAverage.toFixed(2)}.`
    });
  }

  const pricedRows = await db
    .select({
      providerId: pricingSnapshots.providerId,
      modelId: pricingSnapshots.modelId
    })
    .from(pricingSnapshots)
    .orderBy(desc(pricingSnapshots.fetchedAt))
    .limit(10_000);
  const pricedModels = new Set(pricedRows.map((row) => `${row.providerId}:${row.modelId}`));
  const missingPriceRecords = recentUsage.filter((record) => {
    if (!record.modelId) return false;
    const aliases = aliasesForProvider(record.providerId);
    return ![...aliases].some((providerId) => pricedModels.has(`${providerId}:${record.modelId}`));
  });

  const missingPriceByProvider = new Map<string, { providerAccountId: string; models: Set<string> }>();
  for (const record of missingPriceRecords) {
    if (!record.modelId) continue;
    const current = missingPriceByProvider.get(record.providerId) ?? {
      providerAccountId: record.providerAccountId,
      models: new Set<string>()
    };
    current.models.add(record.modelId);
    missingPriceByProvider.set(record.providerId, current);
  }

  for (const [providerId, missing] of missingPriceByProvider) {
    const provider = providers.find((item) => item.providerId === providerId || item.id === missing.providerAccountId);
    const modelList = [...missing.models].slice(0, 3).join(", ");
    candidates.push({
      userId,
      providerAccountId: missing.providerAccountId,
      alertType: "missing_pricing",
      severity: "info",
      title: `${provider?.providerName ?? providerId} has usage without pricing.`,
      body: `Usage exists for ${modelList}, but no matching price snapshot was found. Cost will stay unknown until pricing catches up.`
    });
  }

  const activeRows = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false), eq(alerts.isSnoozed, false)));
  const activeKeys = new Set(activeRows.map((row) => alertKey(row)));
  const newAlerts = candidates.filter((candidate) => !activeKeys.has(alertKey(candidate)));

  if (newAlerts.length) {
    await db.insert(alerts).values(newAlerts);
  }

  return {
    evaluated: true,
    created: newAlerts.length,
    alerts: await listAlertsForUser(userId)
  };
}
