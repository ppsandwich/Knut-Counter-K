import { useRef, useState } from "react";
import type { RecommendationBundle, RecommendationResult } from "@knut/shared";
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { recommendProvider } from "../../lib/accountApi";

const taskPresets = [
  { label: "Quick question / explanation", inputTokens: 300, outputTokens: 500, benchmarkType: "General" },
  { label: "Summarize pasted text", inputTokens: 2500, outputTokens: 450, benchmarkType: "Summarising" },
  { label: "Research synthesis / compare options", inputTokens: 3000, outputTokens: 1200, benchmarkType: "Analysis" },
  { label: "Long-form writing / report draft", inputTokens: 1500, outputTokens: 2500, benchmarkType: "Writing" },
  { label: "Code help / debugging", inputTokens: 1800, outputTokens: 1200, benchmarkType: "Coding" },
  { label: "Review a pull request / diff", inputTokens: 8000, outputTokens: 1500, benchmarkType: "Coding" },
  { label: "Debug with logs and stack traces", inputTokens: 10000, outputTokens: 1800, benchmarkType: "Coding" },
  { label: "Generate tests for existing code", inputTokens: 6000, outputTokens: 2500, benchmarkType: "Coding" },
  { label: "Refactor a large file", inputTokens: 12000, outputTokens: 3000, benchmarkType: "Coding" },
  { label: "Explain a codebase area", inputTokens: 20000, outputTokens: 2500, benchmarkType: "Coding" },
  { label: "Build a simple website", inputTokens: 75000, outputTokens: 25000, benchmarkType: "Coding" },
  { label: "Build a full-stack app feature", inputTokens: 500000, outputTokens: 150000, benchmarkType: "Coding" },
  { label: "Build a small app from scratch", inputTokens: 650000, outputTokens: 220000, benchmarkType: "Coding" },
  { label: "Implement a large product feature", inputTokens: 800000, outputTokens: 250000, benchmarkType: "Coding" },
  { label: "Migrate or modernize a codebase", inputTokens: 900000, outputTokens: 300000, benchmarkType: "Coding" },
  { label: "Audit and refactor a large codebase", inputTokens: 1000000, outputTokens: 250000, benchmarkType: "Coding" },
  { label: "Build a production web app", inputTokens: 1000000, outputTokens: 400000, benchmarkType: "Coding" }
];

