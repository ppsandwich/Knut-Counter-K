import type { ProviderConnector } from "../types";

type OpenRouterCreditsResponse = {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
};

type OpenRouterGenerationResponse = {
  data?: {
    id?: string;
    model?: string;
    total_cost?: number;
    tokens_prompt?: number;
    tokens_completion?: number;
    native_tokens_prompt?: number;
    native_tokens_completion?: number;
    num_media_prompt?: number;
    created_at?: string;
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

async function fetchGeneration(apiKey: string, generationId: string) {
  const url = new URL("https://openrouter.ai/api/v1/generation");
  url.searchParams.set("id", generationId);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter generation fetch failed: ${response.status} ${body}`);
  }

  const json = await response.json() as OpenRouterGenerationResponse;
  if (!json.data) {
    throw new Error(`OpenRouter generation ${generationId} was not found.`);
  }

  return json.data;
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
  },
  async fetchUsage(input) {
    const apiKey = input.credentials?.apiKey;
    const generationIds = input.generationIds ?? [];
    if (!apiKey) {
      throw new Error("OpenRouter API key is required.");
    }
    if (!generationIds.length) {
      return [];
    }

    const rows = [];
    for (const generationId of generationIds) {
      const generation = await fetchGeneration(apiKey, generationId);
      rows.push({
        providerId: "openrouter",
        modelId: generation.model ?? "unknown",
        sourceType: "openrouter_generation_api",
        sourceRef: `openrouter:generation:${generation.id ?? generationId}`,
        inputTokens: generation.native_tokens_prompt ?? generation.tokens_prompt ?? 0,
        outputTokens: generation.native_tokens_completion ?? generation.tokens_completion ?? 0,
        imageUnits: generation.num_media_prompt,
        costAmount: generation.total_cost ?? 0,
        costCurrency: "USD",
        confidence: "exact" as const,
        observedAt: generation.created_at ? new Date(generation.created_at).toISOString() : new Date().toISOString()
      });
    }

    return rows;
  }
};
