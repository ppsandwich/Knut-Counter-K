import { forwardRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { confidenceLabels, type ProviderUsageSummary } from "@knut/shared";
import { Sparkline } from "./Sparkline";
import { StatusBadge } from "./StatusBadge";
import { colors } from "./theme";

const lineColors = {
  healthy: colors.green,
  warning: colors.orange,
  danger: colors.red,
  stale: colors.muted
};

export const ProviderUsageRow = forwardRef<View, { provider: ProviderUsageSummary; onPress?: () => void }>(
  function ProviderUsageRow({ provider, onPress }, ref) {
    return (
      <Pressable ref={ref} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.left}>
          <Text style={styles.name} numberOfLines={1}>{provider.providerName}</Text>
          <Text style={styles.account} numberOfLines={1}>{provider.accountDisplayName}</Text>
          <Text style={styles.confidence} numberOfLines={1}>{confidenceLabels[provider.confidence]}</Text>
        </View>
        <View style={styles.spark}>
          <Sparkline values={provider.sparklineData} color={lineColors[provider.status]} />
          <Text style={styles.windowMetrics} numberOfLines={1}>{provider.last24hMetric ?? "24h --"} · {provider.last7dMetric ?? "7d --"}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.metric} numberOfLines={1}>{provider.primaryMetric}</Text>
          <StatusBadge label={provider.statusBadge} status={provider.status} />
          <Text style={styles.reset} numberOfLines={1}>{provider.resetCountdown}</Text>
        </View>
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  row: {
    minHeight: 86,
    maxHeight: 112,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  pressed: { opacity: 0.78 },
  left: { flex: 1.1, minWidth: 0 },
  spark: { width: 108, alignItems: "center", gap: 4 },
  right: { width: 82, alignItems: "flex-end", gap: 4 },
  name: { color: colors.text, fontSize: 17, fontWeight: "900" },
  account: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 4 },
  confidence: { color: colors.dim, fontSize: 11, fontWeight: "800", marginTop: 6 },
  windowMetrics: { color: colors.dim, fontSize: 10, fontWeight: "800", textAlign: "center" },
  metric: { color: colors.text, fontSize: 18, fontWeight: "900", textAlign: "right" },
  reset: { color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "right" }
});
