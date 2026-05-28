import type { ConnectorStatus, DataConfidence } from "@knut/shared";

export type ProviderCredentials = {
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
};

export type CredentialValidationResult = {
  ok: boolean;
  message: string;
};

export type FetchUsageInput = {
  providerAccountId: string;
  credentials?: ProviderCredentials;
  since: string;
  until: string;
  generationIds?: string[];
  responsePayloads?: unknown[];
};

export type FetchCapsInput = {
  providerAccountId: string;
  credentials?: ProviderCredentials;
};

export type FetchBalanceInput = FetchCapsInput;

export type UsageRecord = {
  providerId: string;
  modelId?: string;
  sourceType?: string;
  sourceRef?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  imageUnits?: number;
  costAmount?: number;
  costCurrency?: string;
  requestCount?: number;
  confidence: DataConfidence;
  observedAt: string;
};

export type UsageCap = {
  capType: string;
  capLabel: string;
  capAmount: number;
  capUnit: string;
  usedAmount: number;
  confidence: DataConfidence;
  resetAt?: string;
  resetCadence?: string;
};

export type ProviderBalance = {
  amount: number;
  currency: string;
  confidence: DataConfidence;
};

export interface ProviderConnector {
  providerId: string;
  displayName: string;
  connectorStatus: ConnectorStatus;
  validateCredentials?(input: ProviderCredentials): Promise<CredentialValidationResult>;
  fetchUsage?(input: FetchUsageInput): Promise<UsageRecord[]>;
  fetchCaps?(input: FetchCapsInput): Promise<UsageCap[]>;
  fetchBalance?(input: FetchBalanceInput): Promise<ProviderBalance | null>;
}
