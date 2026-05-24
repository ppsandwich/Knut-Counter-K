import { useEffect, useMemo, useState } from "react";
import type { AccountProviderSummary, DashboardPayload, ProviderUsageSummary } from "@knut/shared";
import { fetchDashboard } from "../lib/accountApi";
import { useAuthSession } from "./useAuthSession";

function sparklineForProvider(providerId: string) {
  const seed = providerId.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return Array.from({ length: 12 }, (_item, index) => 4 + ((seed + index * 3) % 9));
}

export function providerAccountToUsageRow(provider: AccountProviderSummary): ProviderUsageSummary {
  const isManual = provider.authType === "manual" || provider.authType === "csv_json_import";

  return {
    providerId: provider.id,
    providerName: provider.providerName,
    accountDisplayName: provider.displayName,
    primaryMetric: provider.monthlyBudget == null ? "Unknown" : `$${provider.monthlyBudget}`,
    secondaryMetric: provider.planName ?? provider.authType.replaceAll("_", " "),
    statusBadge: provider.hasCredentials || isManual ? "Ready" : "No key",
    status: provider.hasCredentials || isManual ? "healthy" : "warning",
    confidence: isManual ? "manual" : "unknown",
    resetCountdown: provider.resetRule ?? "no reset",
    lastSyncedAt: provider.lastSyncAt ?? "",
    sparklineData: sparklineForProvider(provider.providerId)
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
