import { useEffect, useState } from "react";
import type { PopularModel, PopularModelsPayload } from "@knut/shared";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../../hooks/useAuthSession";
import { fetchPopularModels } from "../../lib/accountApi";

type MetricRange = { min: number; max: number };
type MetricRanges = {
  inputCost: MetricRange | null;
  outputCost: MetricRange | null;
  age: MetricRange | null;
  intelligence: MetricRange | null;
  coding: MetricRange | null;
  speed: MetricRange | null;
  price: MetricRange | null;
};
type SortKey = "popularity" | "inputCost" | "outputCost" | "age" | "intelligence" | "coding" | "speed" | "price";
type SortDirection = "desc" | "asc";

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "popularity", label: "Pop" },
  { key: "inputCost", label: "In" },
  { key: "outputCost", label: "Out" },
  { key: "age", label: "Age" },
  { key: "intelligence", label: "Intel" },
  { key: "coding", label: "Code" },
  { key: "speed", label: "Speed" },
  { key: "price", label: "Price" }
];

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

function rangeFor(models: PopularModel[], getValue: (model: PopularModel) => number | null) {
  const values = models.map(getValue).filter((value): value is number => value != null && Number.isFinite(value));
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function metricRangesFor(models: PopularModel[]): MetricRanges {
  return {
    inputCost: rangeFor(models, (model) => model.inputCostPer1mUsd),
    outputCost: rangeFor(models, (model) => model.outputCostPer1mUsd),
    age: rangeFor(models, (model) => model.ageDays),
    intelligence: rangeFor(models, (model) => model.artificialAnalysisIntelligenceIndex),
    coding: rangeFor(models, (model) => model.artificialAnalysisCodingIndex),
    speed: rangeFor(models, (model) => model.speedScore),
    price: rangeFor(models, (model) => model.priceScore)
  };
}

function colorForMetric(value: number | null, range: MetricRange | null, higherIsBetter: boolean) {
  if (value == null || !range || range.max <= range.min) return "#e5e7eb";

  const ratio = Math.min(1, Math.max(0, (value - range.min) / (range.max - range.min)));
  const score = higherIsBetter ? ratio : 1 - ratio;
  if (score >= 0.75) return "#86efac";
  if (score >= 0.5) return "#bef264";
  if (score >= 0.25) return "#fbbf24";
  return "#f87171";
}

function valueForSort(model: PopularModel, sortKey: SortKey) {
  if (sortKey === "popularity") return model.weeklyTokens;
  if (sortKey === "inputCost") return model.inputCostPer1mUsd;
  if (sortKey === "outputCost") return model.outputCostPer1mUsd;
  if (sortKey === "age") return model.ageDays;
  if (sortKey === "intelligence") return model.artificialAnalysisIntelligenceIndex;
  if (sortKey === "coding") return model.artificialAnalysisCodingIndex;
  if (sortKey === "speed") return model.speedScore;
  return model.priceScore;
}

function sortedModels(models: PopularModel[], sortKey: SortKey, sortDirection: SortDirection) {
  return [...models].sort((a, b) => {
    const aValue = valueForSort(a, sortKey);
    const bValue = valueForSort(b, sortKey);
    if (aValue == null && bValue == null) return a.rank - b.rank;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    const comparison = aValue - bValue;
    if (comparison === 0) return a.rank - b.rank;
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

export default function ModelsScreen() {
  const auth = useAuthSession();
  const [payload, setPayload] = useState<PopularModelsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("popularity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

  const ranges = payload ? metricRangesFor(payload.models) : null;
  const visibleModels = payload ? sortedModels(payload.models, sortKey, sortDirection) : [];

  function changeSort(nextSortKey: SortKey) {
    if (nextSortKey === sortKey) {
      setSortDirection((direction) => direction === "desc" ? "asc" : "desc");
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("desc");
  }

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

        <View style={styles.sortBar}>
          {sortOptions.map((option) => {
            const isActive = option.key === sortKey;
            return (
              <Pressable key={option.key} onPress={() => changeSort(option.key)} style={[styles.sortButton, isActive && styles.sortButtonActive]}>
                <Text style={[styles.sortText, isActive && styles.sortTextActive]}>
                  {option.label}{isActive ? sortDirection === "desc" ? " ↓" : " ↑" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.list}>
          {isLoading && !payload ? (
            <Text style={styles.loading}>Loading model rankings...</Text>
          ) : payload && ranges ? (
            visibleModels.map((model) => <ModelRow key={`${model.rank}:${model.modelId}`} model={model} ranges={ranges} />)
          ) : null}
        </View>

        <Text style={styles.footnote}>
          Sources: OpenRouter weekly rankings and models API; Artificial Analysis benchmark snapshots and public model catalogue. Metric colors are normalized within this top-50 list.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModelRow({ model, ranges }: { model: PopularModel; ranges: MetricRanges }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rank}>#{model.rank}</Text>
        <View style={styles.identity}>
          <Text style={styles.modelName} numberOfLines={1}>{model.modelName}</Text>
          <Text style={styles.provider}>
            {model.provider} / {formatWeeklyTokens(model.weeklyTokens)} tokens/wk / age{" "}
            <Text style={{ color: colorForMetric(model.ageDays, ranges.age, false) }}>{formatAge(model.ageDays)}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric label="In $/1M" value={formatCost(model.inputCostPer1mUsd)} color={colorForMetric(model.inputCostPer1mUsd, ranges.inputCost, false)} />
        <Metric label="Out $/1M" value={formatCost(model.outputCostPer1mUsd)} color={colorForMetric(model.outputCostPer1mUsd, ranges.outputCost, false)} />
        <Metric label="Intel" value={formatScore(model.artificialAnalysisIntelligenceIndex)} color={colorForMetric(model.artificialAnalysisIntelligenceIndex, ranges.intelligence, true)} />
        <Metric label="Code" value={formatScore(model.artificialAnalysisCodingIndex)} color={colorForMetric(model.artificialAnalysisCodingIndex, ranges.coding, true)} />
        <Metric label="Speed" value={formatScore(model.speedScore)} color={colorForMetric(model.speedScore, ranges.speed, true)} />
        <Metric label="Price" value={formatScore(model.priceScore)} color={colorForMetric(model.priceScore, ranges.price, true)} />
      </View>
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
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
  sortBar: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sortButton: { minHeight: 26, justifyContent: "center", borderRadius: 6, borderColor: "#242428", borderWidth: 1, backgroundColor: "#09090b", paddingHorizontal: 8 },
  sortButtonActive: { borderColor: "#1f4d2a", backgroundColor: "#132016" },
  sortText: { color: "#8b8b91", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  sortTextActive: { color: "#86efac" },
  list: { gap: 8 },
  loading: { color: "#a1a1aa", fontSize: 14, fontWeight: "800", padding: 14, backgroundColor: "#111113", borderRadius: 8 },
  row: { backgroundColor: "#111113", borderColor: "#29292d", borderWidth: 1, borderRadius: 8, padding: 10, gap: 8 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  rank: { width: 34, color: "#86efac", fontSize: 13, fontWeight: "900" },
  identity: { flex: 1, minWidth: 0 },
  modelName: { color: "#f4f4f5", fontSize: 15, fontWeight: "900" },
  provider: { color: "#8b8b91", fontSize: 11, fontWeight: "800", marginTop: 2 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metric: { minWidth: 86, flexBasis: "31.5%", flexGrow: 1, backgroundColor: "#09090b", borderColor: "#242428", borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 6 },
  metricValue: { color: "#e5e7eb", fontSize: 13, fontWeight: "900" },
  metricLabel: { color: "#7b8b7f", fontSize: 9, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  footnote: { color: "#6f7b72", fontSize: 10, lineHeight: 15, fontWeight: "800" },
  errorBox: { backgroundColor: "#241314", borderColor: "#7f1d1d", borderWidth: 1, borderRadius: 8, padding: 14 },
  errorTitle: { color: "#fecaca", fontSize: 16, fontWeight: "900" },
  errorText: { color: "#fca5a5", fontSize: 13, lineHeight: 18, marginTop: 4 }
});
