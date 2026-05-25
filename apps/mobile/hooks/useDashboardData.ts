import { useEffect, useMemo, useState } from "react";
import { formatCompactNumber, formatCurrency, type AccountProviderSummary, type DashboardPayload, type ProviderUsageSummary } from "@knut/shared";
import { fetchDashboard } from "../lib/accountApi";
import { useAuthSession } from "./useAuthSession";

export function providerAccountToUsageRow(provider: AccountProviderSummary): ProviderUsageSummary {
  const isManual = provider.authType === "manual" || provider.authType === "csv_json_import";
  const hasUsage = provider.currentMonthRecords > 0;
  const hasCreditData = provider.creditUsedAmount != null && provider.creditBalanceAmount != null;

  return {
    providerId: provider.id,
    providerName: provider.providerName,
    accountDisplayName: provider.displayName,
    primaryMetric: hasUsage ? formatCurrency(provider.currentMonthSpend) : hasCreditData ? formatCurrency(provider.creditUsedAmount ?? 0) : "Unknown",
    secondaryMetric: hasUsage
      ? `${formatCompactNumber(provider.currentMonthTokens)} tokens`
      : hasCreditData
        ? `${formatCurrency(provider.creditBalanceAmount ?? 0)} credits left`
        : (provider.planName ?? provider.authType.replaceAll("_", " ")),
    last24hMetric: hasUsage ? `24h ${formatCurrency(provider.last24hSpend)}` : "24h no records",
    last7dMetric: hasUsage ? `7d ${formatCurrency(provider.last7dSpend)}` : "7d no records",
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
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!auth.user) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchDashboard()
      .then((payload) => {
        if (!mounted) return;
        setData(payload);
        setError(null);
      })
      .catch((nextError) => {
        if (!mounted) return;
        setError(nextError instanceof Error ? nextError.message : "Dashboard could not load.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [auth.user?.id]);

  const providerRows = useMemo(
    () => data?.providers.map(providerAccountToUsageRow) ?? [],
    [data?.providers]
  );

  return {
    auth,
    data,
    providerRows,
    error,
    loading,
    refresh: async () => {
      const payload = await fetchDashboard();
      setData(payload);
      setError(null);
    }
  };
}
