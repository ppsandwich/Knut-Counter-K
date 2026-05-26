import type { PopularModel } from "@knut/shared";
import { listLatestModelBenchmarkSummaries } from "@knut/db";

type ApiRequest = {
  method?: string;
  headers: {
    authorization?: string;
  };
};

type ApiResponse = {
  status(code: number): {
    json(body: unknown): unknown;
  };
};

type OpenRouterModel = {
  id: string;
  canonical_slug?: string;
  name?: string;
  created?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
};

type OpenRouterRankingRow = {
  model_permaslug?: string;
  total_completion_tokens?: number;
  total_prompt_tokens?: number;
  total_native_tokens_reasoning?: number;
};

type BenchmarkSummary = {
  modelId: string;
  modelDisplayName: string;
  artificialAnalysisIntelligenceIndex: unknown;
  artificialAnalysisCodingIndex: unknown;
  medianOutputTokensPerSecond: unknown;
};

const openRouterRankingsActionId = "40824635c5eb77626bdf6795ffbf382c0862b321e1";
const upstreamTimeoutMs = 3_000;
const requestBudgetMs = 5_000;

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function perTokenToPerMillion(value: string | undefined) {
  const parsed = finiteNumber(value);
  return parsed == null ? null : parsed * 1_000_000;
}

function providerNameFor(model: OpenRouterModel) {
  const namePrefix = model.name?.split(":")[0]?.trim();
  if (namePrefix && namePrefix !== model.name) return namePrefix;

  const providerId = model.id.replace(/^~/, "").split("/")[0] ?? "unknown";
  return providerId
    .split(/[-_]/)
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function displayNameFor(model: OpenRouterModel) {
  return model.name?.replace(/^[^:]+:\s*/, "") ?? model.id;
}

function ageDaysFor(created: number | undefined) {
  if (!created) return null;
  const milliseconds = Date.now() - created * 1000;
  if (!Number.isFinite(milliseconds)) return null;
  return Math.max(0, Math.floor(milliseconds / 86_400_000));
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

function modelKeysForOpenRouter(model: OpenRouterModel) {
  const keys = [
    modelKey(model.id),
    model.canonical_slug ? modelKey(model.canonical_slug) : "",
    model.name ? modelKey(displayNameFor(model)) : "",
    modelMetricKey(model.id),
    model.canonical_slug ? modelMetricKey(model.canonical_slug) : "",
    model.name ? modelMetricKey(displayNameFor(model)) : ""
  ];
  const [, modelIdWithoutProvider] = model.id.replace(/^~/, "").split("/");
  if (modelIdWithoutProvider) keys.push(modelKey(modelIdWithoutProvider));

  return [...new Set(keys.filter(Boolean))];
}

function modelKeysForBenchmark(row: BenchmarkSummary) {
  return [...new Set([
    modelKey(row.modelId),
    modelKey(row.modelDisplayName),
    modelMetricKey(row.modelId),
    modelMetricKey(row.modelDisplayName)
  ].filter(Boolean))];
}

function parseRankingsResponse(source: string) {
  const match = source.match(/(?:^|\n)1:(\[[\s\S]*\])\s*$/);
  if (!match) return [];

  const rows = JSON.parse(match[1]) as OpenRouterRankingRow[];
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.model_permaslug) continue;
    const tokens = (finiteNumber(row.total_prompt_tokens) ?? 0)
      + (finiteNumber(row.total_completion_tokens) ?? 0)
      + (finiteNumber(row.total_native_tokens_reasoning) ?? 0);
    totals.set(row.model_permaslug, (totals.get(row.model_permaslug) ?? 0) + tokens);
  }

  return [...totals.entries()]
    .map(([modelPermaslug, weeklyTokens]) => ({ modelPermaslug, weeklyTokens }))
    .sort((a, b) => b.weeklyTokens - a.weeklyTokens);
}

async function fetchOpenRouterModels() {
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/models");
  if (!response.ok) throw new Error(`OpenRouter models fetch failed: ${response.status}`);

  const json = await response.json() as { data?: OpenRouterModel[] };
  return json.data ?? [];
}

async function fetchOpenRouterRankings() {
  const response = await fetchWithTimeout("https://openrouter.ai/rankings", {
    method: "POST",
    headers: {
      "Next-Action": openRouterRankingsActionId,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component"
    },
    body: JSON.stringify(["week"])
  });

  if (!response.ok) throw new Error(`OpenRouter rankings fetch failed: ${response.status}`);
  return parseRankingsResponse(await response.text());
}

async function latestBenchmarksByModelKey() {
  const rows = await listLatestModelBenchmarkSummaries();
  const benchmarks = new Map<string, BenchmarkSummary>();

  for (const row of rows) {
    for (const key of modelKeysForBenchmark(row)) {
      if (!benchmarks.has(key)) benchmarks.set(key, row);
    }
  }

  return benchmarks;
}

function scoreFromRange(value: number | null, min: number, max: number, invert = false) {
  if (value == null || max <= min) return null;
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return Math.round((invert ? 1 - ratio : ratio) * 100);
}

function emptyModelsPayload(warning: string) {
  return {
    models: [],
    refreshedAt: new Date().toISOString(),
    sources: ["Model data fallback"],
    warning
  };
}

