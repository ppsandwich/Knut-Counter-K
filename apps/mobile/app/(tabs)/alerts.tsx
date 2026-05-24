import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { mockDashboard } from "@knut/shared/mockData";

export default function AlertsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Alerts</Text>
        {mockDashboard.alerts.map((alert) => (
          <View key={alert.id} style={styles.alert}>
            <Text style={[styles.severity, alert.severity === "danger" && styles.danger]}>{alert.severity}</Text>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.body}>{alert.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 10 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800", marginBottom: 4 },
  alert: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14 },
  severity: { color: "#f59e0b", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  danger: { color: "#ef4444" },
  alertTitle: { color: "#f4f4f5", fontSize: 17, fontWeight: "800", marginTop: 6 },
  body: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, marginTop: 4 }
});
