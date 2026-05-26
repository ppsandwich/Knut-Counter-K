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
  intelligence: MetricRange | null;
  coding: MetricRange | null;
  speed: MetricRange | null;
  price: MetricRange | null;
};
type SortKey = "popularity" | "inputCost" | "outputCost" | "intelligence" | "coding" | "speed" | "price";
type SortDirection = "desc" | "asc";

const metricColumns: Array<{ key: Exclude<SortKey, "popularity">; label: string; higherIsBetter: boolean }> = [
  { key: "inputCost", label: "In", higherIsBetter: false },
  { key: "outputCost", label: "Out", higherIsBetter: false },
  { key: "intelligence", label: "Intel", higherIsBetter: true },
  { key: "coding", label: "Code", higherIsBetter: true },
  { key: "speed", label: "Speed", higherIsBetter: true },
  { key: "price", label: "Price", higherIsBetter: true }
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
    intelligence: rangeFor(models, (model) => model.artificialAnalysisIntelligenceIndex),
    coding: rangeFor(models, (model) => model.artificialAnalysisCodingIndex),
    speed: rangeFor(models, (model) => model.speedScore),
    price: rangeFor(models, (model) => model.priceScore)
  };
}

function valueForSort(model: PopularModel, sortKey: SortKey) {
  if (sortKey === "popularity") return model.weeklyTokens;
  if (sortKey === "inputCost") return model.inputCostPer1mUsd;
  if (sortKey === "outputCost") return model.outputCostPer1mUsd;
  if (sortKey === "intelligence") return model.artificialAnalysisIntelligenceIndex;
  if (sortKey === "coding") return model.artificialAnalysisCodingIndex;
  if (sortKey === "speed") return model.speedScore;
  return model.priceScore;
}

function valueForMetric(model: PopularModel, metric: Exclude<SortKey, "popularity">) {
  return valueForSort(model, metric);
}

function formatMetric(model: PopularModel, metric: Exclude<SortKey, "popularity">) {
  if (metric === "inputCost") return formatCost(model.inputCostPer1mUsd);
  if (metric === "outputCost") return formatCost(model.outputCostPer1mUsd);
  if (metric === "intelligence") return formatScore(model.artificialAnalysisIntelligenceIndex);
  if (metric === "coding") return formatScore(model.artificialAnalysisCodingIndex);
  if (metric === "speed") return formatScore(model.speedScore);
  return formatScore(model.priceScore);
}

function rangeForMetric(ranges: MetricRanges, metric: Exclude<SortKey, "popularity">) {
  if (metric === "inputCost") return ranges.inputCost;
  if (metric === "outputCost") return ranges.outputCost;
  if (metric === "intelligence") return ranges.intelligence;
  if (metric === "coding") return ranges.coding;
  if (metric === "speed") return ranges.speed;
  return ranges.price;
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

function MetricHeader({ sortKey, sortDirection, onChangeSort }: { sortKey: SortKey; sortDirection: SortDirection; onChangeSort: (sortKey: SortKey) => void }) {
  return (
    <View style={styles.metricHeader}>
      {metricColumns.map((column) => {
        const isActive = sortKey === column.key;
        return (
          <Pressable key={column.key} onPress={() => onChangeSort(column.key)} style={[styles.headerCell, isActive && styles.headerCellActive]}>
            <Text style={[styles.headerCellText, isActive && styles.headerCellTextActive]}>
              {column.label}{isActive ? sortDirection === "desc" ? " v" : " ^" : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ModelsTableScreen() {
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
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[error ? 2 : 1]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Models Table</Text>
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

        <View style={styles.stickyTableHeader}>
          <MetricHeader sortKey={sortKey} sortDirection={sortDirection} onChangeSort={changeSort} />
        </View>

        <View style={styles.tableBody}>
          {isLoading && !payload ? (
            <Text style={styles.loading}>Loading model rankings...</Text>
          ) : payload && ranges ? (
            visibleModels.map((model) => <ModelGroup key={`${model.rank}:${model.modelId}`} model={model} ranges={ranges} />)
          ) : null}
        </View>

        <Text style={styles.footnote}>
          Sources: OpenRouter weekly rankings and models API; Artificial Analysis benchmark snapshots and public model catalogue. Metric colors are normalized within this top-50 list.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModelGroup({ model, ranges }: { model: PopularModel; ranges: MetricRanges }) {
  return (
    <View style={styles.group}>
      <View style={styles.modelInfoRow}>
        <Text style={styles.modelName} numberOfLines={1}>#{model.rank} {model.modelName}</Text>
        <Text style={styles.modelMeta} numberOfLines={1}>
          {model.provider} / age {formatAge(model.ageDays)} / {formatWeeklyTokens(model.weeklyTokens)} tokens/wk
        </Text>
      </View>
      <View style={styles.metricRow}>
        {metricColumns.map((column) => {
          const value = valueForMetric(model, column.key);
          return (
            <View key={column.key} style={styles.metricCell}>
              <Text style={[styles.metricValue, { color: colorForMetric(value, rangeForMetric(ranges, column.key), column.higherIsBetter) }]}>
                {formatMetric(model, column.key)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800" },
  subtitle: { color: "#a1a1aa", fontSize: 12, fontWeight: "800", marginTop: 2, textTransform: "uppercase" },
  refreshButton: { minHeight: 38, justifyContent: "center", borderRadius: 7, backgroundColor: "#f4f4f5", paddingHorizontal: 12 },
  refreshText: { color: "#050506", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  stickyTableHeader: { borderColor: "#29292d", borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8, overflow: "hidden", backgroundColor: "#09090b", zIndex: 10, elevation: 10 },
  tableBody: { borderColor: "#29292d", borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: "hidden", backgroundColor: "#0c0c0e" },
  metricHeader: { flexDirection: "row", backgroundColor: "#09090b", borderBottomColor: "#29292d", borderBottomWidth: 1 },
  headerCell: { flex: 1, minHeight: 30, alignItems: "center", justifyContent: "center", borderRightColor: "#242428", borderRightWidth: 1, paddingHorizontal: 2 },
  headerCellActive: { backgroundColor: "#132016" },
  headerCellText: { color: "#8b8b91", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  headerCellTextActive: { color: "#86efac" },
  loading: { color: "#a1a1aa", fontSize: 14, fontWeight: "800", padding: 14 },
  group: { borderBottomColor: "#242428", borderBottomWidth: 1 },
  modelInfoRow: { minHeight: 44, justifyContent: "center", paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#171719" },
  modelName: { color: "#f4f4f5", fontSize: 13, fontWeight: "900" },
  modelMeta: { color: "#8b8b91", fontSize: 10, fontWeight: "800", marginTop: 2 },
  metricRow: { flexDirection: "row", minHeight: 30, backgroundColor: "#09090b" },
  metricCell: { flex: 1, alignItems: "center", justifyContent: "center", borderRightColor: "#1f1f23", borderRightWidth: 1, paddingHorizontal: 2 },
  metricValue: { color: "#e5e7eb", fontSize: 11, fontWeight: "900" },
  footnote: { color: "#6f7b72", fontSize: 10, lineHeight: 15, fontWeight: "800", marginTop: 12 },
  errorBox: { backgroundColor: "#241314", borderColor: "#7f1d1d", borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12 },
  errorTitle: { color: "#fecaca", fontSize: 16, fontWeight: "900" },
  errorText: { color: "#fca5a5", fontSize: 13, lineHeight: 18, marginTop: 4 }
});
