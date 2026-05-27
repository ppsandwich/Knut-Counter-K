import { useEffect, useState } from "react";
import type { AccountAlert } from "@knut/shared";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { FadeInView, SlideUpView, AnimatedCard, usePulse } from "@knut/ui";
import { evaluateAlerts, fetchAlerts } from "../../lib/accountApi";

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AccountAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAlerts() {
    setError(null);
    try {
      setAlerts(await fetchAlerts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load alerts.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runEvaluation() {
    setIsEvaluating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await evaluateAlerts();
      setAlerts(result.alerts);
      setMessage(result.created ? `${result.created} new alert${result.created === 1 ? "" : "s"} created.` : "No new alerts. Suspiciously peaceful.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not evaluate alerts.");
    } finally {
      setIsEvaluating(false);
    }
  }

  useEffect(() => {
    void loadAlerts();
  }, []);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeInView delay={0}>
          <View style={styles.header}>
            <Text style={styles.title}>Alerts</Text>
            <Pressable disabled={isEvaluating} onPress={runEvaluation} style={[styles.button, isEvaluating && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>{isEvaluating ? "Checking..." : "Run check"}</Text>
            </Pressable>
          </View>
        </FadeInView>
        {message ? <SlideUpView delay={100}><Text style={styles.message}>{message}</Text></SlideUpView> : null}
        {error ? (
          <AnimatedCard index={1}>
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Alert check tripped.</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </AnimatedCard>
        ) : null}
        {!isLoading && !alerts.length ? (
          <AnimatedCard index={2}>
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Everything looks boring. Excellent.</Text>
              <Text style={styles.body}>No active alerts yet. Run a check after adding usage, budgets, or synced provider data.</Text>
            </View>
          </AnimatedCard>
        ) : null}
        {isLoading ? (
          <AnimatedCard index={2}>
            <LoadingIndicator />
          </AnimatedCard>
        ) : null}
        {alerts.map((alert, index) => (
          <AnimatedCard key={alert.id} index={index + 2}>
            <View style={styles.alert}>
              <Text style={[styles.severity, alert.severity === "danger" && styles.danger, alert.severity === "info" && styles.info]}>{alert.severity}</Text>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.body}>{alert.body}</Text>
              <Text style={styles.meta}>{new Date(alert.createdAt).toLocaleString()}</Text>
            </View>
          </AnimatedCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingIndicator() {
  const { style: loadingStyle } = usePulse({ minOpacity: 0.3, maxOpacity: 0.7, duration: 1500 });

  return (
    <Animated.Text style={[styles.loading, loadingStyle]}>Loading alerts...</Animated.Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800" },
  button: { backgroundColor: "#f4f4f5", borderRadius: 7, minHeight: 38, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#050506", fontSize: 13, fontWeight: "900" },
  message: { color: "#86efac", fontSize: 13, fontWeight: "800" },
  loading: { color: "#a1a1aa", fontSize: 14 },
  alert: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14 },
  severity: { color: "#f59e0b", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  danger: { color: "#ef4444" },
  info: { color: "#60a5fa" },
  alertTitle: { color: "#f4f4f5", fontSize: 17, fontWeight: "800", marginTop: 6 },
  body: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, marginTop: 4 },
  meta: { color: "#66666d", fontSize: 11, fontWeight: "800", marginTop: 10, textTransform: "uppercase" },
  empty: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14 },
  emptyTitle: { color: "#f4f4f5", fontSize: 17, fontWeight: "900" },
  errorBox: { backgroundColor: "#241314", borderColor: "#7f1d1d", borderWidth: 1, borderRadius: 8, padding: 14 },
  errorTitle: { color: "#fecaca", fontSize: 16, fontWeight: "900" },
  errorText: { color: "#fca5a5", fontSize: 13, lineHeight: 18, marginTop: 4 }
});
