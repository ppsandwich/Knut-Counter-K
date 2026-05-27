import type { RawPrice } from "../normalisePricing";

type OpenRouterModel = {
  id: string;
  canonical_slug?: string;
  name?: string;
  created?: number;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
    internal_reasoning?: string;
  };
  usage?: Record<string, unknown>;
};

function numberFromString(value: string | undefined) {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function usageFromModel(model: OpenRouterModel) {
  const usage = model.usage;
  if (!usage) return undefined;

  for (const key of ["weekly_tokens", "tokens_7d", "tokens7d", "week", "weekly"]) {
    const value = numberFromUnknown(usage[key]);
    if (value != null) return value;
  }

  return undefined;
}

function parseTokenCount(value: string) {
  const match = value.match(/([\d.]+)\s*([KMBT])?/i);
  if (!match) return undefined;

  const numberValue = Number(match[1]);
  if (!Number.isFinite(numberValue)) return undefined;

  const multiplier = match[2]?.toUpperCase() === "T"
    ? 1_000_000_000_000
    : match[2]?.toUpperCase() === "B"
      ? 1_000_000_000
      : match[2]?.toUpperCase() === "M"
        ? 1_000_000
        : match[2]?.toUpperCase() === "K"
          ? 1_000
          : 1;

  return Math.round(numberValue * multiplier);
}

function normaliseText(value: string) {
  return value
    .toLowerCase()
    .replace(/^~/, "")
    .replace(/:.+$/, "")
    .replace(/^(openai|anthropic|google|x-ai|xai|deepseek|mistralai|mistral|cohere|groq|perplexity|openrouter|qwen|qwenlm)[/:_-]+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function modelKeys(model: OpenRouterModel) {
  return [
    model.id,
    model.name,
    model.canonical_slug,
    model.canonical_slug?.replace(/-\d{8}$/, "")
  ].flatMap((value) => value ? [normaliseText(value)] : []).filter(Boolean);
}

function decodeHtmlText(value: string) {
  return value
    .replace(/<script\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, "\"")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

type OpenRouterFrontendModel = {
  slug?: string;
  permaslug?: string;
  name?: string;
  short_name?: string;
};

type OpenRouterFrontendAnalytics = {
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
};

async function fetchOpenRouterWeeklyUsage(models: OpenRouterModel[]) {
  const usageByKey = new Map<string, number>();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const frontendResponse = await fetch("https://openrouter.ai/api/frontend/models/find", {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "Knut Counter pricing refresh"
      }
    });
    if (frontendResponse.ok) {
      const json = await frontendResponse.json() as {
        data?: {
          models?: OpenRouterFrontendModel[];
          analytics?: Record<string, OpenRouterFrontendAnalytics>;
        };
      };
      const analytics = json.data?.analytics ?? {};
      const frontendModels = json.data?.models ?? [];

      for (const model of frontendModels) {
        const stats = model.permaslug ? analytics[model.permaslug] : undefined;
        const weeklyTokens = stats ? (stats.total_prompt_tokens ?? 0) + (stats.total_completion_tokens ?? 0) : 0;
        if (weeklyTokens <= 0) continue;

        for (const value of [model.slug, model.permaslug, model.name, model.short_name]) {
          if (value) usageByKey.set(normaliseText(value), weeklyTokens);
        }
      }

      for (const [key, stats] of Object.entries(analytics)) {
        const weeklyTokens = (stats.total_prompt_tokens ?? 0) + (stats.total_completion_tokens ?? 0);
        if (weeklyTokens > 0) usageByKey.set(normaliseText(key), weeklyTokens);
      }

      if (usageByKey.size) return usageByKey;
    }

    const response = await fetch("https://openrouter.ai/models?fmt=cards&order=top-weekly", {
      signal: controller.signal,
      headers: {
        accept: "text/html",
        "user-agent": "Knut Counter pricing refresh"
      }
    });
    if (!response.ok) return usageByKey;

    const text = decodeHtmlText(await response.text());
    for (const model of models) {
      const keys = modelKeys(model);
      const labels = [model.name, model.id.split("/").at(-1), model.id, model.canonical_slug]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

      for (const label of labels) {
        const match = text.match(new RegExp(`${label}.{0,900}?([\\d.]+\\s*[KMBT]?\\s*tokens)`, "i"));
        const weeklyTokens = match ? parseTokenCount(match[1]) : undefined;
        if (weeklyTokens == null) continue;

        for (const key of keys) {
          usageByKey.set(key, weeklyTokens);
        }
        break;
      }
    }
  } catch {
    return usageByKey;
  } finally {
    clearTimeout(timeout);
  }

  return usageByKey;
}

export async function fetchOpenRouterPricing(): Promise<RawPrice[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) {
    throw new Error(`OpenRouter pricing fetch failed: ${response.status}`);
  }

  const json = await response.json() as { data?: OpenRouterModel[] };
  const models = json.data ?? [];
  const usageByKey = await fetchOpenRouterWeeklyUsage(models);

  return models.map((model) => ({
    providerId: "openrouter",
    modelId: model.id,
    modelDisplayName: model.name ?? model.id,
    inputPricePerTokenUsd: numberFromString(model.pricing?.prompt),
    outputPricePerTokenUsd: numberFromString(model.pricing?.completion),
    cachedInputPricePer1mTokensUsd: numberFromString(model.pricing?.input_cache_read) == null ? undefined : numberFromString(model.pricing?.input_cache_read)! * 1_000_000,
    reasoningPricePer1mTokensUsd: numberFromString(model.pricing?.internal_reasoning) == null ? undefined : numberFromString(model.pricing?.internal_reasoning)! * 1_000_000,
    contextWindow: model.context_length,
    weeklyTokens: usageFromModel(model) ?? modelKeys(model).map((key) => usageByKey.get(key)).find((value) => value != null),
    sourceName: "OpenRouter",
    sourcePriority: 3,
    sourceConfidence: "official"
  }));
}
