import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from "react-native-reanimated";
import { formatCurrency, type DashboardSummary } from "@knut/shared";
import { colors } from "./theme";
import { useSlideUp } from "./animations";

function HorizontalBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

function getUsageColor(percent: number): string {
  if (percent >= 90) return colors.red;
  if (percent >= 70) return colors.orange;
  return colors.green;
}

export function MonthlyDamageCard({ summary, refreshing = false }: { summary: DashboardSummary; refreshing?: boolean }) {
  const currency = summary.currency ?? "USD";
  const budgetPercent = summary.monthlyBudget > 0
    ? Math.min(100, Math.round((summary.monthlySpend / summary.monthlyBudget) * 10000) / 100)
    : null;
  const subAvg = summary.subscriptionUsageAvg;

  const { style: cardStyle } = useSlideUp({ delay: 100, distance: 20 });

  const refreshOpacity = useSharedValue(1);
  const refreshStyle = useAnimatedStyle(() => ({
    opacity: refreshOpacity.value,
  }));

  useEffect(() => {
    if (refreshing) {
      refreshOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      );
    } else {
      refreshOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [refreshing, refreshOpacity]);

  const spendLabel = subAvg != null
    ? `${formatCurrency(summary.monthlySpend, currency)} / ${subAvg}%`
    : formatCurrency(summary.monthlySpend, currency);

  return (
    <Animated.View style={[styles.card, cardStyle, refreshStyle]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>This month's AI usage</Text>
        {refreshing ? <Text style={styles.syncing}>syncing</Text> : null}
      </View>
      <View style={styles.moneyRow}>
        <Text style={styles.amount}>{spendLabel}</Text>
      </View>
      <View style={styles.bars}>
        {budgetPercent != null && (
          <HorizontalBar percent={budgetPercent} color={getUsageColor(budgetPercent)} />
        )}
        {subAvg != null && (
          <HorizontalBar percent={subAvg} color={getUsageColor(subAvg)} />
        )}
      </View>
      {summary.statusText ? <Text style={styles.status}>{summary.statusText}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panelAlt, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  syncing: { color: colors.green, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  moneyRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 },
  amount: { color: colors.text, fontSize: 38, fontWeight: "900" },
  bars: { gap: 6, marginTop: 10 },
  barTrack: { height: 10, backgroundColor: "#27272a", borderRadius: 5, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5 },
  status: { color: colors.orange, fontSize: 13, fontWeight: "800", marginTop: 10 }
});
