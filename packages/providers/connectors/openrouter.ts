import type { ProviderConnector } from "../types";

type OpenRouterCreditsResponse = {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
};

async function fetchCredits(apiKey: string) {
  const response = await fetch("https://openrouter.ai/api/v1/credits", {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter credits fetch failed: ${response.status} ${body}`);
  }

  const json = await response.json() as OpenRouterCreditsResponse;
  return {
    totalCredits: Number(json.data?.total_credits ?? 0),
    totalUsage: Number(json.data?.total_usage ?? 0)
  };
}

export const openRouterConnector: ProviderConnector = {
  providerId: "openrouter",
  displayName: "OpenRouter",
  connectorStatus: "live_api_connector",
  async validateCredentials(input) {
    if (!input.apiKey) {
      return {
        ok: false,
        message: "API key is required."
      };
    }

    await fetchCredits(input.apiKey);
    return {
      ok: true,
      message: "OpenRouter key can read credit usage."
    };
  },
  async fetchCaps(input) {
    const apiKey = input.credentials?.apiKey;
    if (!apiKey) {
      throw new Error("OpenRouter API key is required.");
    }

    const credits = await fetchCredits(apiKey);
    return [{
      capType: "credit_balance",
      capLabel: "OpenRouter credits",
      capAmount: credits.totalCredits,
      capUnit: "USD",
      usedAmount: credits.totalUsage,
      confidence: "exact"
    }];
  },
  async fetchBalance(input) {
    const apiKey = input.credentials?.apiKey;
    if (!apiKey) {
      throw new Error("OpenRouter API key is required.");
    }

    const credits = await fetchCredits(apiKey);
    return {
      amount: Math.max(0, credits.totalCredits - credits.totalUsage),
      currency: "USD",
      confidence: "exact"
    };
  }
};
