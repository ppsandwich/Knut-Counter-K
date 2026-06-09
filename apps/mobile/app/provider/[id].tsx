import type { ImportUsageRowInput } from "@knut/shared";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProviderUsageRow } from "@knut/ui";
import { mockDashboard } from "@knut/shared";
import { BackButton } from "../../components/BackButton";
import { useDashboardData } from "../../hooks/useDashboardData";
import { createManualUsage, deleteAccountProvider, importDeepSeekResponses, importOpenRouterGenerations, importUsage, importXaiResponses, removeProviderCredentials, updateAccountProvider } from "../../lib/accountApi";
import { blurActiveElement } from "../../lib/focus";

const COOKIE_SOURCE_URLS: Record<string, string> = {
  xiaomimimo: "https://platform.xiaomimimo.com/console/plan-manage",
  chatgpt_plus: "https://chatgpt.com/codex/cloud/settings/analytics"
};

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
  const router = useRouter();
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
  const [generationIdsText, setGenerationIdsText] = useState("");
  const [generationImportMessage, setGenerationImportMessage] = useState<string | null>(null);
  const [generationImporting, setGenerationImporting] = useState(false);
  const [xaiResponseText, setXaiResponseText] = useState("");
  const [xaiImportMessage, setXaiImportMessage] = useState<string | null>(null);
  const [xaiImporting, setXaiImporting] = useState(false);
  const [deepSeekResponseText, setDeepSeekResponseText] = useState("");
  const [deepSeekImportMessage, setDeepSeekImportMessage] = useState<string | null>(null);
  const [deepSeekImporting, setDeepSeekImporting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [planName, setPlanName] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [resetRule, setResetRule] = useState("");
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [credentialsRemoving, setCredentialsRemoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newCredential, setNewCredential] = useState("");
  const [credentialSaving, setCredentialSaving] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!providerAccount) return;
    setDisplayName(providerAccount.displayName);
    setPlanName(providerAccount.planName ?? "");
    setMonthlyBudget(providerAccount.monthlyBudget == null ? "" : String(providerAccount.monthlyBudget));
    setResetRule(providerAccount.resetRule ?? "");
  }, [providerAccount?.id]);

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

  function parseGenerationIds(text: string) {
    return text
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function importGenerations() {
    if (!providerAccount) {
      setGenerationImportMessage("Provider account is still loading. Give it a second.");
      return;
    }

    const generationIds = parseGenerationIds(generationIdsText);
    if (!generationIds.length) {
      setGenerationImportMessage("Paste at least one OpenRouter generation ID.");
      return;
    }

    setGenerationImporting(true);
    try {
      const result = await importOpenRouterGenerations({
        providerAccountId: providerAccount.id,
        generationIds
      });
      setGenerationIdsText("");
      setGenerationImportMessage(`Imported ${result.rowsProcessed} generations. ${result.rowsFailed} failed.`);
      await dashboard.refresh();
    } catch (error) {
      setGenerationImportMessage(error instanceof Error ? error.message : "Generation import failed.");
    } finally {
      setGenerationImporting(false);
    }
  }

  function parseXaiResponses(text: string) {
    if (!text.trim()) return [];

    try {
      const parsed = JSON.parse(text) as unknown;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as unknown);
    }
  }

  let xaiResponsePreview = 0;
  try {
    xaiResponsePreview = parseXaiResponses(xaiResponseText).length;
  } catch {
    xaiResponsePreview = 0;
  }

  async function importXaiResponsePayloads() {
    if (!providerAccount) {
      setXaiImportMessage("Provider account is still loading. Give it a second.");
      return;
    }

    let responsePayloads: unknown[] = [];
    try {
      responsePayloads = parseXaiResponses(xaiResponseText);
    } catch {
      setXaiImportMessage("That does not look like valid JSON yet.");
      return;
    }

    if (!responsePayloads.length) {
      setXaiImportMessage("Paste at least one xAI response JSON object.");
      return;
    }

    setXaiImporting(true);
    try {
      const result = await importXaiResponses({
        providerAccountId: providerAccount.id,
        responsePayloads
      });
      setXaiResponseText("");
      setXaiImportMessage(`Imported ${result.rowsProcessed} xAI responses. ${result.rowsFailed} failed.`);
      await dashboard.refresh();
    } catch (error) {
      setXaiImportMessage(error instanceof Error ? error.message : "xAI response import failed.");
    } finally {
      setXaiImporting(false);
    }
  }

  let deepSeekResponsePreview = 0;
  try {
    deepSeekResponsePreview = parseXaiResponses(deepSeekResponseText).length;
  } catch {
    deepSeekResponsePreview = 0;
  }

  async function importDeepSeekResponsePayloads() {
    if (!providerAccount) {
      setDeepSeekImportMessage("Provider account is still loading. Give it a second.");
      return;
    }

    let responsePayloads: unknown[] = [];
    try {
      responsePayloads = parseXaiResponses(deepSeekResponseText);
    } catch {
      setDeepSeekImportMessage("That does not look like valid JSON yet.");
      return;
    }

    if (!responsePayloads.length) {
      setDeepSeekImportMessage("Paste at least one DeepSeek response JSON object.");
      return;
    }

    setDeepSeekImporting(true);
    try {
      const result = await importDeepSeekResponses({
        providerAccountId: providerAccount.id,
        responsePayloads
      });
      setDeepSeekResponseText("");
      setDeepSeekImportMessage(`Imported ${result.rowsProcessed} DeepSeek responses. ${result.rowsFailed} failed.`);
      await dashboard.refresh();
    } catch (error) {
      setDeepSeekImportMessage(error instanceof Error ? error.message : "DeepSeek response import failed.");
    } finally {
      setDeepSeekImporting(false);
    }
  }

  async function saveProviderSettings() {
    if (!providerAccount) {
      setAccountMessage("Provider account is still loading. Give it a second.");
      return;
    }

    setAccountSaving(true);
    setAccountMessage(null);
    try {
      await updateAccountProvider({
        providerAccountId: providerAccount.id,
        displayName: displayName.trim() || providerAccount.displayName,
        planName: planName.trim() || null,
        monthlyBudget: optionalNumber(monthlyBudget),
        resetRule: resetRule.trim() || null
      });
      setAccountMessage("Provider settings saved.");
      await dashboard.refresh();
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "Provider settings could not be saved.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function toggleSyncPause() {
    if (!providerAccount) return;

    setAccountSaving(true);
    setAccountMessage(null);
    try {
      const nextStatus = providerAccount.syncStatus === "paused" ? "idle" : "paused";
      await updateAccountProvider({
        providerAccountId: providerAccount.id,
        syncStatus: nextStatus
      });
      setAccountMessage(nextStatus === "paused" ? "Sync paused for this provider." : "Sync resumed for this provider.");
      await dashboard.refresh();
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "Sync status could not be changed.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function removeCredentials() {
    if (!providerAccount) return;

    setCredentialsRemoving(true);
    setAccountMessage(null);
    try {
      await removeProviderCredentials(providerAccount.id);
      setAccountMessage("Saved API key removed. Usage history stayed put.");
      await dashboard.refresh();
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "Saved API key could not be removed.");
    } finally {
      setCredentialsRemoving(false);
    }
  }

  async function saveCredentials() {
    if (!providerAccount) return;

    if (!newCredential.trim()) {
      setCredentialMessage("Enter a value first.");
      return;
    }

    setCredentialSaving(true);
    setCredentialMessage(null);
    try {
      await updateAccountProvider({
        providerAccountId: providerAccount.id,
        apiKey: newCredential.trim()
      });
      setNewCredential("");
      setCredentialMessage("Credentials updated.");
      await dashboard.refresh();
    } catch (error) {
      setCredentialMessage(error instanceof Error ? error.message : "Credentials could not be saved.");
    } finally {
      setCredentialSaving(false);
    }
  }

  async function deleteProvider() {
    if (!providerAccount) return;

    setDeleting(true);
    setAccountMessage(null);
    try {
      await deleteAccountProvider(providerAccount.id);
      await dashboard.refresh();
      blurActiveElement();
      router.replace("/providers");
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "Provider account could not be deleted.");
      setDeleting(false);
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
          <Text style={styles.label}>Provider account</Text>
          <TextInput onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor="#63636a" style={styles.input} value={displayName} />
          <TextInput onChangeText={setPlanName} placeholder="Plan name, optional" placeholderTextColor="#63636a" style={styles.input} value={planName} />
          <View style={styles.grid}>
            <TextInput keyboardType="decimal-pad" onChangeText={setMonthlyBudget} placeholder="Monthly budget" placeholderTextColor="#63636a" style={[styles.input, styles.gridInput]} value={monthlyBudget} />
            <TextInput onChangeText={setResetRule} placeholder="Reset rule" placeholderTextColor="#63636a" style={[styles.input, styles.gridInput]} value={resetRule} />
          </View>
          <Text style={styles.body}>Credentials: {providerAccount?.hasCredentials ? "API key saved" : "No saved API key"}. Sync: {providerAccount?.syncStatus ?? "loading"}.</Text>
          <Pressable disabled={accountSaving || !providerAccount} onPress={saveProviderSettings} style={({ pressed }) => [styles.saveButton, (accountSaving || !providerAccount) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.saveButtonText}>{accountSaving ? "Saving..." : "Save provider settings"}</Text>
          </Pressable>
          <View style={styles.actionGrid}>
            <Pressable disabled={accountSaving || !providerAccount} onPress={toggleSyncPause} style={({ pressed }) => [styles.secondaryButton, (accountSaving || !providerAccount) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{providerAccount?.syncStatus === "paused" ? "Resume sync" : "Pause sync"}</Text>
            </Pressable>
            <Pressable disabled={credentialsRemoving || !providerAccount?.hasCredentials} onPress={removeCredentials} style={({ pressed }) => [styles.secondaryButton, (credentialsRemoving || !providerAccount?.hasCredentials) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{credentialsRemoving ? "Removing..." : "Remove API key"}</Text>
            </Pressable>
          </View>
          <Pressable disabled={deleting || !providerAccount} onPress={deleteProvider} style={({ pressed }) => [styles.dangerButton, (deleting || !providerAccount) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.dangerButtonText}>{deleting ? "Deleting..." : "Delete provider account"}</Text>
          </Pressable>
          {accountMessage ? <Text style={styles.message}>{accountMessage}</Text> : null}
        </View>

        {providerAccount?.authType === "api_key" || providerAccount?.authType === "session_cookie" ? (
          <View style={styles.card}>
            <Text style={styles.label}>{providerAccount.authType === "session_cookie" ? "Session cookie" : "API key"}</Text>
            {providerAccount.authType === "session_cookie" && COOKIE_SOURCE_URLS[providerAccount.providerId] ? (
              <Text style={styles.body}>Get your cookie from:{" "}
                <Text style={styles.link} onPress={() => Linking.openURL(COOKIE_SOURCE_URLS[providerAccount.providerId])}>
                  {COOKIE_SOURCE_URLS[providerAccount.providerId]}
                </Text>
              </Text>
            ) : null}
            <Text style={styles.body}>{providerAccount.hasCredentials ? "Credentials are saved. Enter a new value to replace them." : "No credentials saved yet."}</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setNewCredential}
              placeholder={providerAccount.authType === "session_cookie" ? "New session cookie" : "New API key"}
              placeholderTextColor="#63636a"
              secureTextEntry
              style={styles.input}
              value={newCredential}
            />
            <Pressable disabled={credentialSaving || !providerAccount || !newCredential.trim()} onPress={saveCredentials} style={({ pressed }) => [styles.saveButton, (credentialSaving || !providerAccount || !newCredential.trim()) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.saveButtonText}>{credentialSaving ? "Saving..." : "Update credentials"}</Text>
            </Pressable>
            {credentialMessage ? <Text style={styles.message}>{credentialMessage}</Text> : null}
          </View>
        ) : null}

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

        {providerAccount?.providerId === "openrouter" ? (
          <View style={styles.card}>
            <Text style={styles.label}>OpenRouter generation IDs</Text>
            <Text style={styles.body}>Paste generation IDs from OpenRouter to fetch exact model, token, and cost stats.</Text>
            <TextInput
              multiline
              onChangeText={setGenerationIdsText}
              placeholder={"gen-...\ngen-..."}
              placeholderTextColor="#63636a"
              style={[styles.input, styles.importBox]}
              textAlignVertical="top"
              value={generationIdsText}
            />
            <Text style={styles.message}>{parseGenerationIds(generationIdsText).length ? `${parseGenerationIds(generationIdsText).length} generation IDs ready.` : "Paste one ID per line, or comma separated."}</Text>
            <Pressable disabled={generationImporting || !providerAccount || !parseGenerationIds(generationIdsText).length} onPress={importGenerations} style={({ pressed }) => [styles.saveButton, (generationImporting || !providerAccount || !parseGenerationIds(generationIdsText).length) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.saveButtonText}>{generationImporting ? "Importing..." : "Import generations"}</Text>
            </Pressable>
            {generationImportMessage ? <Text style={styles.message}>{generationImportMessage}</Text> : null}
          </View>
        ) : null}

        {providerAccount?.providerId === "xai" ? (
          <View style={styles.card}>
            <Text style={styles.label}>xAI response JSON</Text>
            <Text style={styles.body}>Paste raw xAI REST responses to import exact token usage and charged cost from response metadata.</Text>
            <TextInput
              multiline
              onChangeText={setXaiResponseText}
              placeholder={'{"id":"...","model":"grok-4.3","usage":{"input_tokens":199,"output_tokens":1,"cost_in_usd_ticks":158500}}'}
              placeholderTextColor="#63636a"
              style={[styles.input, styles.importBox]}
              textAlignVertical="top"
              value={xaiResponseText}
            />
            <Text style={styles.message}>{xaiResponsePreview ? `${xaiResponsePreview} response payloads ready.` : "Paste one JSON object, a JSON array, or newline-delimited JSON."}</Text>
            <Pressable disabled={xaiImporting || !providerAccount || !xaiResponsePreview} onPress={importXaiResponsePayloads} style={({ pressed }) => [styles.saveButton, (xaiImporting || !providerAccount || !xaiResponsePreview) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.saveButtonText}>{xaiImporting ? "Importing..." : "Import xAI responses"}</Text>
            </Pressable>
            {xaiImportMessage ? <Text style={styles.message}>{xaiImportMessage}</Text> : null}
          </View>
        ) : null}

        {providerAccount?.providerId === "deepseek" ? (
          <View style={styles.card}>
            <Text style={styles.label}>DeepSeek response JSON</Text>
            <Text style={styles.body}>Paste raw DeepSeek chat completion responses to import prompt, completion, cache, and reasoning token usage.</Text>
            <TextInput
              multiline
              onChangeText={setDeepSeekResponseText}
              placeholder={'{"id":"...","model":"deepseek-v4-pro","created":1705651092,"usage":{"prompt_tokens":16,"completion_tokens":10,"total_tokens":26}}'}
              placeholderTextColor="#63636a"
              style={[styles.input, styles.importBox]}
              textAlignVertical="top"
              value={deepSeekResponseText}
            />
            <Text style={styles.message}>{deepSeekResponsePreview ? `${deepSeekResponsePreview} response payloads ready.` : "Paste one JSON object, a JSON array, or newline-delimited JSON."}</Text>
            <Pressable disabled={deepSeekImporting || !providerAccount || !deepSeekResponsePreview} onPress={importDeepSeekResponsePayloads} style={({ pressed }) => [styles.saveButton, (deepSeekImporting || !providerAccount || !deepSeekResponsePreview) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.saveButtonText}>{deepSeekImporting ? "Importing..." : "Import DeepSeek responses"}</Text>
            </Pressable>
            {deepSeekImportMessage ? <Text style={styles.message}>{deepSeekImportMessage}</Text> : null}
          </View>
        ) : null}

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
  actionGrid: { flexDirection: "row", gap: 10, marginTop: 10 },
  secondaryButton: { flex: 1, minHeight: 42, borderRadius: 7, backgroundColor: "#1f1f23", borderColor: "#34343a", borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  secondaryButtonText: { color: "#e4e4e7", fontSize: 13, fontWeight: "900" },
  dangerButton: { minHeight: 42, borderRadius: 7, backgroundColor: "#2a1113", borderColor: "#7f1d1d", borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 10 },
  dangerButtonText: { color: "#fecaca", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  message: { color: "#a1a1aa", fontSize: 13, fontWeight: "700", marginTop: 8 },
  big: { color: "#f4f4f5", fontSize: 32, fontWeight: "900", marginTop: 8 },
  body: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, marginTop: 6 },
  link: { color: "#60a5fa", fontSize: 14, lineHeight: 20, textDecorationLine: "underline" },
  row: { color: "#e4e4e7", fontSize: 15, fontWeight: "700", paddingTop: 12 }
});
