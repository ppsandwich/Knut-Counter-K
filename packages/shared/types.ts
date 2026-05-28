export type ConnectorStatus =
  | "live_api_connector"
  | "response_metadata_supported"
  | "manual_import_supported"
  | "planned"
  | "unsupported";

export type DataConfidence =
  | "exact"
  | "api_captured"
  | "provider_reported"
  | "estimated"
  | "manual"
  | "stale"
  | "unknown";

export type ProviderStatus = "healthy" | "warning" | "danger" | "stale";

export interface ProviderUsageSummary {
  providerId: string;
  providerName: string;
  accountDisplayName: string;
  primaryMetric: string;
  secondaryMetric: string;
  last24hMetric?: string;
  last7dMetric?: string;
  statusBadge: string;
  status: ProviderStatus;
  confidence: DataConfidence;
  resetCountdown: string;
  lastSyncedAt: string;
  sparklineData: number[];
  modelMetrics?: ModelMetric[];
  usedPercent?: number | null;
  resetProgress?: number | null;
  tokenQuotaUsed?: number | null;
  tokenQuotaCap?: number | null;
  resetDaysLeft?: number | null;
  hideQuotaText?: boolean;
  displayOrder: number;
}

export type ModelMetric = {
  label: string;
  value: string;
  exhausted: boolean;
};

export interface DashboardSummary {
  monthlySpend: number;
  monthlyBudget: number;
  totalTokens: number;
  projectedSpend: number;
  currency?: string;
  status: ProviderStatus;
  statusText: string;
  subscriptionUsageAvg: number | null;
}

export interface Recommendation {
  providerName: string;
  modelName: string;
  estimatedCostUsd: number;
  reason: string;
  confidence: DataConfidence;
}

export interface AppAlert {
  id: string;
  severity: "info" | "warning" | "danger";
  title: string;
  body: string;
}
