import { StyleSheet, Text, View } from "react-native";
import { confidenceLabels, formatCurrency, type Recommendation, type RecommendationResult } from "@knut/shared";
import { colors } from "./theme";

type DashboardRecommendation = Recommendation | RecommendationResult;

function providerName(recommendation: DashboardRecommendation) {
  return "recommendedProvider" in recommendation ? recommendation.recommendedProvider : recommendation.providerName;
}

function modelName(recommendation: DashboardRecommendation) {
  return "recommendedModel" in recommendation ? recommendation.recommendedModel : recommendation.modelName;
}

function confidence(recommendation: DashboardRecommendation) {
  return "confidence" in recommendation ? confidenceLabels[recommendation.confidence] : recommendation.priceConfidence;
}

function meta(recommendation: DashboardRecommendation) {
  if (!("intelligenceScore" in recommendation)) return null;
  return `${recommendation.label ?? "Balanced"} · intelligence ${recommendation.intelligenceScore}/100`;
}

export function RecommendationCard({ recommendation, loading, error }: { recommendation: DashboardRecommendation; loading?: boolean; error?: string | null }) {
  const metaText = meta(recommendation);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Next best move</Text>
        <Text style={styles.confidence}>{loading ? "Checking" : confidence(recommendation)}</Text>
      </View>
      <Text style={styles.title}>{providerName(recommendation)} · {modelName(recommendation)}</Text>
      <Text style={styles.reason}>{loading ? "Looking at your providers, prices, and cap pressure..." : error ?? recommendation.reason}</Text>
      <Text style={styles.cost}>{formatCurrency(recommendation.estimatedCostUsd)} estimated</Text>
      {metaText ? <Text style={styles.meta}>{metaText}</Text> : null}
      <Text style={styles.attribution}>Benchmarks from Artificial Analysis</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#0f1b13", borderColor: "#1f4d2a", borderWidth: 1, borderRadius: 8, padding: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  label: { color: colors.green, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  confidence: { color: "#86efac", fontSize: 11, fontWeight: "900" },
  title: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 7 },
  reason: { color: "#b7c4ba", fontSize: 14, lineHeight: 20, marginTop: 5 },
  cost: { color: "#86efac", fontSize: 13, fontWeight: "800", marginTop: 8 },
  meta: { color: "#7b8b7f", fontSize: 11, fontWeight: "900", marginTop: 8, textTransform: "uppercase" },
  attribution: { color: "#5f7064", fontSize: 10, fontWeight: "800", marginTop: 6 }
});
