import { StyleSheet, Text, View } from "react-native";
import { formatCompactNumber, formatCurrency, type DashboardSummary } from "@knut/shared";
import { colors } from "./theme";

export function MonthlyDamageCard({ summary }: { summary: DashboardSummary }) {
  const progress = summary.monthlyBudget > 0 ? Math.min(summary.monthlySpend / summary.monthlyBudget, 1) : 0;
  const currency = summary.currency ?? "USD";

  return (
    <View style={styles.card}>
      <Text style={styles.label}>This month's AI usage</Text>
      <View style={styles.moneyRow}>
        <Text style={styles.amount}>{formatCurrency(summary.monthlySpend, currency)}</Text>
        <Text style={styles.projected}>{formatCurrency(summary.projectedSpend, currency)} projected</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.status}>{summary.statusText}</Text>
        <Text style={styles.tokens}>{formatCompactNumber(summary.totalTokens)} tokens</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panelAlt, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  moneyRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 },
  amount: { color: colors.text, fontSize: 38, fontWeight: "900" },
  projected: { color: colors.muted, fontSize: 12, fontWeight: "800", paddingBottom: 7 },
  progressTrack: { height: 8, backgroundColor: "#27272a", borderRadius: 99, overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", backgroundColor: colors.orange, borderRadius: 99 },
  footer: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 10 },
  status: { color: colors.orange, fontSize: 13, fontWeight: "800", flex: 1 },
  tokens: { color: colors.muted, fontSize: 13, fontWeight: "700" }
});
