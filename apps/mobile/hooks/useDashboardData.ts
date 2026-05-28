import { useEffect, useMemo, useState } from "react";
import { formatCompactNumber, formatCurrency, type AccountProviderSummary, type DataConfidence, type DashboardPayload, type ProviderUsageSummary } from "@knut/shared";
import { useDashboardStore, isCacheStale } from "../lib/dashboardStore";
import { useAuthSession } from "./useAuthSession";

export function providerAccountToUsageRow(provider: AccountProviderSummary, currency = "USD"): ProviderUsageSummary {
  const isManual = provider.authType === "manual" || provider.authType === "csv_json_import";
  const hasUsage = provider.currentMonthRecords > 0;
  const hasCreditData = provider.creditUsedAmount != null && provider.creditBalanceAmount != null;
  const hasTokenQuota = provider.tokenQuotaCap != null && provider.tokenQuotaUsed != null && provider.tokenQuotaCap > 0;
  const hasModelQuotas = (provider.modelQuotas?.length ?? 0) > 0;

  const tokenQuotaPercent = hasTokenQuota
    ? Math.round((1 - provider.tokenQuotaUsed! / provider.tokenQuotaCap!) * 10000) / 100
    : null;

  const usedPercent = hasTokenQuota && provider.tokenQuotaCap! > 0
    ? Math.min(100, Math.round((provider.tokenQuotaUsed! / provider.tokenQuotaCap!) * 10000) / 100)
    : null;

  let resetProgress: number | null = null;
  if (hasTokenQuota) {
    if (provider.tokenQuotaResetAt) {
      const resetAt = new Date(provider.tokenQuotaResetAt);
      const daysLeft = Math.max(0, (resetAt.getTime() - Date.now()) / 86_400_000);
      const totalDays = 30;
      resetProgress = Math.min(100, Math.max(0, Math.round((1 - daysLeft / totalDays) * 100)));
    } else if (provider.resetRule) {
      const match = provider.resetRule.match(/(\d+)d/);
      if (match) {
        const daysLeft = parseInt(match[1], 10);
        const totalDays = 30;
        resetProgress = Math.min(100, Math.max(0, Math.round(((totalDays - daysLeft) / totalDays) * 100)));
      }
    }
  }

  const modelMetrics = hasModelQuotas
    ? provider.modelQuotas!.map((q) => ({
        label: q.label.length > 20 ? q.label.slice(0, 18) + "…" : q.label,
        value: `${q.remainingPercent}%`,
        exhausted: q.isExhausted
      }))
    : undefined;

  return {
    providerId: provider.id,
    providerName: provider.providerName,
    accountDisplayName: provider.displayName,
    primaryMetric: hasModelQuotas
      ? `${provider.modelQuotas!.filter((q) => !q.isExhausted).length}/${provider.modelQuotas!.length}`
      : hasTokenQuota
        ? `${tokenQuotaPercent}%`
        : hasUsage
          ? formatCurrency(provider.currentMonthSpend, currency)
          : hasCreditData
            ? formatCurrency(provider.creditUsedAmount ?? 0, currency)
            : "Unknown",
    secondaryMetric: hasModelQuotas
      ? "models remaining"
      : hasTokenQuota
        ? `${formatCompactNumber(provider.tokenQuotaUsed!)} / ${formatCompactNumber(provider.tokenQuotaCap!)} tokens`
        : hasUsage
          ? `${formatCompactNumber(provider.currentMonthTokens)} tokens`
          : hasCreditData
            ? `${formatCurrency(provider.creditBalanceAmount ?? 0, currency)} credits left`
            : (provider.planName ?? provider.authType.replaceAll("_", " ")),
    last24hMetric: hasTokenQuota || hasModelQuotas
      ? ""
      : hasUsage
        ? `24h ${formatCurrency(provider.last24hSpend, currency)}`
        : "24h no records",
    last7dMetric: hasTokenQuota || hasModelQuotas
      ? ""
      : hasUsage
        ? `7d ${formatCurrency(provider.last7dSpend, currency)}`
        : "7d no records",
    statusBadge: provider.hasCredentials || isManual ? "Ready" : "No key",
    status: provider.hasCredentials || isManual ? "healthy" : "warning",
    confidence: hasTokenQuota || hasModelQuotas
      ? (provider.tokenQuotaConfidence as DataConfidence ?? "provider_reported")
      : hasUsage
        ? (isManual ? "manual" : "provider_reported")
        : hasCreditData
          ? "exact"
          : "unknown",
    resetCountdown: provider.resetRule ?? "no reset",
    lastSyncedAt: provider.lastSyncAt ?? "",
    sparklineData: hasTokenQuota || hasModelQuotas ? [] : provider.sparklineData,
    modelMetrics,
    usedPercent,
    resetProgress,
    tokenQuotaUsed: provider.tokenQuotaUsed,
    tokenQuotaCap: provider.tokenQuotaCap,
    hideQuotaText: provider.tokenQuotaUnit != null && provider.tokenQuotaUnit !== "tokens",
    resetDaysLeft: hasTokenQuota
      ? provider.tokenQuotaResetAt
        ? Math.max(0, Math.ceil((new Date(provider.tokenQuotaResetAt).getTime() - Date.now()) / 86_400_000))
        : provider.resetRule
          ? (() => { const m = provider.resetRule.match(/(\d+)d/); return m ? parseInt(m[1], 10) : null; })()
          : null
      : null
  };
}

export function useDashboardData() {
  const auth = useAuthSession();
  const store = useDashboardStore();

  useEffect(() => {
    if (!auth.user) {
      store.clear();
      return;
    }

    // Load cached data first
    store.loadFromCache();

    // If cache is empty or stale, refresh in background (non-blocking)
    if (!store.data || isCacheStale(store.lastFetchedAt)) {
      store.refresh();
    }
  }, [auth.user?.id]);

  const providerRows = useMemo(
    () => store.data?.providers.map((provider) => providerAccountToUsageRow(provider, store.data?.profile?.preferredCurrency ?? store.data?.summary.currency ?? "USD")) ?? [],
    [store.data?.providers, store.data?.profile?.preferredCurrency, store.data?.summary.currency]
  );

  return {
    auth,
    data: store.data,
    providerRows,
    error: store.error,
    // Only show loading when there's no cached data at all
    loading: !store.data && store.isRefreshing,
    refresh: store.refresh
  };
}
