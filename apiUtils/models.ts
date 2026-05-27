import postgres from "postgres";
import { getOptionalUser } from "./auth";
import { convertPopularModelsPayload } from "./currency";

type ApiRequest = {
  method?: string;
  query?: {
    source?: string | string[];
  };
  url?: string;
  headers: {
    authorization?: string;
  };
};

type ApiResponse = {
  status(code: number): {
    json(body: unknown): unknown;
  };
};

type ModelRow = {
  provider_id: string;
  model_id: string;
  model_display_name: string;
  input_price_per_1m_tokens_usd: string | null;
  output_price_per_1m_tokens_usd: string | null;
  artificial_analysis_intelligence_index: string | null;
  artificial_analysis_coding_index: string | null;
  median_output_tokens_per_second: string | null;
  model_creator_name: string | null;
};

type PriceRow = {
  provider_id: string;
  model_id: string;
  model_display_name: string;
  input_price_per_1m_tokens_usd: string | null;
  output_price_per_1m_tokens_usd: string | null;
};

type ModelSource = "aa" | "blm";
type BenchLmModel = {
  rank?: number;
  model?: string;
  creator?: string;
  overallScore?: number | null;
  categoryScores?: {
    coding?: number | null;
  };
  inputPrice?: number | null;
  outputPrice?: number | null;
};
type BenchLmPayload = {
  lastUpdated?: string;
  models?: BenchLmModel[];
};

let sqlClient: postgres.Sql | null = null;

function getSql() {
  if (sqlClient) return sqlClient;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  sqlClient = postgres(databaseUrl, {
    max: 1,
    prepare: false
  });
  return sqlClient;
}

function emptyModelsPayload(warning: string) {
  return {
    models: [],
    refreshedAt: new Date().toISOString(),
    sources: ["Model data fallback"],
    warning
  };
}