export default function CompareScreen() {
  const [selectedTask, setSelectedTask] = useState(taskPresets[1]);
  const [qualityPreference, setQualityPreference] = useState(0.5);
  const [isTaskMenuOpen, setIsTaskMenuOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function selectTask(task: typeof taskPresets[number]) {
    setSelectedTask(task);
    setIsTaskMenuOpen(false);
  }

  async function handleRecommend() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await recommendProvider({
        taskType: selectedTask.label,
        estimatedInputTokens: selectedTask.inputTokens,
        estimatedOutputTokens: selectedTask.outputTokens,
        excludeNearCapProviders: false,
        qualityPreference
      });
      setRecommendations(result);
    } catch (err) {
      setRecommendations(null);
      setError(err instanceof Error ? err.message : "Could not calculate a recommendation.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Compare</Text>
        <View style={styles.panel}>
          <Text style={styles.label}>Task</Text>
          <Pressable onPress={() => setIsTaskMenuOpen((value) => !value)} style={styles.select}>
            <View style={styles.selectTextBlock}>
              <View style={styles.taskTitleRow}>
                <Text style={styles.selectLabel}>{selectedTask.label}</Text>
                <BenchmarkTag label={selectedTask.benchmarkType} />
              </View>
              <Text style={styles.selectMeta}>{selectedTask.inputTokens.toLocaleString()} in · {selectedTask.outputTokens.toLocaleString()} out</Text>
            </View>
            <Text style={styles.selectChevron}>{isTaskMenuOpen ? "Close" : "Choose"}</Text>
          </Pressable>
          {isTaskMenuOpen ? (
            <View style={styles.menu}>
              {taskPresets.map((task) => {
                const isSelected = task.label === selectedTask.label;
                return (
                  <Pressable key={task.label} onPress={() => selectTask(task)} style={[styles.menuItem, isSelected && styles.menuItemActive]}>
                    <View style={styles.selectTextBlock}>
                      <View style={styles.taskTitleRow}>
                        <Text style={styles.menuItemTitle}>{task.label}</Text>
                        <BenchmarkTag label={task.benchmarkType} />
                      </View>
                      <Text style={styles.menuItemMeta}>{task.inputTokens.toLocaleString()} input · {task.outputTokens.toLocaleString()} output</Text>
                    </View>
                    <Text style={styles.menuItemCheck}>{isSelected ? "Selected" : ""}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <PreferenceSlider value={qualityPreference} onChange={setQualityPreference} />
          <Pressable disabled={isLoading} onPress={handleRecommend} style={[styles.button, isLoading && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>{isLoading ? "Checking prices..." : "Compare options"}</Text>
          </Pressable>
        </View>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>No clean answer yet.</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {recommendations ? (
          <View style={styles.results}>
            <RecommendationCard item={recommendations.cheapest} tone="cheap" />
            <RecommendationCard item={recommendations.quality} tone="quality" />
            <RecommendationCard item={recommendations.balanced} tone="balanced" />
            <Text style={styles.attribution}>Benchmarks from Artificial Analysis</Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ask the price table.</Text>
            <Text style={styles.emptyText}>Choose a task and preference, then Knut Counter will return cheapest, quality, and balanced picks from connected providers.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatCost(value: number) {
  return `~$${value.toFixed(value < 0.01 ? 5 : 3)}`;
}

function BenchmarkTag({ label }: { label: string }) {
  return (
    <View style={styles.benchmarkTag}>
      <Text style={styles.benchmarkTagText}>{label}</Text>
    </View>
  );
}

function PreferenceSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(1);

  function updateValue(locationX: number) {
    onChange(Math.min(1, Math.max(0, locationX / trackWidth)));
  }

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => updateValue(event.nativeEvent.locationX),
    onPanResponderMove: (event) => updateValue(event.nativeEvent.locationX)
  })).current;

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>Cost</Text>
        <Text style={styles.sliderLabel}>Quality</Text>
      </View>
      <View
        {...panResponder.panHandlers}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
        style={styles.sliderTrack}
      >
        <View style={styles.sliderRail} />
        <View style={[styles.sliderFill, { width: `${value * 100}%` }]} />
        <View style={[styles.sliderThumb, { left: `${value * 100}%` }]} />
      </View>
    </View>
  );
}

function RecommendationCard({ item, tone }: { item: RecommendationResult; tone: "cheap" | "quality" | "balanced" }) {
  const benchmarkLabel = item.intelligenceBenchmark
    ? `${item.intelligenceBenchmark} benchmark`
    : `${item.intelligenceSource} intelligence`;

  return (
    <View style={[styles.reco, tone === "quality" && styles.recoQuality, tone === "balanced" && styles.recoBalanced]}>
      <View style={styles.recoHeader}>
        <Text style={styles.kicker}>{item.label}</Text>
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>{item.intelligenceScore}/100</Text>
          <Text style={styles.scoreMeta}>{benchmarkLabel}</Text>
        </View>
      </View>
      <Text style={styles.provider}>{item.recommendedProvider}</Text>
      <Text style={styles.model}>{item.recommendedModel}</Text>
      <Text style={styles.cost}>{formatCost(item.estimatedCostUsd)}</Text>
      {item.capWarning ? <Text style={styles.warning}>{item.capWarning}</Text> : null}
      <Text style={styles.reason}>{item.reason}</Text>
      <Text style={styles.meta}>{item.priceSource} · {item.priceConfidence} · intelligence {item.intelligenceSource}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 12 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800" },
  panel: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  label: { color: "#8b8b91", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  select: { minHeight: 58, backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectTextBlock: { flex: 1, minWidth: 0 },
  taskTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  selectLabel: { color: "#f4f4f5", fontSize: 16, fontWeight: "900", flexShrink: 1 },
  selectMeta: { color: "#8b8b91", fontSize: 12, fontWeight: "800", marginTop: 3 },
  selectChevron: { color: "#86efac", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  benchmarkTag: { borderColor: "#2f3d34", borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "#111a14" },
  benchmarkTagText: { color: "#93a99a", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  menu: { gap: 8 },
  menuItem: { minHeight: 58, borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  menuItemActive: { borderColor: "#22c55e", backgroundColor: "#102016" },
  menuItemTitle: { color: "#f4f4f5", fontSize: 14, fontWeight: "900", flexShrink: 1 },
  menuItemMeta: { color: "#8b8b91", fontSize: 12, fontWeight: "800", marginTop: 3 },
  menuItemCheck: { color: "#86efac", fontSize: 12, fontWeight: "900" },
  sliderBlock: { gap: 8, paddingVertical: 2 },
  sliderLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sliderLabel: { color: "#a1a1aa", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  sliderTrack: { height: 34, justifyContent: "center" },
  sliderRail: { position: "absolute", left: 0, right: 0, height: 6, borderRadius: 6, backgroundColor: "#29292d" },
  sliderFill: { position: "absolute", left: 0, height: 6, borderRadius: 6, backgroundColor: "#22c55e" },
  sliderThumb: { position: "absolute", width: 22, height: 22, marginLeft: -11, borderRadius: 11, backgroundColor: "#f4f4f5", borderColor: "#22c55e", borderWidth: 3 },
  button: { backgroundColor: "#f4f4f5", borderRadius: 7, minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 2 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#050506", fontSize: 15, fontWeight: "900" },
  results: { gap: 10 },
  reco: { backgroundColor: "#132016", borderColor: "#1f4d2a", borderWidth: 1, borderRadius: 8, padding: 14 },
  recoQuality: { backgroundColor: "#161522", borderColor: "#3b3270" },
  recoBalanced: { backgroundColor: "#191711", borderColor: "#4c3a16" },
  recoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  kicker: { color: "#22c55e", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  scoreBlock: { alignItems: "flex-end", flexShrink: 0 },
  score: { color: "#e5e7eb", fontSize: 12, fontWeight: "900" },
  scoreMeta: { color: "#7b8b7f", fontSize: 10, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  provider: { color: "#c8f7d2", fontSize: 14, fontWeight: "800", marginTop: 6 },
  model: { color: "#f4f4f5", fontSize: 22, fontWeight: "900", marginTop: 2 },
  cost: { color: "#86efac", fontSize: 30, fontWeight: "900", marginTop: 4 },
  warning: { color: "#fbbf24", fontSize: 13, lineHeight: 18, marginTop: 4, fontWeight: "800" },
  reason: { color: "#b7c4ba", fontSize: 14, lineHeight: 20, marginTop: 6 },
  meta: { color: "#7b8b7f", fontSize: 12, fontWeight: "800", marginTop: 10, textTransform: "uppercase" },
  attribution: { color: "#5f7064", fontSize: 10, fontWeight: "800", marginTop: -2 },
  empty: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14 },
  emptyTitle: { color: "#f4f4f5", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, marginTop: 4 },
  errorBox: { backgroundColor: "#241314", borderColor: "#7f1d1d", borderWidth: 1, borderRadius: 8, padding: 14 },
  errorTitle: { color: "#fecaca", fontSize: 16, fontWeight: "900" },
  errorText: { color: "#fca5a5", fontSize: 13, lineHeight: 18, marginTop: 4 }
});
