import { useEffect, useMemo, useState } from "react";
import { formatCompactNumber, formatCurrency, type AccountProviderSummary, type DashboardPayload, type ProviderUsageSummary } from "@knut/shared";
import { useDashboardStore, isCacheStale } from "../lib/dashboardStore";
import { useAuthSession } from "./useAuthSession";

export function providerAccountToUsageRow(provider: AccountProviderSummary, currency = "USD"): ProviderUsageSummary {
  const isManual = provider.authType === "manual" || provider.authType === "csv_json_import";
  const hasUsage = provider.currentMonthRecords > 0;
  const hasCreditData = provider.creditUsedAmount != null && provider.creditBalanceAmount != null;

  return {
    providerId: provider.id,
    providerName: provider.providerName,
    accountDisplayName: provider.displayName,
    primaryMetric: hasUsage ? formatCurrency(provider.currentMonthSpend, currency) : hasCreditData ? formatCurrency(provider.creditUsedAmount ?? 0, currency) : "Unknown",
    secondaryMetric: hasUsage
      ? `${formatCompactNumber(provider.currentMonthTokens)} tokens`
      : hasCreditData
        ? `${formatCurrency(provider.creditBalanceAmount ?? 0, currency)} credits left`
        : (provider.planName ?? provider.authType.replaceAll("_", " ")),
    last24hMetric: hasUsage ? `24h ${formatCurrency(provider.last24hSpend, currency)}` : "24h no records",
    last7dMetric: hasUsage ? `7d ${formatCurrency(provider.last7dSpend, currency)}` : "7d no records",
    statusBadge: provider.hasCredentials || isManual ? "Ready" : "No key",
    status: provider.hasCredentials || isManual ? "healthy" : "warning",
    confidence: hasUsage ? (isManual ? "manual" : "provider_reported") : hasCreditData ? "exact" : "unknown",
    resetCountdown: provider.resetRule ?? "no reset",
    lastSyncedAt: provider.lastSyncAt ?? "",
    sparklineData: provider.sparklineData
  };
}

export function useDashboardData() {
  const auth = useAuthSession();
  const store = useDashboardStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.user) {
      store.clear();
      return;
    }

    // If cache is empty or stale, refresh in background
    if (!store.data || isCacheStale(store.lastFetchedAt)) {
      setLoading(true);
      store.refresh().finally(() => setLoading(false));
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
    loading: loading || store.isRefreshing,
    refresh: async () => {
      setLoading(true);
      await store.refresh();
      setLoading(false);
    }
  };
}
