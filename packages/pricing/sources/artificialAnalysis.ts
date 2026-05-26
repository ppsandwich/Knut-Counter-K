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
  artificial_analysis_output_tokens_used?: number;
  output_tokens_used?: number;
  token_efficiency?: number;
};

type IntelligenceIndexTokenCounts = {
  inputTokens?: number;
  answerTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
};

const publicTokenCountFetchConcurrency = 4;
const publicTokenCountFetchTimeoutMs = 12_000;
const artificialAnalysisModelsUrl = "https://artificialanalysis.ai/models";

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
  artificialAnalysisOutputTokensUsed?: number;
  artificialAnalysisTokenEfficiency?: number;
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

function evaluationNumber(evaluations: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const directValue = finiteNumber(evaluations[key]);
    if (directValue != null) return directValue;

    const nested = evaluations[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestedRecord = nested as Record<string, unknown>;
      const nestedValue = finiteNumber(
        nestedRecord.score
        ?? nestedRecord.value
        ?? nestedRecord.percent
        ?? nestedRecord.accuracy
        ?? nestedRecord.index
      );
      if (nestedValue != null) return nestedValue;
    }
  }

  return undefined;
}

function nestedNumber(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const directValue = finiteNumber(source[key]);
    if (directValue != null) return directValue;

    const pathValue = key.split(".").reduce<unknown>((value, segment) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
      return (value as Record<string, unknown>)[segment];
    }, source);
    const parsedPathValue = finiteNumber(pathValue);
    if (parsedPathValue != null) return parsedPathValue;
  }

  return undefined;
}

function firstNumber(source: unknown): number | undefined {
  if (!source || typeof source !== "object") {
    const parsed = finiteNumber(source);
    return parsed != null && parsed > 0 ? parsed : undefined;
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const parsed = firstNumber(item);
      if (parsed != null) return parsed;
    }

    return undefined;
  }

  const record = source as Record<string, unknown>;
  for (const key of ["total", "total_tokens", "tokens", "token_use", "token_usage", "output", "output_tokens", "reasoning", "reasoning_tokens", "answer", "answer_tokens"]) {
    const parsed = finiteNumber(record[key]);
    if (parsed != null && parsed > 0) return parsed;
  }

  for (const value of Object.values(record)) {
    const parsed = firstNumber(value);
    if (parsed != null) return parsed;
  }

  return undefined;
}

function findNumberByKey(source: unknown, predicate: (key: string) => boolean): number | undefined {
  if (!source || typeof source !== "object") return undefined;

  if (Array.isArray(source)) {
    for (const item of source) {
      const nestedValue = findNumberByKey(item, predicate);
      if (nestedValue != null) return nestedValue;
    }

    return undefined;
  }

  for (const [key, value] of Object.entries(source)) {
    if (predicate(key)) {
      const parsed = finiteNumber(value);
      if (parsed != null && parsed > 0) return parsed;

      const nestedParsed = firstNumber(value);
      if (nestedParsed != null) return nestedParsed;
    }

    const nestedValue = findNumberByKey(value, predicate);
    if (nestedValue != null) return nestedValue;
  }

  return undefined;
}

function isTokenUseKey(key: string) {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (!normalised.includes("token")) return false;
  if (/(price|cost|usd|dollar|rate|per|second|latency|speed|throughput|context|window|limit)/.test(normalised)) return false;

  return (
    /(output|reasoning|answer|completion).*(used|use|count|total)/.test(normalised)
    || /(used|use|count|total).*(output|reasoning|answer|completion)/.test(normalised)
    || /intelligence.*index.*token/.test(normalised)
    || /token.*(use|usage|used|count|total)/.test(normalised)
    || /(use|usage|used|count|total).*token/.test(normalised)
  );
}

function isTokenEfficiencyKey(key: string) {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (/(price|cost|usd|dollar|rate|per|second|latency|speed|throughput|context|window|limit)/.test(normalised)) return false;

  return normalised.includes("token") && /(efficiency|efficient|verbosity|verbose)/.test(normalised);
}

function sourceModelIdFor(model: ArtificialAnalysisModel) {
  return model.slug ?? model.name ?? model.id;
}

