import { useEffect, useMemo, useState } from "react";
import { formatCompactNumber, formatCurrency, type AccountProviderSummary, type DataConfidence, type DashboardPayload, type ProviderUsageSummary } from "@knut/shared";
import { useDashboardStore, isCacheStale } from "../lib/dashboardStore";
import { useAuthSession } from "./useAuthSession";

export function providerAccountToUsageRow(provider: AccountProviderSummary, currency = "USD"): ProviderUsageSummary {
  const isManual = provider.authType === "manual" || provider.authType === "csv_json_import";
  const hasUsage = provider.currentMonthRecords > 0;
  const hasCreditData = provider.creditUsedAmount != null && provider.creditBalanceAmount != null;
  const hasTokenQuota = provider.tokenQuotaCap != null && provider.tokenQuotaUsed != null && provider.tokenQuotaCap > 0;

  const tokenQuotaPercent = hasTokenQuota
    ? Math.round((1 - provider.tokenQuotaUsed! / provider.tokenQuotaCap!) * 10000) / 100
    : null;

  return {
    providerId: provider.id,
    providerName: provider.providerName,
    accountDisplayName: provider.displayName,
    primaryMetric: hasTokenQuota
      ? `${tokenQuotaPercent}%`
      : hasUsage
        ? formatCurrency(provider.currentMonthSpend, currency)
        : hasCreditData
          ? formatCurrency(provider.creditUsedAmount ?? 0, currency)
          : "Unknown",
    secondaryMetric: hasTokenQuota
      ? `${formatCompactNumber(provider.tokenQuotaUsed!)} / ${formatCompactNumber(provider.tokenQuotaCap!)} tokens`
      : hasUsage
        ? `${formatCompactNumber(provider.currentMonthTokens)} tokens`
        : hasCreditData
          ? `${formatCurrency(provider.creditBalanceAmount ?? 0, currency)} credits left`
          : (provider.planName ?? provider.authType.replaceAll("_", " ")),
    last24hMetric: hasTokenQuota
      ? ""
      : hasUsage
        ? `24h ${formatCurrency(provider.last24hSpend, currency)}`
        : "24h no records",
    last7dMetric: hasTokenQuota
      ? ""
      : hasUsage
        ? `7d ${formatCurrency(provider.last7dSpend, currency)}`
        : "7d no records",
    statusBadge: provider.hasCredentials || isManual ? "Ready" : "No key",
    status: provider.hasCredentials || isManual ? "healthy" : "warning",
    confidence: hasTokenQuota
      ? (provider.tokenQuotaConfidence as DataConfidence ?? "provider_reported")
      : hasUsage
        ? (isManual ? "manual" : "provider_reported")
        : hasCreditData
          ? "exact"
          : "unknown",
    resetCountdown: provider.resetRule ?? "no reset",
    lastSyncedAt: provider.lastSyncAt ?? "",
    sparklineData: hasTokenQuota ? [] : provider.sparklineData
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
