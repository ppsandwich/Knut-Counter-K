import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import type { AppAlert } from "@knut/shared";
import { colors } from "./theme";
import { useSlideInLeft } from "./animations";

export function AlertSummary({ alerts }: { alerts: AppAlert[] }) {
  if (!alerts.length) return null;

  const topAlert = alerts[0];
  const { style: animStyle } = useSlideInLeft({ delay: 400, distance: 20 });

  return (
    <Animated.View style={[styles.panel, animStyle]}>
      <Text style={styles.label}>{alerts.length} alerts</Text>
      <Text style={styles.title}>{topAlert.title}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 5 }
});
