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
};

export type FetchCapsInput = {
  providerAccountId: string;
  credentials?: ProviderCredentials;
};

export type FetchBalanceInput = FetchCapsInput;

export type UsageRecord = {
  providerId: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  costAmount?: number;
  costCurrency?: string;
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
