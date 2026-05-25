import type { RawPrice } from "../normalisePricing";

type OpenRouterModel = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
    internal_reasoning?: string;
  };
};

function numberFromString(value: string | undefined) {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function fetchOpenRouterPricing(): Promise<RawPrice[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) {
    throw new Error(`OpenRouter pricing fetch failed: ${response.status}`);
  }

  const json = await response.json() as { data?: OpenRouterModel[] };
  return (json.data ?? []).map((model) => ({
    providerId: "openrouter",
    modelId: model.id,
    modelDisplayName: model.name ?? model.id,
    inputPricePerTokenUsd: numberFromString(model.pricing?.prompt),
    outputPricePerTokenUsd: numberFromString(model.pricing?.completion),
    cachedInputPricePer1mTokensUsd: numberFromString(model.pricing?.input_cache_read) == null ? undefined : numberFromString(model.pricing?.input_cache_read)! * 1_000_000,
    reasoningPricePer1mTokensUsd: numberFromString(model.pricing?.internal_reasoning) == null ? undefined : numberFromString(model.pricing?.internal_reasoning)! * 1_000_000,
    contextWindow: model.context_length,
    sourceName: "OpenRouter",
    sourcePriority: 3,
    sourceConfidence: "official"
  }));
}
