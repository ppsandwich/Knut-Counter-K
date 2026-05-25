import { RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertSummary, MonthlyDamageCard, ProviderUsageRow, RecommendationCard, SyncStatusStrip } from "@knut/ui";
import { mockDashboard } from "@knut/shared/mockData";
import type { RecommendationResult } from "@knut/shared";
import { useDashboardData } from "../../hooks/useDashboardData";
import { recommendProvider, syncProviders } from "../../lib/accountApi";

const emptySummary = {
  monthlySpend: 0,
  monthlyBudget: 0,
  totalTokens: 0,
  projectedSpend: 0,
  status: "healthy" as const,
  statusText: "Sign in to load your usage data."
};

export default function DashboardScreen() {
  const dashboard = useDashboardData();
  const providerRows = dashboard.providerRows;
  const signedIn = Boolean(dashboard.auth.user);
  const summary = dashboard.data?.summary ?? emptySummary;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  async function refreshRecommendation() {
    if (!signedIn) {
      setRecommendation(null);
      setRecommendationError(null);
      return;
    }

    setRecommendationLoading(true);
    setRecommendationError(null);
    try {
      const result = await recommendProvider({
        taskType: "General next task",
        estimatedInputTokens: 10000,
        estimatedOutputTokens: 1500,
        excludeNearCapProviders: true
      });
      setRecommendation(result.balanced);
    } catch (error) {
      setRecommendation(null);
      setRecommendationError(error instanceof Error ? error.message : "Could not calculate a recommendation yet.");
    } finally {
      setRecommendationLoading(false);
    }
  }

  useEffect(() => {
    void refreshRecommendation();
  }, [signedIn, providerRows.length, summary.monthlySpend, summary.totalTokens]);

  async function refreshUsage() {
    if (!signedIn || refreshing) return;

    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const result = await syncProviders();
      await dashboard.refresh();
      await refreshRecommendation();
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
        <RecommendationCard
          recommendation={recommendation ?? mockDashboard.recommendation}
          loading={recommendationLoading}
          error={signedIn ? recommendationError : "Sign in and connect providers to get a real recommendation."}
        />

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
        <AlertSummary alerts={mockDashboard.alerts} />
      </ScrollView>
    </SafeAreaView>
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
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { color: "#f4f4f5", fontSize: 20, fontWeight: "800" },
  sectionMeta: { color: "#71717a", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  emptyCard: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 6 },
  emptyTitle: { color: "#f4f4f5", fontSize: 16, fontWeight: "900" },
  emptyBody: { color: "#a1a1aa", fontSize: 14, lineHeight: 20 }
});
