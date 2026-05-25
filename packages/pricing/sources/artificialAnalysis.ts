import type { RawPrice } from "../normalisePricing";

type ArtificialAnalysisModel = {
  id?: string;
  name?: string;
  slug?: string;
  model_creator?: {
    id?: string;
    name?: string;
    slug?: string;
  };
  evaluations?: Record<string, unknown>;
  pricing?: Record<string, unknown> & {
    price_1m_blended_3_to_1?: number;
    price_1m_input_tokens?: number;
    price_1m_output_tokens?: number;
  };
  median_output_tokens_per_second?: number;
  median_time_to_first_token_seconds?: number;
  median_time_to_first_answer_token?: number;
};

export type ArtificialAnalysisBenchmark = {
  providerId: string;
  modelId: string;
  modelDisplayName: string;
  sourceModelId: string | null;
  sourceModelSlug: string | null;
  modelCreatorId: string | null;
  modelCreatorName: string | null;
  modelCreatorSlug: string | null;
  evaluations: Record<string, unknown>;
  pricing: Record<string, unknown>;
  artificialAnalysisIntelligenceIndex?: number;
  artificialAnalysisCodingIndex?: number;
  artificialAnalysisMathIndex?: number;
  mmluPro?: number;
  gpqa?: number;
  hle?: number;
  livecodebench?: number;
  scicode?: number;
  math500?: number;
  aime?: number;
  medianOutputTokensPerSecond?: number;
  medianTimeToFirstTokenSeconds?: number;
  medianTimeToFirstAnswerTokenSeconds?: number;
  sourceName: "Artificial Analysis";
  sourceConfidence: "public_catalogue";
  fetchedAt: string;
};

const creatorProviderIds: Record<string, string> = {
  anthropic: "anthropic_api",
  cohere: "cohere",
  deepseek: "deepseek",
  google: "google_gemini_api",
  groq: "groq",
  mistral: "mistral",
  openai: "openai_api",
  perplexity: "perplexity_api",
  xai: "xai"
};

function providerIdForCreator(slug: string | undefined, name: string | undefined) {
  const key = (slug ?? name ?? "unknown").toLowerCase().replaceAll(" ", "_");
  return creatorProviderIds[key] ?? key;
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sourceModelIdFor(model: ArtificialAnalysisModel) {
  return model.slug ?? model.name ?? model.id;
}

export async function fetchArtificialAnalysisPricingAndBenchmarks(
  apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY,
  fetchedAt = new Date().toISOString()
): Promise<{ prices: RawPrice[]; benchmarks: ArtificialAnalysisBenchmark[] }> {
  if (!apiKey) {
    throw new Error("Artificial Analysis API key is not configured.");
  }

  const response = await fetch("https://artificialanalysis.ai/api/v2/data/llms/models", {
    headers: {
      "x-api-key": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Artificial Analysis fetch failed: ${response.status}`);
  }

  const json = await response.json() as { data?: ArtificialAnalysisModel[] };
  const models = json.data ?? [];

  const prices: RawPrice[] = [];
  const benchmarks: ArtificialAnalysisBenchmark[] = [];

  for (const model of models) {
    const modelId = sourceModelIdFor(model);
    if (!modelId) continue;

    const providerId = providerIdForCreator(model.model_creator?.slug, model.model_creator?.name);
    const modelDisplayName = model.name ?? modelId;

    if (model.pricing?.price_1m_input_tokens != null || model.pricing?.price_1m_output_tokens != null) {
      prices.push({
        providerId,
        modelId,
        modelDisplayName,
        inputPricePer1mTokensUsd: finiteNumber(model.pricing.price_1m_input_tokens),
        outputPricePer1mTokensUsd: finiteNumber(model.pricing.price_1m_output_tokens),
        sourceName: "Artificial Analysis",
        sourcePriority: 4,
        sourceConfidence: "public_catalogue"
      });
    }

    const evaluations = model.evaluations ?? {};
    benchmarks.push({
      providerId,
      modelId,
      modelDisplayName,
      sourceModelId: model.id ?? null,
      sourceModelSlug: model.slug ?? null,
      modelCreatorId: model.model_creator?.id ?? null,
      modelCreatorName: model.model_creator?.name ?? null,
      modelCreatorSlug: model.model_creator?.slug ?? null,
      evaluations,
      pricing: model.pricing ?? {},
      artificialAnalysisIntelligenceIndex: finiteNumber(evaluations.artificial_analysis_intelligence_index),
      artificialAnalysisCodingIndex: finiteNumber(evaluations.artificial_analysis_coding_index),
      artificialAnalysisMathIndex: finiteNumber(evaluations.artificial_analysis_math_index),
      mmluPro: finiteNumber(evaluations.mmlu_pro),
      gpqa: finiteNumber(evaluations.gpqa),
      hle: finiteNumber(evaluations.hle),
      livecodebench: finiteNumber(evaluations.livecodebench),
      scicode: finiteNumber(evaluations.scicode),
      math500: finiteNumber(evaluations.math_500),
      aime: finiteNumber(evaluations.aime),
      medianOutputTokensPerSecond: finiteNumber(model.median_output_tokens_per_second),
      medianTimeToFirstTokenSeconds: finiteNumber(model.median_time_to_first_token_seconds),
      medianTimeToFirstAnswerTokenSeconds: finiteNumber(model.median_time_to_first_answer_token),
      sourceName: "Artificial Analysis",
      sourceConfidence: "public_catalogue",
      fetchedAt
    });
  }

  return { prices, benchmarks };
}
