import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProviderUsageRow } from "@knut/ui";
import { mockDashboard } from "@knut/shared";
import { BackButton } from "../../components/BackButton";
import { useDashboardData } from "../../hooks/useDashboardData";
import { createManualUsage } from "../../lib/accountApi";

function todayForInput() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dashboard = useDashboardData();
  const provider = dashboard.providerRows.find((item) => item.providerId === id)
    ?? mockDashboard.providers.find((item) => item.providerId === id)
    ?? mockDashboard.providers[0];
  const providerAccount = dashboard.data?.providers.find((item) => item.id === id);
  const [modelId, setModelId] = useState("");
  const [inputTokens, setInputTokens] = useState("");
  const [outputTokens, setOutputTokens] = useState("");
  const [totalTokens, setTotalTokens] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [observedDate, setObservedDate] = useState(todayForInput());
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function optionalNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function saveManualUsage() {
    if (!providerAccount) {
      setMessage("Provider account is still loading. Give it a second.");
      return;
    }

    setSaving(true);
    try {
      await createManualUsage({
        providerAccountId: providerAccount.id,
        modelId: modelId.trim() || undefined,
        inputTokens: optionalNumber(inputTokens),
        outputTokens: optionalNumber(outputTokens),
        totalTokens: optionalNumber(totalTokens),
        costAmount: optionalNumber(costAmount),
        costCurrency: "USD",
        observedAt: new Date(`${observedDate}T12:00:00.000Z`).toISOString()
      });
      setInputTokens("");
      setOutputTokens("");
      setTotalTokens("");
      setCostAmount("");
      setMessage("Manual usage saved. Dashboard totals will update on refresh.");
      await dashboard.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Usage could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton fallbackHref="/providers" />
        <Text style={styles.title}>{provider.providerName}</Text>
        <Text style={styles.subtitle}>{provider.accountDisplayName}</Text>
        <ProviderUsageRow provider={provider} />

        <View style={styles.card}>
          <Text style={styles.label}>Manual usage entry</Text>
          <TextInput autoCapitalize="none" onChangeText={setModelId} placeholder="Model ID, optional" placeholderTextColor="#63636a" style={styles.input} value={modelId} />
          <View style={styles.grid}>
            <TextInput keyboardType="number-pad" onChangeText={setInputTokens} placeholder="Input tokens" placeholderTextColor="#63636a" style={[styles.input, styles.gridInput]} value={inputTokens} />
            <TextInput keyboardType="number-pad" onChangeText={setOutputTokens} placeholder="Output tokens" placeholderTextColor="#63636a" style={[styles.input, styles.gridInput]} value={outputTokens} />
          </View>
          <View style={styles.grid}>
            <TextInput keyboardType="number-pad" onChangeText={setTotalTokens} placeholder="Total tokens" placeholderTextColor="#63636a" style={[styles.input, styles.gridInput]} value={totalTokens} />
            <TextInput keyboardType="decimal-pad" onChangeText={setCostAmount} placeholder="Cost USD" placeholderTextColor="#63636a" style={[styles.input, styles.gridInput]} value={costAmount} />
          </View>
          <TextInput autoCapitalize="none" onChangeText={setObservedDate} placeholder="YYYY-MM-DD" placeholderTextColor="#63636a" style={styles.input} value={observedDate} />
          <Pressable disabled={saving || !providerAccount} onPress={saveManualUsage} style={({ pressed }) => [styles.saveButton, (saving || !providerAccount) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save manual usage"}</Text>
          </Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Cap progress</Text>
          <Text style={styles.big}>{provider.primaryMetric}</Text>
          <Text style={styles.body}>Reset window: {provider.resetCountdown}. Confidence: {provider.confidence}.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Model breakdown</Text>
          <Text style={styles.row}>Primary model · {provider.secondaryMetric}</Text>
          <Text style={styles.row}>Pricing source · public catalogue</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Connector limitations</Text>
          <Text style={styles.body}>Consumer plans stay separate from API usage. Manual values never display as exact.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 10 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "900" },
  subtitle: { color: "#8b8b91", fontSize: 15, marginBottom: 4 },
  card: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14 },
  label: { color: "#8b8b91", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  input: { color: "#f4f4f5", backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, minHeight: 44, fontSize: 15, marginTop: 10 },
  grid: { flexDirection: "row", gap: 10 },
  gridInput: { flex: 1, minWidth: 0 },
  saveButton: { minHeight: 44, borderRadius: 7, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center", marginTop: 10 },
  saveButtonText: { color: "#041006", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  message: { color: "#a1a1aa", fontSize: 13, fontWeight: "700", marginTop: 8 },
  big: { color: "#f4f4f5", fontSize: 32, fontWeight: "900", marginTop: 8 },
  body: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, marginTop: 6 },
  row: { color: "#e4e4e7", fontSize: 15, fontWeight: "700", paddingTop: 12 }
});
