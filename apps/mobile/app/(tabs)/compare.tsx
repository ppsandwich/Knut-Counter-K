import { useState } from "react";
import type { RecommendationResult } from "@knut/shared";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { recommendProvider } from "../../lib/accountApi";

export default function CompareScreen() {
  const [taskType, setTaskType] = useState("Summarise a messy PDF");
  const [inputTokens, setInputTokens] = useState("12000");
  const [outputTokens, setOutputTokens] = useState("1800");
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
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
      setRecommendation(result);
    } catch (err) {
      setRecommendation(null);
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
            <Text style={styles.buttonText}>{isLoading ? "Checking prices..." : "Find cheapest option"}</Text>
          </Pressable>
        </View>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>No clean answer yet.</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {recommendation ? (
          <View style={styles.reco}>
            <Text style={styles.kicker}>Recommended</Text>
            <Text style={styles.provider}>{recommendation.recommendedProvider}</Text>
            <Text style={styles.model}>{recommendation.recommendedModel}</Text>
            <Text style={styles.cost}>~${recommendation.estimatedCostUsd.toFixed(recommendation.estimatedCostUsd < 0.01 ? 5 : 3)}</Text>
            {recommendation.capWarning ? <Text style={styles.warning}>{recommendation.capWarning}</Text> : null}
            <Text style={styles.reason}>{recommendation.reason}</Text>
            <Text style={styles.meta}>{recommendation.priceSource} · {recommendation.priceConfidence}</Text>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ask the price table.</Text>
            <Text style={styles.emptyText}>Enter rough token counts and Knut Counter will pick from connected providers with known pricing.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  reco: { backgroundColor: "#132016", borderColor: "#1f4d2a", borderWidth: 1, borderRadius: 8, padding: 14 },
  kicker: { color: "#22c55e", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
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