async function buildModelsPayload() {
    const openRouterModelsResult = await Promise.race([
      fetchOpenRouterModels().then((models) => ({ ok: true as const, models })),
      new Promise<{ ok: false; models: OpenRouterModel[] }>((resolve) => setTimeout(() => resolve({ ok: false, models: [] }), upstreamTimeoutMs + 500))
    ]);
    const openRouterModels = openRouterModelsResult.models;
    const rankingsResult = await Promise.race([
      fetchOpenRouterRankings().then((rankings) => ({ status: "fulfilled" as const, value: rankings })),
      new Promise<{ status: "rejected"; value: [] }>((resolve) => setTimeout(() => resolve({ status: "rejected", value: [] }), upstreamTimeoutMs + 500))
    ]);
    const rankings = rankingsResult.status === "fulfilled" ? rankingsResult.value : [];
    const benchmarksResult = await Promise.race([
      latestBenchmarksByModelKey().then((benchmarks) => ({ status: "fulfilled" as const, value: benchmarks })),
      new Promise<{ status: "rejected"; value: Map<string, BenchmarkSummary> }>((resolve) => setTimeout(() => resolve({ status: "rejected", value: new Map() }), upstreamTimeoutMs + 500))
    ]);
    const benchmarks = benchmarksResult.status === "fulfilled" ? benchmarksResult.value : new Map<string, BenchmarkSummary>();

    const openRouterByKey = new Map<string, OpenRouterModel>();
    for (const model of openRouterModels) {
      for (const key of [modelKey(model.id), model.canonical_slug ? modelKey(model.canonical_slug) : ""]) {
        if (key) openRouterByKey.set(key, model);
      }
    }

    const rankedModels = rankings.length
      ? rankings
        .map((ranking) => ({
          ranking,
          model: openRouterByKey.get(modelKey(ranking.modelPermaslug))
        }))
        .filter((item): item is { ranking: typeof rankings[number]; model: OpenRouterModel } => Boolean(item.model))
        .slice(0, 50)
      : openRouterModels.slice(0, 50).map((model) => ({
        model,
        ranking: {
          modelPermaslug: model.canonical_slug ?? model.id,
          weeklyTokens: 0
        }
      }));

    const costs = rankedModels
      .map(({ model }) => (perTokenToPerMillion(model.pricing?.prompt) ?? 0) + (perTokenToPerMillion(model.pricing?.completion) ?? 0))
      .filter((value) => value > 0);
    const speeds = rankedModels
      .map(({ model }) => {
        const benchmark = modelKeysForOpenRouter(model).map((key) => benchmarks.get(key)).find(Boolean);
        return finiteNumber(benchmark?.medianOutputTokensPerSecond);
      })
      .filter((value): value is number => value != null && value > 0);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);

    const models: PopularModel[] = rankedModels.map(({ ranking, model }, index) => {
      const benchmark = modelKeysForOpenRouter(model).map((key) => benchmarks.get(key)).find(Boolean);
      const inputCost = perTokenToPerMillion(model.pricing?.prompt);
      const outputCost = perTokenToPerMillion(model.pricing?.completion);
      const combinedCost = inputCost != null || outputCost != null ? (inputCost ?? 0) + (outputCost ?? 0) : null;
      const speed = finiteNumber(benchmark?.medianOutputTokensPerSecond);

      return {
        rank: index + 1,
        modelId: model.id,
        modelName: displayNameFor(model),
        provider: providerNameFor(model),
        weeklyTokens: Math.round(ranking.weeklyTokens),
        inputCostPer1mUsd: inputCost,
        outputCostPer1mUsd: outputCost,
        ageDays: ageDaysFor(model.created),
        artificialAnalysisIntelligenceIndex: finiteNumber(benchmark?.artificialAnalysisIntelligenceIndex),
        artificialAnalysisCodingIndex: finiteNumber(benchmark?.artificialAnalysisCodingIndex),
        artificialAnalysisAgenticIndex: null,
        speedScore: scoreFromRange(speed, minSpeed, maxSpeed),
        priceScore: scoreFromRange(combinedCost, minCost, maxCost, true)
      };
    });

    return {
      models,
      refreshedAt: new Date().toISOString(),
      sources: [
        rankings.length ? "OpenRouter weekly rankings" : "OpenRouter models API fallback order",
        "OpenRouter models API",
        benchmarks.size ? "Artificial Analysis benchmark snapshots" : "Artificial Analysis benchmark snapshots unavailable"
      ]
    };
}

export async function handleModelsRequest(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (req.method === "POST") {
      const { requireUser } = await import("./auth.js");
      await requireUser(req);
    }

    const payload = await Promise.race([
      buildModelsPayload(),
      new Promise<ReturnType<typeof emptyModelsPayload>>((resolve) => {
        setTimeout(() => resolve(emptyModelsPayload("Model data request timed out.")), requestBudgetMs);
      })
    ]);

    return res.status(200).json(payload);
  } catch (error) {
    if (req.method === "POST") {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Model data refresh failed"
      });
    }

    return res.status(200).json(emptyModelsPayload(error instanceof Error ? error.message : "Model data refresh failed"));
  }
}
