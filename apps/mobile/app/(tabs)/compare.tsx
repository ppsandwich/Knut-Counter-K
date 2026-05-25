import { useState } from "react";
import type { RecommendationBundle, RecommendationResult } from "@knut/shared";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { recommendProvider } from "../../lib/accountApi";

const taskPresets = [
  { label: "Quick question / explanation", inputTokens: 300, outputTokens: 500 },
  { label: "Summarize pasted text", inputTokens: 2500, outputTokens: 450 },
  { label: "Research synthesis / compare options", inputTokens: 3000, outputTokens: 1200 },
  { label: "Long-form writing / report draft", inputTokens: 1500, outputTokens: 2500 },
  { label: "Code help / debugging", inputTokens: 1800, outputTokens: 1200 },
  { label: "Review a pull request / diff", inputTokens: 8000, outputTokens: 1500 },
  { label: "Debug with logs and stack traces", inputTokens: 10000, outputTokens: 1800 },
  { label: "Generate tests for existing code", inputTokens: 6000, outputTokens: 2500 },
  { label: "Refactor a large file", inputTokens: 12000, outputTokens: 3000 },
  { label: "Explain a codebase area", inputTokens: 20000, outputTokens: 2500 },
  { label: "Build a simple website", inputTokens: 75000, outputTokens: 25000 },
  { label: "Build a full-stack app feature", inputTokens: 500000, outputTokens: 150000 }
];

export default function CompareScreen() {
  const [selectedTask, setSelectedTask] = useState(taskPresets[1]);
  const [inputTokens, setInputTokens] = useState(String(taskPresets[1].inputTokens));
  const [outputTokens, setOutputTokens] = useState(String(taskPresets[1].outputTokens));
  const [isTaskMenuOpen, setIsTaskMenuOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function selectTask(task: typeof taskPresets[number]) {
    setSelectedTask(task);
    setInputTokens(String(task.inputTokens));
    setOutputTokens(String(task.outputTokens));
    setIsTaskMenuOpen(false);
  }

  async function handleRecommend() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await recommendProvider({
        taskType: selectedTask.label,
        estimatedInputTokens: Number(inputTokens) || 0,
        estimatedOutputTokens: Number(outputTokens) || 0,
        excludeNearCapProviders: false
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
              <Text style={styles.selectLabel}>{selectedTask.label}</Text>
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
                      <Text style={styles.menuItemTitle}>{task.label}</Text>
                      <Text style={styles.menuItemMeta}>{task.inputTokens.toLocaleString()} input · {task.outputTokens.toLocaleString()} output</Text>
                    </View>
                    <Text style={styles.menuItemCheck}>{isSelected ? "Selected" : ""}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={styles.grid}>
            <View style={styles.field}>
              <Text style={styles.label}>Input tokens</Text>
              <TextInput value={inputTokens} onChangeText={setInputTokens} keyboardType="number-pad" style={styles.input} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Output tokens</Text>
              <TextInput value={outputTokens} onChangeText={setOutputTokens} keyboardType="number-pad" style={styles.input} />
            </View>
          </View>
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
            <Text style={styles.emptyText}>Enter rough token counts and Knut Counter will return cheapest, quality, and balanced picks from connected providers.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatCost(value: number) {
  return `~$${value.toFixed(value < 0.01 ? 5 : 3)}`;
}

function RecommendationCard({ item, tone }: { item: RecommendationResult; tone: "cheap" | "quality" | "balanced" }) {
  return (
    <View style={[styles.reco, tone === "quality" && styles.recoQuality, tone === "balanced" && styles.recoBalanced]}>
      <View style={styles.recoHeader}>
        <Text style={styles.kicker}>{item.label}</Text>
        <Text style={styles.score}>{item.intelligenceScore}/100</Text>
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
  input: { color: "#f4f4f5", backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  select: { minHeight: 58, backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectTextBlock: { flex: 1, minWidth: 0 },
  selectLabel: { color: "#f4f4f5", fontSize: 16, fontWeight: "900" },
  selectMeta: { color: "#8b8b91", fontSize: 12, fontWeight: "800", marginTop: 3 },
  selectChevron: { color: "#86efac", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  menu: { gap: 8 },
  menuItem: { minHeight: 58, borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  menuItemActive: { borderColor: "#22c55e", backgroundColor: "#102016" },
  menuItemTitle: { color: "#f4f4f5", fontSize: 14, fontWeight: "900" },
  menuItemMeta: { color: "#8b8b91", fontSize: 12, fontWeight: "800", marginTop: 3 },
  menuItemCheck: { color: "#86efac", fontSize: 12, fontWeight: "900" },
  grid: { flexDirection: "row", gap: 10 },
  field: { flex: 1, gap: 6 },
  button: { backgroundColor: "#f4f4f5", borderRadius: 7, minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 2 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#050506", fontSize: 15, fontWeight: "900" },
  results: { gap: 10 },
  reco: { backgroundColor: "#132016", borderColor: "#1f4d2a", borderWidth: 1, borderRadius: 8, padding: 14 },
  recoQuality: { backgroundColor: "#161522", borderColor: "#3b3270" },
  recoBalanced: { backgroundColor: "#191711", borderColor: "#4c3a16" },
  recoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  kicker: { color: "#22c55e", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  score: { color: "#e5e7eb", fontSize: 12, fontWeight: "900" },
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
