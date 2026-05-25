import type { ProviderConnector, UsageRecord } from "../types";

type DeepSeekBalanceResponse = {
  is_available?: boolean;
  balance_infos?: Array<{
    currency?: string;
    total_balance?: string;
    granted_balance?: string;
    topped_up_balance?: string;
  }>;
};

type DeepSeekUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
};

type DeepSeekResponsePayload = {
  id?: string;
  model?: string;
  created?: number;
  usage?: DeepSeekUsage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function timestampToIso(value: unknown) {
  const unixSeconds = Number(value);
  if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
    return new Date(unixSeconds * 1000).toISOString();
  }

  return new Date().toISOString();
}

async function deepSeekGet<T>(path: string, apiKey: string) {
  const response = await fetch(`https://api.deepseek.com${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepSeek API request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

async function fetchBalanceInfo(apiKey: string) {
  const data = await deepSeekGet<DeepSeekBalanceResponse>("/user/balance", apiKey);
  const balances = data.balance_infos ?? [];
  const preferred = balances.find((balance) => balance.currency === "USD") ?? balances[0];

  return {
    isAvailable: Boolean(data.is_available),
    currency: preferred?.currency ?? "USD",
    totalBalance: toNumber(preferred?.total_balance) ?? 0,
    grantedBalance: toNumber(preferred?.granted_balance) ?? 0,
    toppedUpBalance: toNumber(preferred?.topped_up_balance) ?? 0
  };
}

function normaliseResponsePayload(payload: unknown, index: number): UsageRecord | null {
  if (!isRecord(payload) || !isRecord(payload.usage)) return null;

  const usage = payload.usage as DeepSeekUsage;
  const id = typeof payload.id === "string" && payload.id.trim() ? payload.id : `payload-${index}`;
  const inputTokens = toNumber(usage.prompt_tokens);
  const completionTokens = toNumber(usage.completion_tokens);
  const reasoningTokens = toNumber(usage.completion_tokens_details?.reasoning_tokens);
  const outputTokens = completionTokens == null
    ? undefined
    : Math.max(0, completionTokens - (reasoningTokens ?? 0));

  return {
    providerId: "deepseek",
    modelId: typeof payload.model === "string" && payload.model.trim() ? payload.model : "unknown",
    sourceType: "deepseek_response_metadata",
    sourceRef: `deepseek:response:${id}`,
    inputTokens,
    outputTokens,
    cachedTokens: toNumber(usage.prompt_cache_hit_tokens),
    reasoningTokens,
    requestCount: 1,
    confidence: "api_captured",
    observedAt: timestampToIso(payload.created)
  };
}

export const deepSeekConnector: ProviderConnector = {
  providerId: "deepseek",
  displayName: "DeepSeek",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return {
        ok: false,
        message: "API key is required."
      };
    }

    const balance = await fetchBalanceInfo(input.apiKey);
    return {
      ok: true,
      message: balance.isAvailable
        ? `DeepSeek key can read balance: ${balance.totalBalance.toFixed(2)} ${balance.currency}.`
        : `DeepSeek key is valid, but balance may be unavailable: ${balance.totalBalance.toFixed(2)} ${balance.currency}.`
    };
  },
  async fetchCaps(input) {
    const apiKey = input.credentials?.apiKey;
    if (!apiKey) {
      throw new Error("DeepSeek API key is required.");
    }

    const balance = await fetchBalanceInfo(apiKey);
    return [{
      capType: "credit_balance",
      capLabel: `DeepSeek balance (${balance.currency})`,
      capAmount: balance.totalBalance,
      capUnit: balance.currency,
      usedAmount: 0,
      confidence: "exact"
    }];
  },
  async fetchBalance(input) {
    const apiKey = input.credentials?.apiKey;
    if (!apiKey) {
      throw new Error("DeepSeek API key is required.");
    }

    const balance = await fetchBalanceInfo(apiKey);
    return {
      amount: balance.totalBalance,
      currency: balance.currency,
      confidence: "exact"
    };
  },
  async fetchUsage(input) {
    const payloads = input.responsePayloads ?? [];
    return payloads
      .map((payload, index) => normaliseResponsePayload(payload, index))
      .filter((record): record is UsageRecord => Boolean(record));
  }
};
