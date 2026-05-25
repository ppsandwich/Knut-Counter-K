import type { RawPrice } from "../normalisePricing";

type ModelsDevProvider = {
  id?: string;
  name?: string;
  models?: Record<string, {
    id?: string;
    name?: string;
    cost?: {
      input?: number;
      output?: number;
      cache_read?: number;
      cache_write?: number;
    };
    limit?: {
      context?: number;
    };
  }>;
};

export async function fetchModelsDevPricing(): Promise<RawPrice[]> {
  const response = await fetch("https://models.dev/api.json");
  if (!response.ok) {
    throw new Error(`Models.dev pricing fetch failed: ${response.status}`);
  }

  const json = await response.json() as Record<string, ModelsDevProvider>;
  return Object.entries(json).flatMap(([providerKey, provider]) => {
    const providerId = provider.id ?? providerKey;
    return Object.entries(provider.models ?? {})
      .filter(([_modelKey, model]) => model.cost?.input != null || model.cost?.output != null)
      .map(([modelKey, model]) => ({
        providerId,
        modelId: model.id ?? modelKey,
        modelDisplayName: model.name ?? model.id ?? modelKey,
        inputPricePer1mTokensUsd: model.cost?.input,
        outputPricePer1mTokensUsd: model.cost?.output,
        cachedInputPricePer1mTokensUsd: model.cost?.cache_read,
        contextWindow: model.limit?.context,
        sourceName: "Models.dev",
        sourcePriority: 4,
        sourceConfidence: "public_catalogue"
      }));
  });
}
