import { RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { AlertSummary, MonthlyDamageCard, ProviderUsageRow, Sparkline, SyncStatusStrip, FadeInView, SlideUpView, AnimatedCard, usePulse } from "@knut/ui";
import { formatCurrency, type AccountAlert, type DashboardModelPick, type PriceIndexSummary } from "@knut/shared";
import { useDashboardData } from "../../hooks/useDashboardData";
import { fetchAlerts, syncProviders } from "../../lib/accountApi";

const emptySummary = {
  monthlySpend: 0,
  monthlyBudget: 0,
  totalTokens: 0,
  projectedSpend: 0,
  status: "healthy" as const,
  statusText: "Sign in to load your usage data.",
  currency: "USD"
};

const emptyPriceIndex: PriceIndexSummary = {
  points: [],
  currentWeekAverageUsd: null,
  previousWeekAverageUsd: null,
  changePercent: null,
  currency: "USD"
};

function formatModelCost(value: number | null, currency: string) {
  if (value == null) return "-";
  return formatCurrency(value, currency);
}

function formatModelScore(value: number | null) {
  return value == null ? "-" : String(Math.round(value));
}

export default function DashboardScreen() {
  const dashboard = useDashboardData();
  const providerRows = dashboard.providerRows;
  const signedIn = Boolean(dashboard.auth.user);
  const summary = dashboard.data?.summary ?? emptySummary;
  const currency = dashboard.data?.profile?.preferredCurrency ?? summary.currency ?? "USD";
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
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshUsage} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={0}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Knut Counter</Text>
              <Text style={styles.subtitle}>Today{dashboard.loading ? " · syncing..." : ""}</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable disabled={!signedIn || refreshing} onPress={refreshUsage} style={({ pressed }) => [styles.refreshButton, (!signedIn || refreshing) && styles.disabled, pressed && styles.pressed]}>
                <Text style={styles.refreshButtonText}>{refreshing ? "Syncing..." : "Refresh"}</Text>
              </Pressable>
              <Text style={styles.currency}>{currency}</Text>
            </View>
          </View>
        </FadeInView>
        {refreshMessage ? <SlideUpView delay={50}><Text style={styles.refreshMessage}>{refreshMessage}</Text></SlideUpView> : null}

        <MonthlyDamageCard summary={summary} refreshing={dashboard.loading} />
        <ModelPicksCard picks={dashboard.data?.modelPicks ?? null} loading={signedIn && dashboard.loading} currency={currency} />

        <SlideUpView delay={200}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Providers</Text>
            <Text style={styles.sectionMeta}>{providerRows.length ? "live accounts" : "setup"}</Text>
          </View>
        </SlideUpView>
        {!signedIn ? (
          <AnimatedCard index={3}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sign in to see your accounts.</Text>
              <Text style={styles.emptyBody}>Your API keys, manual plans, budgets, and imports will follow your account.</Text>
            </View>
          </AnimatedCard>
        ) : dashboard.error && !dashboard.data ? (
          <AnimatedCard index={3}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Dashboard could not load.</Text>
              <Text style={styles.emptyBody}>{dashboard.error}</Text>
            </View>
          </AnimatedCard>
        ) : providerRows.length ? (
          providerRows.map((provider, index) => (
            <ProviderUsageRow key={provider.providerId} provider={provider} index={index} refreshing={dashboard.loading} />
          ))
        ) : (
          <AnimatedCard index={3}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No providers connected yet.</Text>
              <Text style={styles.emptyBody}>Add a provider to start tracking where the tokens are escaping.</Text>
            </View>
          </AnimatedCard>
        )}

        <SyncStatusStrip status={signedIn ? `${providerRows.length} provider accounts loaded.` : "Sign in to sync account data."} />
        {alerts.length ? <AlertSummary alerts={alerts} /> : null}
        <PriceIndexCard priceIndex={dashboard.data?.priceIndex ?? emptyPriceIndex} currency={currency} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ModelPicksCard({ picks, loading, currency }: { picks: NonNullable<ReturnType<typeof useDashboardData>["data"]>["modelPicks"] | null; loading: boolean; currency: string }) {
  return (
    <View style={styles.modelPicksCard}>
      <ModelPickStrip label="Smartest" pick={picks?.smartest ?? null} loading={loading} currency={currency} />
      <ModelPickStrip label="Best value" pick={picks?.bestValue ?? null} loading={loading} currency={currency} />
      <ModelPickStrip label="Cheapest" pick={picks?.cheapest ?? null} loading={loading} currency={currency} isLast />
    </View>
  );
}

function ModelPickStrip({ label, pick, loading, currency, isLast }: { label: string; pick: DashboardModelPick | null; loading: boolean; currency: string; isLast?: boolean }) {
  const detail = loading
    ? "Loading model data..."
    : pick
      ? `${pick.provider} / In ${formatModelCost(pick.inputCostPer1mUsd, currency)} / Out ${formatModelCost(pick.outputCostPer1mUsd, currency)} / Intel ${formatModelScore(pick.intelligenceScore)}`
      : "No priced benchmark model found.";

  const { style: loadingStyle } = usePulse({ minOpacity: 0.4, maxOpacity: 1, duration: 1200 });

  return (
    <View style={[styles.modelPickStrip, isLast && styles.modelPickStripLast]}>
      <Text style={styles.modelPickLabel}>{label}</Text>
      <View style={styles.modelPickBody}>
        <Animated.Text style={[styles.modelPickName, loading && loadingStyle]} numberOfLines={1}>{pick?.modelName ?? (loading ? "Checking models" : "Unavailable")}</Animated.Text>
        <Animated.Text style={[styles.modelPickDetail, loading && loadingStyle]} numberOfLines={1}>{detail}</Animated.Text>
      </View>
    </View>
  );
}

function LoadingCard() {
  const { style: loadingStyle } = usePulse({ minOpacity: 0.3, maxOpacity: 0.7, duration: 1500 });

  return (
    <View style={styles.emptyCard}>
      <Animated.Text style={[styles.emptyTitle, loadingStyle]}>Loading providers...</Animated.Text>
    </View>
  );
}

function PriceIndexCard({ priceIndex, currency }: { priceIndex: PriceIndexSummary; currency: string }) {
  const values = priceIndex.points.map((point) => point.averageCombinedPriceUsd).filter((value) => value > 0);
  const current = priceIndex.currentWeekAverageUsd;
  const previous = priceIndex.previousWeekAverageUsd;
  const change = priceIndex.changePercent;
  const changeText = change == null
    ? "Not enough history yet"
    : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs previous week`;
  const tone = change == null ? styles.priceIndexNeutral : change <= 0 ? styles.priceIndexGood : styles.priceIndexBad;
  const previousText = previous == null ? "Previous week unavailable" : `Previous week ${formatCurrency(previous, currency)}`;

  return (
    <View style={styles.priceIndexCard}>
      <View style={styles.priceIndexHeader}>
        <View style={styles.priceIndexTextBlock}>
          <Text style={styles.priceIndexLabel}>Price Index</Text>
          <Text style={styles.priceIndexTitle}>{current == null ? "Unavailable" : formatCurrency(current, currency)}</Text>
        </View>
        <Sparkline values={values} color={change != null && change > 0 ? "#f59e0b" : "#22c55e"} />
      </View>
      <Text style={styles.priceIndexBody}>
        Tracks the average combined input and output token price of the top 10 models on OpenRouter.
      </Text>
      <View style={styles.priceIndexSummaryRow}>
        <Text style={[styles.priceIndexChange, tone]}>{changeText}</Text>
        <Text style={styles.priceIndexPrevious}>{previousText}</Text>
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
  emptyBody: { color: "#a1a1aa", fontSize: 14, lineHeight: 20 },
  priceIndexCard: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  priceIndexHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  priceIndexTextBlock: { flex: 1, minWidth: 0 },
  priceIndexLabel: { color: "#a1a1aa", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  priceIndexTitle: { color: "#f4f4f5", fontSize: 24, fontWeight: "900", marginTop: 3 },
  priceIndexBody: { color: "#a1a1aa", fontSize: 13, lineHeight: 18 },
  priceIndexSummaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  priceIndexChange: { fontSize: 13, fontWeight: "900" },
  priceIndexGood: { color: "#86efac" },
  priceIndexBad: { color: "#fbbf24" },
  priceIndexNeutral: { color: "#a1a1aa" },
  priceIndexPrevious: { color: "#71717a", fontSize: 12, fontWeight: "800" }
});
