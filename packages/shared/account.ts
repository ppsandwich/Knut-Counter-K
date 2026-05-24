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
};

export type DashboardPayload = {
  profile: AccountProfile | null;
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
