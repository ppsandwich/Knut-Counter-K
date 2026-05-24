import { StyleSheet, Text } from "react-native";
import type { ProviderStatus } from "@knut/shared";
import { colors } from "./theme";

const statusColor: Record<ProviderStatus, string> = {
  healthy: colors.green,
  warning: colors.orange,
  danger: colors.red,
  stale: colors.muted
};

export function StatusBadge({ label, status }: { label: string; status: ProviderStatus }) {
  return <Text style={[styles.badge, { color: statusColor[status] }]} numberOfLines={1}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: { fontSize: 12, fontWeight: "900", textAlign: "right" }
});
