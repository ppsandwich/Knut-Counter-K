import type { RawPrice } from "../normalisePricing";

type LiteLlmModel = {
  litellm_provider?: string;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_read_input_token_cost?: number;
  max_input_tokens?: number;
  max_tokens?: number;
};

export async function fetchLiteLlmPricing(): Promise<RawPrice[]> {
  const response = await fetch("https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json");
  if (!response.ok) {
    throw new Error(`LiteLLM pricing fetch failed: ${response.status}`);
  }

  const json = await response.json() as Record<string, LiteLlmModel>;
  return Object.entries(json)
    .filter(([_modelId, model]) => model.input_cost_per_token != null || model.output_cost_per_token != null)
    .map(([modelId, model]) => ({
      providerId: model.litellm_provider ?? "unknown",
      modelId,
      modelDisplayName: modelId,
      inputPricePerTokenUsd: model.input_cost_per_token,
      outputPricePerTokenUsd: model.output_cost_per_token,
      cachedInputPricePer1mTokensUsd: model.cache_read_input_token_cost == null ? undefined : model.cache_read_input_token_cost * 1_000_000,
      contextWindow: model.max_input_tokens ?? model.max_tokens,
      sourceName: "LiteLLM",
      sourcePriority: 5,
      sourceConfidence: "public_catalogue"
    }));
}
