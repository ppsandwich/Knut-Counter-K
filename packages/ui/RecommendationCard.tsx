import { StyleSheet, Text, View } from "react-native";
import { confidenceLabels, formatCurrency, type Recommendation } from "@knut/shared";
import { colors } from "./theme";

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Next best move</Text>
        <Text style={styles.confidence}>{confidenceLabels[recommendation.confidence]}</Text>
      </View>
      <Text style={styles.title}>{recommendation.providerName} · {recommendation.modelName}</Text>
      <Text style={styles.reason}>{recommendation.reason}</Text>
      <Text style={styles.cost}>{formatCurrency(recommendation.estimatedCostUsd)} estimated</Text>
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
  cost: { color: "#86efac", fontSize: 13, fontWeight: "800", marginTop: 8 }
});
