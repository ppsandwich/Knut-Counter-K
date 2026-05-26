import { RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertSummary, MonthlyDamageCard, ProviderUsageRow, SyncStatusStrip } from "@knut/ui";
import type { AccountAlert, DashboardModelPick } from "@knut/shared";
import { useDashboardData } from "../../hooks/useDashboardData";
import { fetchAlerts, syncProviders } from "../../lib/accountApi";

const emptySummary = {
  monthlySpend: 0,
  monthlyBudget: 0,
  totalTokens: 0,
  projectedSpend: 0,
  status: "healthy" as const,
  statusText: "Sign in to load your usage data."
};

function formatModelCost(value: number | null) {
  if (value == null) return "-";
  if (value === 0) return "$0";
  return `$${value.toFixed(value >= 10 ? 1 : value >= 1 ? 2 : 3)}`;
}

function formatModelScore(value: number | null) {
  return value == null ? "-" : String(Math.round(value));
}

export default function DashboardScreen() {
  const dashboard = useDashboardData();
  const providerRows = dashboard.providerRows;
  const signedIn = Boolean(dashboard.auth.user);
  const summary = dashboard.data?.summary ?? emptySummary;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AccountAlert[]>([]);

  async function refreshAlerts() {
    if (!signedIn) {
      setAlerts([]);
      return;
    }

    try {
      setAlerts(await fetchAlerts());
    } catch {
      setAlerts([]);
    }
  }

  useEffect(() => {
    void refreshAlerts();
  }, [signedIn]);

  async function refreshUsage() {
    if (!signedIn || refreshing) return;

    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const result = await syncProviders();
      await dashboard.refresh();
      await refreshAlerts();
      setRefreshMessage(result.synced ? `Refreshed ${result.synced} provider${result.synced === 1 ? "" : "s"}.` : "No active providers to refresh.");
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshUsage} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Knut Counter</Text>
            <Text style={styles.subtitle}>Today</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable disabled={!signedIn || refreshing} onPress={refreshUsage} style={({ pressed }) => [styles.refreshButton, (!signedIn || refreshing) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.refreshButtonText}>{refreshing ? "Refreshing" : "Refresh"}</Text>
            </Pressable>
            <Text style={styles.currency}>USD</Text>
          </View>
        </View>
        {refreshMessage ? <Text style={styles.refreshMessage}>{refreshMessage}</Text> : null}

        <MonthlyDamageCard summary={summary} />
        <ModelPicksCard picks={dashboard.data?.modelPicks ?? null} loading={signedIn && dashboard.loading} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Providers</Text>
          <Text style={styles.sectionMeta}>{providerRows.length ? "live accounts" : "setup"}</Text>
        </View>
        {!signedIn ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sign in to see your accounts.</Text>
            <Text style={styles.emptyBody}>Your API keys, manual plans, budgets, and imports will follow your account.</Text>
          </View>
        ) : dashboard.loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Loading providers...</Text>
          </View>
        ) : dashboard.error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Dashboard could not load.</Text>
            <Text style={styles.emptyBody}>{dashboard.error}</Text>
          </View>
        ) : providerRows.length ? (
          providerRows.map((provider) => (
            <ProviderUsageRow key={provider.providerId} provider={provider} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No providers connected yet.</Text>
            <Text style={styles.emptyBody}>Add a provider to start tracking where the tokens are escaping.</Text>
          </View>
        )}

        <SyncStatusStrip status={signedIn ? `${providerRows.length} provider accounts loaded.` : "Sign in to sync account data."} />
        <AlertSummary alerts={alerts} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ModelPicksCard({ picks, loading }: { picks: NonNullable<ReturnType<typeof useDashboardData>["data"]>["modelPicks"] | null; loading: boolean }) {
  return (
    <View style={styles.modelPicksCard}>
      <ModelPickStrip label="Smartest" pick={picks?.smartest ?? null} loading={loading} />
      <ModelPickStrip label="Best value" pick={picks?.bestValue ?? null} loading={loading} />
      <ModelPickStrip label="Cheapest" pick={picks?.cheapest ?? null} loading={loading} isLast />
    </View>
  );
}

function ModelPickStrip({ label, pick, loading, isLast }: { label: string; pick: DashboardModelPick | null; loading: boolean; isLast?: boolean }) {
  const detail = loading
    ? "Loading model data..."
    : pick
      ? `${pick.provider} / In ${formatModelCost(pick.inputCostPer1mUsd)} / Out ${formatModelCost(pick.outputCostPer1mUsd)} / Intel ${formatModelScore(pick.intelligenceScore)}`
      : "No priced benchmark model found.";

  return (
    <View style={[styles.modelPickStrip, isLast && styles.modelPickStripLast]}>
      <Text style={styles.modelPickLabel}>{label}</Text>
      <View style={styles.modelPickBody}>
        <Text style={styles.modelPickName} numberOfLines={1}>{pick?.modelName ?? (loading ? "Checking models" : "Unavailable")}</Text>
        <Text style={styles.modelPickDetail} numberOfLines={1}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 10 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 },
  headerActions: { alignItems: "flex-end", gap: 6 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800", letterSpacing: 0 },
  subtitle: { color: "#8b8b91", fontSize: 15, marginTop: 2 },
  currency: { color: "#a1a1aa", fontSize: 12, fontWeight: "700", paddingBottom: 6 },
  refreshButton: { minHeight: 34, borderRadius: 7, backgroundColor: "#f4f4f5", paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  refreshButtonText: { color: "#050506", fontSize: 13, fontWeight: "900" },
  refreshMessage: { color: "#a1a1aa", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  modelPicksCard: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  modelPickStrip: { minHeight: 58, flexDirection: "row", alignItems: "center", borderBottomColor: "#242428", borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 10 },
  modelPickStripLast: { borderBottomWidth: 0 },
  modelPickLabel: { width: 76, color: "#86efac", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  modelPickBody: { flex: 1, minWidth: 0 },
  modelPickName: { color: "#f4f4f5", fontSize: 14, fontWeight: "900" },
  modelPickDetail: { color: "#a1a1aa", fontSize: 11, fontWeight: "800", marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { color: "#f4f4f5", fontSize: 20, fontWeight: "800" },
  sectionMeta: { color: "#71717a", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  emptyCard: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 6 },
  emptyTitle: { color: "#f4f4f5", fontSize: 16, fontWeight: "900" },
  emptyBody: { color: "#a1a1aa", fontSize: 14, lineHeight: 20 }
});
