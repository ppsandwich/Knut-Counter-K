import { useState } from "react";
import type { RecommendationBundle, RecommendationResult } from "@knut/shared";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { recommendProvider } from "../../lib/accountApi";

export default function CompareScreen() {
  const [taskType, setTaskType] = useState("Summarise a messy PDF");
  const [inputTokens, setInputTokens] = useState("12000");
  const [outputTokens, setOutputTokens] = useState("1800");
  const [recommendations, setRecommendations] = useState<RecommendationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRecommend() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await recommendProvider({
        taskType,
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
          <TextInput value={taskType} onChangeText={setTaskType} placeholder="Summarise a messy PDF" placeholderTextColor="#63636a" style={styles.input} />
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
  empty: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14 },
  emptyTitle: { color: "#f4f4f5", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, marginTop: 4 },
  errorBox: { backgroundColor: "#241314", borderColor: "#7f1d1d", borderWidth: 1, borderRadius: 8, padding: 14 },
  errorTitle: { color: "#fecaca", fontSize: 16, fontWeight: "900" },
  errorText: { color: "#fca5a5", fontSize: 13, lineHeight: 18, marginTop: 4 }
});
