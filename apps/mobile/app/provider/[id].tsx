import type { ImportUsageRowInput } from "@knut/shared";
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProviderUsageRow } from "@knut/ui";
import { mockDashboard } from "@knut/shared";
import { BackButton } from "../../components/BackButton";
import { useDashboardData } from "../../hooks/useDashboardData";
import { createManualUsage, importUsage } from "../../lib/accountApi";

function todayForInput() {
  return new Date().toISOString().slice(0, 10);
}

function parseOptionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });
}

function normaliseImportRow(row: Record<string, unknown>, providerAccountId: string): ImportUsageRowInput | null {
  const observedAt = String(row.observedAt ?? row.observed_at ?? row.date ?? "");
  if (!observedAt) return null;

  return {
    providerAccountId,
    observedAt: new Date(observedAt).toISOString(),
    modelId: row.modelId || row.model_id ? String(row.modelId ?? row.model_id) : undefined,
    inputTokens: parseOptionalNumber(row.inputTokens ?? row.input_tokens),
    outputTokens: parseOptionalNumber(row.outputTokens ?? row.output_tokens),
    totalTokens: parseOptionalNumber(row.totalTokens ?? row.total_tokens),
    requestCount: parseOptionalNumber(row.requestCount ?? row.request_count),
    messageCount: parseOptionalNumber(row.messageCount ?? row.message_count),
    costAmount: parseOptionalNumber(row.costAmount ?? row.cost_amount ?? row.cost),
    costCurrency: row.costCurrency || row.cost_currency ? String(row.costCurrency ?? row.cost_currency) : "USD",
    sourceRef: row.sourceRef || row.source_ref ? String(row.sourceRef ?? row.source_ref) : undefined,
    confidence: "provider_reported"
  };
}

function parseImportText(text: string, providerAccountId: string) {
  if (!text.trim()) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map((row) => normaliseImportRow(row, providerAccountId))
      .filter((row): row is ImportUsageRowInput => Boolean(row));
  } catch {
    return parseCsv(text)
      .map((row) => normaliseImportRow(row, providerAccountId))
      .filter((row): row is ImportUsageRowInput => Boolean(row));
  }
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
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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

  const importPreview = providerAccount ? parseImportText(importText, providerAccount.id) : [];

  async function commitImport() {
    if (!providerAccount) {
      setImportMessage("Provider account is still loading. Give it a second.");
      return;
    }

    if (!importPreview.length) {
      setImportMessage("No importable rows found.");
      return;
    }

    setImporting(true);
    try {
      const result = await importUsage({
        providerAccountId: providerAccount.id,
        rows: importPreview
      });
      setImportText("");
      setImportMessage(`Imported ${result.rowsProcessed} rows. ${result.rowsFailed} failed.`);
      await dashboard.refresh();
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImporting(false);
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
          <Text style={styles.label}>CSV / JSON import</Text>
          <Text style={styles.body}>Paste rows with observed_at/date, model_id, input_tokens, output_tokens, total_tokens, cost_amount, and source_ref.</Text>
          <TextInput
            multiline
            onChangeText={setImportText}
            placeholder={"observed_at,model_id,input_tokens,output_tokens,cost_amount\n2026-05-25,gpt-4.1,1200,300,0.04"}
            placeholderTextColor="#63636a"
            style={[styles.input, styles.importBox]}
            textAlignVertical="top"
            value={importText}
          />
          <Text style={styles.message}>{importPreview.length ? `${importPreview.length} rows ready to import.` : "Paste CSV or JSON to preview rows."}</Text>
          <Pressable disabled={importing || !providerAccount || !importPreview.length} onPress={commitImport} style={({ pressed }) => [styles.saveButton, (importing || !providerAccount || !importPreview.length) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.saveButtonText}>{importing ? "Importing..." : "Import rows"}</Text>
          </Pressable>
          {importMessage ? <Text style={styles.message}>{importMessage}</Text> : null}
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
  importBox: { minHeight: 130, paddingTop: 10, lineHeight: 20 },
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
