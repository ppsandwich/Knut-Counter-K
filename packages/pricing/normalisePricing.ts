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
  weeklyTokens?: number;
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
  weeklyTokens?: number;
  sourceName: string;
  sourceConfidence: "official" | "public_catalogue" | "inferred" | "manual_override" | "unknown";
  sourcePriority: number;
  fetchedAt: string;
};

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toPositiveInteger(value: unknown): number | undefined {
  const parsed = toFiniteNumber(value);
  if (parsed == null || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

export function normalisePricing(raw: RawPrice[], fetchedAt = new Date().toISOString()): NormalisedPrice[] {
  return raw.map((item) => {
    const inputPricePerTokenUsd = toFiniteNumber(item.inputPricePerTokenUsd);
    const outputPricePerTokenUsd = toFiniteNumber(item.outputPricePerTokenUsd);

    return {
      providerId: item.providerId,
      modelId: item.modelId,
      modelDisplayName: item.modelDisplayName ?? item.modelId,
      inputPricePer1mTokensUsd: toFiniteNumber(item.inputPricePer1mTokensUsd) ?? (inputPricePerTokenUsd == null ? undefined : inputPricePerTokenUsd * 1_000_000),
      outputPricePer1mTokensUsd: toFiniteNumber(item.outputPricePer1mTokensUsd) ?? (outputPricePerTokenUsd == null ? undefined : outputPricePerTokenUsd * 1_000_000),
      cachedInputPricePer1mTokensUsd: toFiniteNumber(item.cachedInputPricePer1mTokensUsd),
      reasoningPricePer1mTokensUsd: toFiniteNumber(item.reasoningPricePer1mTokensUsd),
      contextWindow: toPositiveInteger(item.contextWindow),
      weeklyTokens: toFiniteNumber(item.weeklyTokens),
      sourceName: item.sourceName,
      sourceConfidence: item.sourceConfidence ?? "public_catalogue",
      sourcePriority: item.sourcePriority,
      fetchedAt
    };
  });
}
