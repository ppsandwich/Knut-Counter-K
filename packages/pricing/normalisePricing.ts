export type RawPrice = {
  providerId: string;
  modelId: string;
  modelDisplayName?: string;
  inputPricePerTokenUsd?: number;
  outputPricePerTokenUsd?: number;
  inputPricePer1mTokensUsd?: number;
  outputPricePer1mTokensUsd?: number;
  cachedInputPricePer1mTokensUsd?: number;
  reasoningPricePer1mTokensUsd?: number;
  contextWindow?: number;
  sourceName: string;
  sourcePriority: number;
  sourceConfidence?: "official" | "public_catalogue" | "inferred" | "manual_override" | "unknown";
};

export type NormalisedPrice = {
  providerId: string;
  modelId: string;
  modelDisplayName: string;
  inputPricePer1mTokensUsd?: number;
  outputPricePer1mTokensUsd?: number;
  cachedInputPricePer1mTokensUsd?: number;
  reasoningPricePer1mTokensUsd?: number;
  contextWindow?: number;
  sourceName: string;
  sourceConfidence: "official" | "public_catalogue" | "inferred" | "manual_override" | "unknown";
  sourcePriority: number;
  fetchedAt: string;
};

export function normalisePricing(raw: RawPrice[], fetchedAt = new Date().toISOString()): NormalisedPrice[] {
  return raw.map((item) => ({
    providerId: item.providerId,
    modelId: item.modelId,
    modelDisplayName: item.modelDisplayName ?? item.modelId,
    inputPricePer1mTokensUsd: item.inputPricePer1mTokensUsd ?? (item.inputPricePerTokenUsd == null ? undefined : item.inputPricePerTokenUsd * 1_000_000),
    outputPricePer1mTokensUsd: item.outputPricePer1mTokensUsd ?? (item.outputPricePerTokenUsd == null ? undefined : item.outputPricePerTokenUsd * 1_000_000),
    cachedInputPricePer1mTokensUsd: item.cachedInputPricePer1mTokensUsd,
    reasoningPricePer1mTokensUsd: item.reasoningPricePer1mTokensUsd,
    contextWindow: item.contextWindow,
    sourceName: item.sourceName,
    sourceConfidence: item.sourceConfidence ?? "public_catalogue",
    sourcePriority: item.sourcePriority,
    fetchedAt
  }));
}
