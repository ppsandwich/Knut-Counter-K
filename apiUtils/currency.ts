import type { AccountProviderSummary, DashboardModelPicks, DashboardPayload, DashboardSummary, PopularModelsPayload, RecommendationBundle, RecommendationResult } from "@knut/shared";
import { normaliseApiCurrencyCode } from "./currencyCodes";

type RateCache = {
  fetchedAt: number;
  rates: Record<string, number>;
};

const cacheTtlMs = 6 * 60 * 60 * 1000;
const rateFetchTimeoutMs = 900;
let rateCache: RateCache | null = null;

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), rateFetchTimeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenExchangeRates() {
  const response = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD");
  if (!response.ok) {
    throw new Error(`Currency rate fetch failed: ${response.status}`);
  }

  const payload = await response.json() as { rates?: Record<string, number>; result?: string };
  if (!payload.rates || payload.result === "error") {
    throw new Error("Currency rate fetch returned no rates");
  }

  return {
    USD: 1,
    ...payload.rates
  };
}

async function fetchFrankfurterRates() {
  const response = await fetchWithTimeout("https://api.frankfurter.dev/v1/latest?base=USD");
  if (!response.ok) {
    throw new Error(`Currency rate fetch failed: ${response.status}`);
  }

  const payload = await response.json() as { rates?: Record<string, number> };
  return {
    USD: 1,
    ...(payload.rates ?? {})
  };
}

async function fetchUsdRates() {
  if (rateCache && Date.now() - rateCache.fetchedAt < cacheTtlMs) {
    return rateCache.rates;
  }

  const rates: Record<string, number> = await fetchOpenExchangeRates().catch(fetchFrankfurterRates);
  rateCache = {
    fetchedAt: Date.now(),
    rates
  };
  return rates;
}

export async function usdToCurrencyRate(currency: string) {
  const targetCurrency = normaliseApiCurrencyCode(currency);
  if (targetCurrency === "USD") return 1;

  try {
    const rates = await fetchUsdRates();
    return rates[targetCurrency] ?? 1;
  } catch {
    return 1;
  }
}

function convertAmount(value: number | null | undefined, rate: number) {
  return value == null ? value : value * rate;
}

function convertProvider(provider: AccountProviderSummary, rate: number): AccountProviderSummary {
  return {
    ...provider,
    currentMonthSpend: provider.currentMonthSpend * rate,
    last24hSpend: provider.last24hSpend * rate,
    last7dSpend: provider.last7dSpend * rate,
    sparklineData: provider.sparklineData.map((value) => value * rate),
    creditCapAmount: convertAmount(provider.creditCapAmount, rate) ?? null,
    creditUsedAmount: convertAmount(provider.creditUsedAmount, rate) ?? null,
    creditBalanceAmount: convertAmount(provider.creditBalanceAmount, rate) ?? null
  };
}

function convertSummary(summary: DashboardSummary, rate: number): DashboardSummary {
  return {
    ...summary,
    monthlySpend: summary.monthlySpend * rate,
    projectedSpend: summary.projectedSpend * rate
  };
}

function convertModelPicks(modelPicks: DashboardModelPicks, rate: number): DashboardModelPicks {
  return {
    smartest: modelPicks.smartest ? {
      ...modelPicks.smartest,
      inputCostPer1mUsd: convertAmount(modelPicks.smartest.inputCostPer1mUsd, rate) ?? null,
      outputCostPer1mUsd: convertAmount(modelPicks.smartest.outputCostPer1mUsd, rate) ?? null
    } : null,
    bestValue: modelPicks.bestValue ? {
      ...modelPicks.bestValue,
      inputCostPer1mUsd: convertAmount(modelPicks.bestValue.inputCostPer1mUsd, rate) ?? null,
      outputCostPer1mUsd: convertAmount(modelPicks.bestValue.outputCostPer1mUsd, rate) ?? null
    } : null,
    cheapest: modelPicks.cheapest ? {
      ...modelPicks.cheapest,
      inputCostPer1mUsd: convertAmount(modelPicks.cheapest.inputCostPer1mUsd, rate) ?? null,
      outputCostPer1mUsd: convertAmount(modelPicks.cheapest.outputCostPer1mUsd, rate) ?? null
    } : null
  };
}

export async function convertDashboardPayload(payload: DashboardPayload, currency: string): Promise<DashboardPayload> {
  const displayCurrency = normaliseApiCurrencyCode(currency);
  const rate = await usdToCurrencyRate(displayCurrency);

  return {
    ...payload,
    summary: {
      ...convertSummary(payload.summary, rate),
      currency: displayCurrency
    },
    providers: payload.providers.map((provider) => convertProvider(provider, rate)),
    modelPicks: convertModelPicks(payload.modelPicks, rate),
    priceIndex: {
      ...payload.priceIndex,
      currency: displayCurrency,
      points: payload.priceIndex.points.map((point) => ({
        ...point,
        averageCombinedPriceUsd: point.averageCombinedPriceUsd * rate
      })),
      currentWeekAverageUsd: convertAmount(payload.priceIndex.currentWeekAverageUsd, rate) ?? null,
      previousWeekAverageUsd: convertAmount(payload.priceIndex.previousWeekAverageUsd, rate) ?? null
    }
  };
}

function convertRecommendation(recommendation: RecommendationResult, rate: number, currency: string): RecommendationResult {
  return {
    ...recommendation,
    estimatedCostUsd: recommendation.estimatedCostUsd * rate,
    estimatedCostCurrency: currency
  };
}

export async function convertRecommendationBundle(bundle: RecommendationBundle, currency: string): Promise<RecommendationBundle> {
  const displayCurrency = normaliseApiCurrencyCode(currency);
  const rate = await usdToCurrencyRate(displayCurrency);

  return {
    ...bundle,
    cheapest: convertRecommendation(bundle.cheapest, rate, displayCurrency),
    quality: convertRecommendation(bundle.quality, rate, displayCurrency),
    balanced: convertRecommendation(bundle.balanced, rate, displayCurrency)
  };
}

export async function convertPopularModelsPayload(payload: PopularModelsPayload, currency: string): Promise<PopularModelsPayload> {
  const displayCurrency = normaliseApiCurrencyCode(currency);
  const rate = await usdToCurrencyRate(displayCurrency);

  return {
    ...payload,
    currency: displayCurrency,
    models: payload.models.map((model) => ({
      ...model,
      inputCostPer1mUsd: convertAmount(model.inputCostPer1mUsd, rate) ?? null,
      outputCostPer1mUsd: convertAmount(model.outputCostPer1mUsd, rate) ?? null
    }))
  };
}
