import type { DashboardSummary } from "./types";

export type AccountProfile = {
  id: string;
  email: string;
  timezone: string;
  preferredCurrency: string;
  monthlyAiBudget: number | null;
};

export type AccountSettingsInput = {
  timezone: string;
  preferredCurrency: string;
  monthlyAiBudget: number | null;
};

export type ProviderAccountInput = {
  providerId: string;
  displayName: string;
  authType: "api_key" | "oauth" | "manual" | "csv_json_import";
  apiKey?: string;
  planName?: string;
  billingCurrency?: string;
  monthlyBudget?: number | null;
  resetRule?: string;
};

export type ProviderAccountUpdateInput = {
  providerAccountId: string;
  displayName?: string;
  planName?: string | null;
  billingCurrency?: string | null;
  monthlyBudget?: number | null;
  resetRule?: string | null;
  syncStatus?: "idle" | "paused";
};

export type ProviderCredentialState = {
  providerAccountId: string;
  hasCredentials: boolean;
  credentialsLastUpdatedAt: string | null;
};

export type AccountProviderSummary = {
  id: string;
  providerId: string;
  providerName: string;
  displayName: string;
  authType: string;
  planName: string | null;
  monthlyBudget: number | null;
  resetRule: string | null;
  syncStatus: string;
  lastSyncAt: string | null;
  hasCredentials: boolean;
  currentMonthSpend: number;
  currentMonthTokens: number;
  currentMonthRecords: number;
  last24hSpend: number;
  last24hTokens: number;
  last7dSpend: number;
  last7dTokens: number;
  creditCapAmount: number | null;
  creditUsedAmount: number | null;
  creditBalanceAmount: number | null;
  creditConfidence: string | null;
};

export type DashboardPayload = {
  profile: AccountProfile | null;
  summary: DashboardSummary;
  providers: AccountProviderSummary[];
};

export type ProviderRegistryOption = {
  providerId: string;
  providerName: string;
  connectorType: string;
  connectorStatus: string;
  supportsAccountUsageApi: boolean;
  supportsResponseUsageMetadata: boolean;
  supportsManualImport: boolean;
  supportsCsvImport: boolean;
  supportsJsonImport: boolean;
  priority: number;
};

export type ManualUsageInput = {
  providerAccountId: string;
  modelId?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  requestCount?: number | null;
  messageCount?: number | null;
  costAmount?: number | null;
  costCurrency?: string;
  observedAt: string;
  sourceRef?: string;
};

export type ImportUsageRowInput = {
  providerAccountId: string;
  modelId?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  requestCount?: number | null;
  messageCount?: number | null;
  costAmount?: number | null;
  costCurrency?: string;
  observedAt: string;
  sourceRef?: string;
  confidence?: "provider_reported" | "estimated" | "manual";
};

export type ImportUsageInput = {
  providerAccountId: string;
  rows: ImportUsageRowInput[];
};

export type OpenRouterGenerationImportInput = {
  providerAccountId: string;
  generationIds: string[];
};

export type XaiResponseImportInput = {
  providerAccountId: string;
  responsePayloads: unknown[];
};

export type DeepSeekResponseImportInput = {
  providerAccountId: string;
  responsePayloads: unknown[];
};

export type RecommendationInput = {
  taskType?: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  excludeNearCapProviders?: boolean;
};

export type RecommendationResult = {
  kind?: "cheapest" | "quality" | "balanced";
  label?: string;
  recommendedProvider: string;
  recommendedProviderId: string;
  providerAccountId: string;
  recommendedModel: string;
  estimatedCostUsd: number;
  intelligenceScore: number;
  intelligenceSource: "benchmark" | "inferred" | "unknown";
  capWarning: string | null;
  reason: string;
  priceSource: string;
  priceConfidence: string;
  fetchedAt: string;
};

export type RecommendationBundle = {
  cheapest: RecommendationResult;
  quality: RecommendationResult;
  balanced: RecommendationResult;
};

export type AccountAlert = {
  id: string;
  providerAccountId: string | null;
  alertType: string;
  severity: "info" | "warning" | "danger";
  title: string;
  body: string;
  isRead: boolean;
  isSnoozed: boolean;
  createdAt: string;
};

export type AlertEvaluationResult = {
  evaluated: true;
  created: number;
  alerts: AccountAlert[];
};

export type AccountExportPayload = {
  exportedAt: string;
  profile: AccountProfile | null;
  providerAccounts: Array<Record<string, unknown>>;
  usageRecords: Array<Record<string, unknown>>;
  usageCaps: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
  importJobs: Array<Record<string, unknown>>;
};