function escapedJsonNumber(source: string, key: string) {
  const match = source.match(new RegExp(`(?:\\\\?")${key}(?:\\\\?")\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  return match ? finiteNumber(match[1]) : undefined;
}

function latestEscapedJsonString(source: string, key: string) {
  const matches = [...source.matchAll(new RegExp(`(?:\\\\?")${key}(?:\\\\?")\\s*:\\s*(?:\\\\?")([^"\\\\]+)(?:\\\\?")`, "g"))];
  return matches.at(-1)?.[1];
}

function parseIntelligenceIndexTokenCounts(html: string) {
  const tokenCountsBySlug = new Map<string, IntelligenceIndexTokenCounts>();
  const tokenCountsPattern = /(?:\\?")intelligence_index_token_counts(?:\\?")\s*:\s*\{([^}]+)\}/g;

  for (const match of html.matchAll(tokenCountsPattern)) {
    const before = html.slice(Math.max(0, match.index - 8000), match.index);
    const slug = latestEscapedJsonString(before, "slug");
    const id = latestEscapedJsonString(before, "id");
    if (!slug && !id) continue;

    const countsSource = match[1];
    const counts = {
      inputTokens: escapedJsonNumber(countsSource, "input_tokens"),
      answerTokens: escapedJsonNumber(countsSource, "answer_tokens"),
      outputTokens: escapedJsonNumber(countsSource, "output_tokens"),
      reasoningTokens: escapedJsonNumber(countsSource, "reasoning_tokens")
    };

    if (slug) tokenCountsBySlug.set(slug, counts);
    if (id) tokenCountsBySlug.set(id, counts);
  }

  return tokenCountsBySlug;
}

function firstIntelligenceIndexTokenCounts(html: string) {
  const match = html.match(/(?:\\?")intelligence_index_token_counts(?:\\?")\s*:\s*\{([^}]+)\}/);
  if (!match) return undefined;

  return {
    inputTokens: escapedJsonNumber(match[1], "input_tokens"),
    answerTokens: escapedJsonNumber(match[1], "answer_tokens"),
    outputTokens: escapedJsonNumber(match[1], "output_tokens"),
    reasoningTokens: escapedJsonNumber(match[1], "reasoning_tokens")
  };
}

async function fetchArtificialAnalysisModelPage(slug: string) {
  return fetchArtificialAnalysisPublicPage(`${artificialAnalysisModelsUrl}/${encodeURIComponent(slug)}`);
}

async function fetchArtificialAnalysisPublicPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), publicTokenCountFetchTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Knut Counter pricing refresh"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArtificialAnalysisPublicTokenCounts(models: ArtificialAnalysisModel[]) {
  const tokenCountsBySlug = new Map<string, IntelligenceIndexTokenCounts>();
  const indexHtml = await fetchArtificialAnalysisPublicPage(artificialAnalysisModelsUrl);
  if (indexHtml) {
    for (const [key, counts] of parseIntelligenceIndexTokenCounts(indexHtml)) {
      tokenCountsBySlug.set(key, counts);
    }
  }

  const slugs = [...new Set(models
    .filter((model) => !(model.slug && tokenCountsBySlug.has(model.slug)) && !(model.id && tokenCountsBySlug.has(model.id)))
    .map((model) => model.slug)
    .filter((slug): slug is string => Boolean(slug)))];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < slugs.length) {
      const slug = slugs[nextIndex];
      nextIndex += 1;

      const html = await fetchArtificialAnalysisModelPage(slug);
      if (!html) continue;

      const pageTokenCounts = parseIntelligenceIndexTokenCounts(html);
      for (const [key, counts] of pageTokenCounts) {
        tokenCountsBySlug.set(key, counts);
      }

      if (!tokenCountsBySlug.has(slug)) {
        const counts = firstIntelligenceIndexTokenCounts(html);
        if (counts?.outputTokens != null) {
          tokenCountsBySlug.set(slug, counts);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(publicTokenCountFetchConcurrency, slugs.length) }, worker));

  return tokenCountsBySlug;
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
  const tokenCountsBySlug = await fetchArtificialAnalysisPublicTokenCounts(models);

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
    const modelRecord = model as Record<string, unknown>;
    const publicTokenCounts = (model.slug ? tokenCountsBySlug.get(model.slug) : undefined)
      ?? (model.id ? tokenCountsBySlug.get(model.id) : undefined);
    const artificialAnalysisOutputTokensUsed = nestedNumber(
      modelRecord,
      "artificial_analysis_output_tokens_used",
      "output_tokens_used",
      "output_tokens_used_to_run_artificial_analysis_intelligence_index",
      "intelligence_index_output_tokens",
      "intelligence_index.output_tokens_used",
      "evaluations.artificial_analysis_output_tokens_used",
      "evaluations.output_tokens_used",
      "evaluations.output_tokens_used_to_run_artificial_analysis_intelligence_index",
      "evaluations.intelligence_index_output_tokens"
    )
      ?? findNumberByKey(model.evaluations, isTokenUseKey)
      ?? findNumberByKey(model.pricing, isTokenUseKey)
      ?? findNumberByKey(modelRecord, isTokenUseKey)
      ?? publicTokenCounts?.outputTokens;
    const artificialAnalysisTokenEfficiency = nestedNumber(
      modelRecord,
      "artificial_analysis_token_efficiency",
      "token_efficiency",
      "token_efficiency_index",
      "tokenizer_efficiency",
      "evaluations.artificial_analysis_token_efficiency",
      "evaluations.token_efficiency",
      "evaluations.token_efficiency_index",
      "evaluations.tokenizer_efficiency"
    )
      ?? findNumberByKey(model.evaluations, isTokenEfficiencyKey)
      ?? findNumberByKey(model.pricing, isTokenEfficiencyKey)
      ?? findNumberByKey(modelRecord, isTokenEfficiencyKey);
    const enrichedEvaluations = {
      ...evaluations,
      ...(artificialAnalysisOutputTokensUsed == null ? {} : { artificial_analysis_output_tokens_used: artificialAnalysisOutputTokensUsed }),
      ...(publicTokenCounts == null ? {} : {
        intelligence_index_token_counts: {
          input_tokens: publicTokenCounts.inputTokens,
          answer_tokens: publicTokenCounts.answerTokens,
          output_tokens: publicTokenCounts.outputTokens,
          reasoning_tokens: publicTokenCounts.reasoningTokens
        }
      }),
      ...(artificialAnalysisTokenEfficiency == null ? {} : { artificial_analysis_token_efficiency: artificialAnalysisTokenEfficiency })
    };

    benchmarks.push({
      providerId,
      modelId,
      modelDisplayName,
      sourceModelId: model.id ?? null,
      sourceModelSlug: model.slug ?? null,
      modelCreatorId: model.model_creator?.id ?? null,
      modelCreatorName: model.model_creator?.name ?? null,
      modelCreatorSlug: model.model_creator?.slug ?? null,
      evaluations: enrichedEvaluations,
      pricing: model.pricing ?? {},
      artificialAnalysisIntelligenceIndex: evaluationNumber(evaluations, "artificial_analysis_intelligence_index", "Artificial Analysis Intelligence Index", "intelligence_index"),
      artificialAnalysisCodingIndex: evaluationNumber(evaluations, "artificial_analysis_coding_index", "Artificial Analysis Coding Index", "coding_index"),
      artificialAnalysisMathIndex: evaluationNumber(evaluations, "artificial_analysis_math_index", "Artificial Analysis Math Index", "math_index"),
      mmluPro: evaluationNumber(evaluations, "mmlu_pro", "MMLU-Pro", "mmlu-pro"),
      gpqa: evaluationNumber(evaluations, "gpqa", "GPQA"),
      hle: evaluationNumber(evaluations, "hle", "Humanity's Last Exam", "humanitys_last_exam"),
      livecodebench: evaluationNumber(evaluations, "livecodebench", "LiveCodeBench", "live_code_bench"),
      scicode: evaluationNumber(evaluations, "scicode", "SciCode"),
      math500: evaluationNumber(evaluations, "math_500", "MATH-500", "math500"),
      aime: evaluationNumber(evaluations, "aime", "AIME"),
      medianOutputTokensPerSecond: finiteNumber(model.median_output_tokens_per_second),
      medianTimeToFirstTokenSeconds: finiteNumber(model.median_time_to_first_token_seconds),
      medianTimeToFirstAnswerTokenSeconds: finiteNumber(model.median_time_to_first_answer_token),
      artificialAnalysisOutputTokensUsed,
      artificialAnalysisTokenEfficiency,
      sourceName: "Artificial Analysis",
      sourceConfidence: "public_catalogue",
      fetchedAt
    });
  }

  return { prices, benchmarks };
}
