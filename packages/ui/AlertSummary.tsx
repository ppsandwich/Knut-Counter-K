import { StyleSheet, Text, View } from "react-native";
import type { AppAlert } from "@knut/shared";
import { colors } from "./theme";

export function AlertSummary({ alerts }: { alerts: AppAlert[] }) {
  const topAlert = alerts[0];
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{alerts.length} alerts</Text>
      <Text style={styles.title}>{topAlert?.title ?? "Everything looks boring. Excellent."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 5 }
});
