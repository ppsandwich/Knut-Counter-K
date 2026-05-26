import { useEffect, useState } from "react";
import type { PopularModel, PopularModelsPayload } from "@knut/shared";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../../hooks/useAuthSession";
import { fetchPopularModels } from "../../lib/accountApi";

function formatCost(value: number | null) {
  if (value == null) return "-";
  if (value === 0) return "$0";
  return `$${value.toFixed(value >= 10 ? 1 : value >= 1 ? 2 : 3)}`;
}

function formatAge(days: number | null) {
  if (days == null) return "-";
  if (days < 1) return "today";
  if (days < 31) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function formatScore(value: number | null) {
  return value == null ? "-" : String(Math.round(value));
}

function formatWeeklyTokens(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

export default function ModelsScreen() {
  const auth = useAuthSession();
  const [payload, setPayload] = useState<PopularModelsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(refresh = false) {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      setPayload(await fetchPopularModels(refresh));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Model data could not load.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void load(false);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Models</Text>
            <Text style={styles.subtitle}>Top 50 by OpenRouter weekly usage</Text>
          </View>
          {auth.session ? (
            <Pressable disabled={isRefreshing} onPress={() => load(true)} style={[styles.refreshButton, isRefreshing && styles.disabled]}>
              <Text style={styles.refreshText}>{isRefreshing ? "Refreshing..." : "Refresh model data"}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Model data unavailable.</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {isLoading && !payload ? (
            <Text style={styles.loading}>Loading model rankings...</Text>
          ) : payload?.models.map((model) => (
            <ModelRow key={`${model.rank}:${model.modelId}`} model={model} />
          ))}
        </View>

        <Text style={styles.footnote}>
          Sources: OpenRouter weekly rankings and models API; Artificial Analysis benchmark snapshots and public model catalogue. Speed and price scores are normalized within this top-50 list.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModelRow({ model }: { model: PopularModel }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rank}>#{model.rank}</Text>
        <View style={styles.identity}>
          <Text style={styles.modelName} numberOfLines={1}>{model.modelName}</Text>
          <Text style={styles.provider}>{model.provider} · {formatWeeklyTokens(model.weeklyTokens)} tokens/wk · age {formatAge(model.ageDays)}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric label="In $/1M" value={formatCost(model.inputCostPer1mUsd)} />
        <Metric label="Out $/1M" value={formatCost(model.outputCostPer1mUsd)} />
        <Metric label="Intel" value={formatScore(model.artificialAnalysisIntelligenceIndex)} />
        <Metric label="Code" value={formatScore(model.artificialAnalysisCodingIndex)} />
        <Metric label="Agent" value={formatScore(model.artificialAnalysisAgenticIndex)} />
        <Metric label="Speed" value={formatScore(model.speedScore)} />
        <Metric label="Price" value={formatScore(model.priceScore)} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800" },
  subtitle: { color: "#a1a1aa", fontSize: 12, fontWeight: "800", marginTop: 2, textTransform: "uppercase" },
  refreshButton: { minHeight: 38, justifyContent: "center", borderRadius: 7, backgroundColor: "#f4f4f5", paddingHorizontal: 12 },
  refreshText: { color: "#050506", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  list: { gap: 8 },
  loading: { color: "#a1a1aa", fontSize: 14, fontWeight: "800", padding: 14, backgroundColor: "#111113", borderRadius: 8 },
  row: { backgroundColor: "#111113", borderColor: "#29292d", borderWidth: 1, borderRadius: 8, padding: 10, gap: 8 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  rank: { width: 34, color: "#86efac", fontSize: 13, fontWeight: "900" },
  identity: { flex: 1, minWidth: 0 },
  modelName: { color: "#f4f4f5", fontSize: 15, fontWeight: "900" },
  provider: { color: "#8b8b91", fontSize: 11, fontWeight: "800", marginTop: 2 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metric: { minWidth: 54, flexGrow: 1, backgroundColor: "#09090b", borderColor: "#242428", borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 6 },
  metricValue: { color: "#e5e7eb", fontSize: 13, fontWeight: "900" },
  metricLabel: { color: "#7b8b7f", fontSize: 9, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  footnote: { color: "#6f7b72", fontSize: 10, lineHeight: 15, fontWeight: "800" },
  errorBox: { backgroundColor: "#241314", borderColor: "#7f1d1d", borderWidth: 1, borderRadius: 8, padding: 14 },
  errorTitle: { color: "#fecaca", fontSize: 16, fontWeight: "900" },
  errorText: { color: "#fca5a5", fontSize: 13, lineHeight: 18, marginTop: 4 }
});
