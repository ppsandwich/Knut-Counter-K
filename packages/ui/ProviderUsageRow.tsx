import { forwardRef, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from "react-native-reanimated";
import { confidenceLabels, formatCompactNumber, type ProviderUsageSummary } from "@knut/shared";
import { Sparkline } from "./Sparkline";
import { StatusBadge } from "./StatusBadge";
import { colors } from "./theme";
import { useStaggeredAnimation, usePressScale } from "./animations";

const lineColors = {
  healthy: colors.green,
  warning: colors.orange,
  danger: colors.red,
  stale: colors.muted
};

function HorizontalBar({ percent, color, trackColor }: { percent: number; color: string; trackColor?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View style={[styles.barTrack, trackColor != null && { backgroundColor: trackColor }]}>
      <View style={[styles.barFill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

function ModelMetricsGrid({ metrics }: { metrics: NonNullable<ProviderUsageSummary["modelMetrics"]> }) {
  return (
    <View style={styles.modelGrid}>
      {metrics.map((m, i) => (
        <View key={i} style={styles.modelItem}>
          <Text style={[styles.modelValue, m.exhausted && styles.modelExhausted]} numberOfLines={1}>{m.value}</Text>
          <Text style={styles.modelLabel} numberOfLines={1}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

function getUsageColor(percent: number): string {
  if (percent >= 90) return colors.red;
  if (percent >= 70) return colors.orange;
  return colors.green;
}

export const ProviderUsageRow = forwardRef<View, { provider: ProviderUsageSummary; onPress?: () => void; index?: number; refreshing?: boolean }>(
  function ProviderUsageRow({ provider, onPress, index = 0, refreshing = false }, ref) {
    const { style: animStyle } = useStaggeredAnimation(index, { staggerDelay: 60, baseDelay: 200 });
    const { style: pressStyle, onPressIn, onPressOut } = usePressScale(0.98);

    const refreshOpacity = useSharedValue(1);
    const refreshStyle = useAnimatedStyle(() => ({
      opacity: refreshOpacity.value,
    }));

    useEffect(() => {
      if (refreshing) {
        refreshOpacity.value = withRepeat(
          withSequence(
            withTiming(0.7, { duration: 500, easing: Easing.inOut(Easing.quad) }),
            withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) })
          ),
          -1,
          true
        );
      } else {
        refreshOpacity.value = withTiming(1, { duration: 200 });
      }
    }, [refreshing, refreshOpacity]);

    const isSubscription = provider.usedPercent != null;

    return (
      <Animated.View style={[animStyle, pressStyle, refreshStyle]}>
        <Pressable
          ref={ref}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={({ pressed }) => [styles.row, isSubscription && styles.rowSubscription, pressed && styles.pressed]}
        >
          <View style={styles.left}>
            <Text style={styles.name} numberOfLines={1}>{provider.providerName}</Text>
            <Text style={styles.account} numberOfLines={1}>{provider.accountDisplayName}</Text>
            <Text style={styles.confidence} numberOfLines={1}>{confidenceLabels[provider.confidence]}</Text>
          </View>
          {isSubscription ? (
            <>
              <View style={styles.bars}>
                <HorizontalBar percent={provider.usedPercent!} color={getUsageColor(provider.usedPercent!)} />
                <HorizontalBar percent={provider.resetProgress ?? 0} color={colors.blue} trackColor="rgba(56,189,248,0.12)" />
                {provider.tokenQuotaUsed != null && provider.tokenQuotaCap != null && (
                  <Text style={styles.quotaText} numberOfLines={1}>
                    {formatCompactNumber(provider.tokenQuotaUsed)} of {formatCompactNumber(provider.tokenQuotaCap)} tokens{provider.resetDaysLeft != null ? `, resets in ${provider.resetDaysLeft} days` : ""}
                  </Text>
                )}
              </View>
              <View style={styles.right}>
                <Text style={styles.metric} numberOfLines={1}>{provider.usedPercent!.toFixed(1)}%</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.spark}>
                {provider.modelMetrics?.length ? (
                  <ModelMetricsGrid metrics={provider.modelMetrics} />
                ) : (
                  <>
                    <Sparkline values={provider.sparklineData} color={lineColors[provider.status]} />
                    <Text style={styles.windowMetrics} numberOfLines={1}>{provider.last24hMetric ?? "24h --"} · {provider.last7dMetric ?? "7d --"}</Text>
                  </>
                )}
              </View>
              <View style={styles.right}>
                <Text style={styles.metric} numberOfLines={1}>{provider.primaryMetric}</Text>
                <StatusBadge label={provider.statusBadge} status={provider.status} />
                <Text style={styles.reset} numberOfLines={1}>{provider.resetCountdown}</Text>
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
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
  rowSubscription: {
    minHeight: 82,
    maxHeight: 100,
    gap: 12
  },
  pressed: { opacity: 0.78 },
  left: { flex: 1.1, minWidth: 0 },
  spark: { width: 108, alignItems: "center", gap: 4 },
  bars: { flex: 1, gap: 6, justifyContent: "center" },
  right: { width: 82, alignItems: "flex-end", gap: 4 },
  name: { color: colors.text, fontSize: 17, fontWeight: "900" },
  account: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 4 },
  confidence: { color: colors.dim, fontSize: 11, fontWeight: "800", marginTop: 6 },
  windowMetrics: { color: colors.dim, fontSize: 10, fontWeight: "800", textAlign: "center" },
  metric: { color: colors.text, fontSize: 18, fontWeight: "900", textAlign: "right" },
  reset: { color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "right" },
  barTrack: {
    height: 10,
    backgroundColor: colors.panelAlt,
    borderRadius: 5,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    borderRadius: 5
  },
  quotaText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2
  },
  modelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2, justifyContent: "center", alignItems: "center" },
  modelItem: { alignItems: "center", minWidth: 32 },
  modelValue: { color: colors.green, fontSize: 11, fontWeight: "900" },
  modelExhausted: { color: colors.red },
  modelLabel: { color: colors.dim, fontSize: 8, fontWeight: "700", textAlign: "center" }
});
