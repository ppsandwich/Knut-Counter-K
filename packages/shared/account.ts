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

export type RecommendationInput = {
  taskType?: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  excludeNearCapProviders?: boolean;
};

export type RecommendationResult = {
  recommendedProvider: string;
  recommendedProviderId: string;
  providerAccountId: string;
  recommendedModel: string;
  estimatedCostUsd: number;
  capWarning: string | null;
  reason: string;
  priceSource: string;
  priceConfidence: string;
  fetchedAt: string;
};