function numberOrNull(value: unknown) {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function scaledBenchmarkScore(value: unknown) {
  const parsed = numberOrNull(value);
  if (parsed == null || parsed <= 0) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function scoreFromRange(value: number | null, min: number, max: number, invert = false) {
  if (value == null || max <= min) return null;
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return Math.round((invert ? 1 - ratio : ratio) * 100);
}

function providerName(providerId: string) {
  return providerId
    .replace(/^~/, "")
    .split(/[-_]/)
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function modelKey(value: string) {
  return value
    .toLowerCase()
    .replace(/^~/, "")
    .replace(/:.+$/, "")
    .replace(/^(openai|anthropic|google|x-ai|xai|deepseek|mistralai|mistral|cohere|groq|perplexity|openrouter|qwen|qwenlm)[/:_-]+/, "")
    .replace(/(?:^|[-_])20\d{6,8}$/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function modelMetricKey(value: string) {
  return modelKey(value)
    .replace(/(?:nonreasoning|reasoning|thinking|adaptive|max|xhigh|high|medium|low|minimal|preview|fast|free)$/g, "")
    .replace(/(?:nonreasoning|reasoning|thinking|adaptive|max|xhigh|high|medium|low|minimal|preview|fast|free)/g, "");
}

function modelKeys(...values: Array<string | null | undefined>) {
  return [...new Set(values.flatMap((value) => value ? [modelKey(value), modelMetricKey(value)] : []).filter(Boolean))];
}

function sourceFromRequest(req: ApiRequest): ModelSource {
  const querySource = Array.isArray(req.query?.source) ? req.query?.source[0] : req.query?.source;
  const urlSource = req.url && req.url.startsWith("/")
    ? new URL(req.url, "https://local.invalid").searchParams.get("source")
    : null;
  return (querySource ?? urlSource) === "blm" ? "blm" : "aa";
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 4_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) throw new Error(`BenchLM fetch failed: ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function preferredCurrencyForUser(userId: string) {
  const [row] = await getSql()<{ preferred_currency: string }[]>`
    select preferred_currency
    from users
    where id = ${userId}
    limit 1
  `;

  return row?.preferred_currency ?? "USD";
}

async function latestStoredModelFetchedAt() {
  const [row] = await getSql()<{
    refreshed_at: string | null;
  }[]>`
    select max(fetched_at) as refreshed_at
    from (
      select fetched_at from pricing_snapshots
      union all
      select fetched_at from model_benchmark_snapshots
    ) model_fetches
  `;

  return row?.refreshed_at ? new Date(row.refreshed_at).toISOString() : new Date().toISOString();
}

async function loadModelsFromSnapshots() {
  const rows = await getSql()<ModelRow[]>`
    with latest_prices as (
      select distinct on (provider_id, model_id)
        provider_id,
        model_id,
        model_display_name,
        input_price_per_1m_tokens_usd,
        output_price_per_1m_tokens_usd,
        source_priority,
        fetched_at
      from pricing_snapshots
      where input_price_per_1m_tokens_usd is not null
        or output_price_per_1m_tokens_usd is not null
      order by provider_id, model_id, source_priority asc, fetched_at desc
    ),
    latest_benchmarks as (
      select distinct on (provider_id, model_id)
        provider_id,
        model_id,
        model_display_name,
        model_creator_name,
        artificial_analysis_intelligence_index,
        artificial_analysis_coding_index,
        median_output_tokens_per_second,
        fetched_at
      from model_benchmark_snapshots
      order by provider_id, model_id, fetched_at desc
    )
    select
      p.provider_id,
      p.model_id,
      p.model_display_name,
      p.input_price_per_1m_tokens_usd,
      p.output_price_per_1m_tokens_usd,
      b.artificial_analysis_intelligence_index,
      b.artificial_analysis_coding_index,
      b.median_output_tokens_per_second,
      b.model_creator_name
    from latest_prices p
    left join latest_benchmarks b
      on b.model_id = p.model_id
      or lower(b.model_display_name) = lower(p.model_display_name)
    order by
      b.artificial_analysis_intelligence_index desc nulls last,
      (coalesce(p.input_price_per_1m_tokens_usd, 0) + coalesce(p.output_price_per_1m_tokens_usd, 0)) asc
    limit 50
  `;

  const candidates = rows.map((row) => {
    const inputCost = numberOrNull(row.input_price_per_1m_tokens_usd);
    const outputCost = numberOrNull(row.output_price_per_1m_tokens_usd);
    return {
      row,
      inputCost,
      outputCost,
      combinedCost: (inputCost ?? 0) + (outputCost ?? 0),
      speed: numberOrNull(row.median_output_tokens_per_second)
    };
  });
  const costs = candidates.map((candidate) => candidate.combinedCost).filter((value) => value > 0);
  const speeds = candidates.map((candidate) => candidate.speed).filter((value): value is number => value != null && value > 0);
  const minCost = costs.length ? Math.min(...costs) : 0;
  const maxCost = costs.length ? Math.max(...costs) : 0;
  const minSpeed = speeds.length ? Math.min(...speeds) : 0;
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;

  return candidates.map((candidate, index) => ({
    rank: index + 1,
    modelId: candidate.row.model_id,
    modelName: candidate.row.model_display_name,
    provider: candidate.row.model_creator_name ?? providerName(candidate.row.provider_id),
    weeklyTokens: 0,
    inputCostPer1mUsd: candidate.inputCost,
    outputCostPer1mUsd: candidate.outputCost,
    ageDays: null,
    artificialAnalysisIntelligenceIndex: scaledBenchmarkScore(candidate.row.artificial_analysis_intelligence_index),
    artificialAnalysisCodingIndex: scaledBenchmarkScore(candidate.row.artificial_analysis_coding_index),
    artificialAnalysisAgenticIndex: null,
    speedScore: scoreFromRange(candidate.speed, minSpeed, maxSpeed),
    priceScore: scoreFromRange(candidate.combinedCost, minCost, maxCost, true)
  }));
}

async function latestAaPricesByModelKey() {
  const rows = await getSql()<PriceRow[]>`
    select distinct on (provider_id, model_id)
      provider_id,
      model_id,
      model_display_name,
      input_price_per_1m_tokens_usd,
      output_price_per_1m_tokens_usd
    from pricing_snapshots
    where input_price_per_1m_tokens_usd is not null
      or output_price_per_1m_tokens_usd is not null
    order by provider_id, model_id, source_priority asc, fetched_at desc
  `;
  const prices = new Map<string, PriceRow>();

  for (const row of rows) {
    for (const key of modelKeys(row.model_id, row.model_display_name)) {
      if (!prices.has(key)) prices.set(key, row);
    }
  }

  return prices;
}

async function loadBenchLmModels() {
  const [payload, pricesByModelKey] = await Promise.all([
    fetchJsonWithTimeout<BenchLmPayload>("https://benchlm.ai/api/data/leaderboard?limit=50"),
    latestAaPricesByModelKey()
  ]);
  const rows = payload.models ?? [];
  const candidates = rows.map((row, index) => {
    const price = modelKeys(row.model).map((key) => pricesByModelKey.get(key)).find(Boolean);
    const inputCost = numberOrNull(price?.input_price_per_1m_tokens_usd);
    const outputCost = numberOrNull(price?.output_price_per_1m_tokens_usd);
    return {
      row,
      rank: row.rank ?? index + 1,
      inputCost,
      outputCost,
      combinedCost: (inputCost ?? 0) + (outputCost ?? 0)
    };
  });
  const costs = candidates.map((candidate) => candidate.combinedCost).filter((value) => value > 0);
  const minCost = costs.length ? Math.min(...costs) : 0;
  const maxCost = costs.length ? Math.max(...costs) : 0;

  return candidates.map((candidate) => ({
    rank: candidate.rank,
    modelId: candidate.row.model ?? `benchlm-${candidate.rank}`,
    modelName: candidate.row.model ?? "Unknown model",
    provider: candidate.row.creator ?? "Unknown",
    weeklyTokens: 0,
    inputCostPer1mUsd: candidate.inputCost,
    outputCostPer1mUsd: candidate.outputCost,
    ageDays: null,
    artificialAnalysisIntelligenceIndex: numberOrNull(candidate.row.overallScore),
    artificialAnalysisCodingIndex: numberOrNull(candidate.row.categoryScores?.coding),
    artificialAnalysisAgenticIndex: null,
    speedScore: null,
    priceScore: scoreFromRange(candidate.combinedCost, minCost, maxCost, true)
  }));
}

export async function handleModelsRequest(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const benchmarkSource = sourceFromRequest(req);
    const user = await getOptionalUser(req);
    if (req.method === "POST") {
      if (!user) {
        return res.status(401).json({ error: "Sign in to refresh model data." });
      }
      const { refreshModelData } = await import("./pricingRefresh.js");
      await refreshModelData();
    }

    const models = benchmarkSource === "blm" ? await loadBenchLmModels() : await loadModelsFromSnapshots();
    const currency = user ? await preferredCurrencyForUser(user.id) : "USD";
    const refreshedAt = await latestStoredModelFetchedAt();
    const payload = {
      models,
      refreshedAt,
      sources: benchmarkSource === "blm"
        ? ["BenchLM leaderboard", "Artificial Analysis pricing snapshots"]
        : [
            "Pricing snapshots",
            "Artificial Analysis benchmark snapshots"
          ],
      benchmarkSource
    };
    const convertedPayload = await convertPopularModelsPayload(payload, currency);

    return res.status(200).json(convertedPayload);
  } catch (error) {
    return res.status(200).json(emptyModelsPayload(error instanceof Error ? error.message : "Model data refresh failed"));
  }
}
