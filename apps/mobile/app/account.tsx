import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { normaliseCurrencyCode, popularCurrencies } from "@knut/shared";
import { BackButton } from "../components/BackButton";
import { useAuthSession } from "../hooks/useAuthSession";
import { clearAlerts, exportAccountData, saveAccountSettings, syncAccountProfile } from "../lib/accountApi";

export default function AccountScreen() {
  const auth = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState("Australia/Melbourne");
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [monthlyAiBudget, setMonthlyAiBudget] = useState("120");
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [clearingAlerts, setClearingAlerts] = useState(false);
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!auth.user) return;

    syncAccountProfile()
      .then((result) => {
        if (!mounted) return;
        const profile = result.profile;
        if (!profile) return;
        setPreferredCurrency(normaliseCurrencyCode(profile.preferredCurrency));
        setTimezone(profile.timezone ?? "Australia/Melbourne");
        setMonthlyAiBudget(profile.monthlyAiBudget == null ? "" : String(profile.monthlyAiBudget));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [auth.user?.id]);

  async function signIn() {
    const result = await auth.signInWithEmail(email.trim(), password);
    setMessage(result.error ?? "Signed in.");
  }

  async function signUp() {
    const result = await auth.signUpWithEmail(email.trim(), password);
    setMessage(result.error ?? "Account created. Check your email if confirmation is enabled.");
  }

  async function signOut() {
    await auth.signOut();
    setMessage("Signed out.");
  }

  async function saveSettings() {
    try {
      await saveAccountSettings({
        timezone,
        preferredCurrency,
        monthlyAiBudget: monthlyAiBudget.trim() ? Number(monthlyAiBudget) : null
      });
      setMessage("Account settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settings could not be saved.");
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const payload = await exportAccountData();
      const json = JSON.stringify(payload, null, 2);

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `knut-counter-export-${payload.exportedAt.slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setMessage("Account export downloaded.");
      } else {
        setMessage(`Export ready with ${payload.providerAccounts.length} providers and ${payload.usageRecords.length} usage records.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function clearAccountAlerts() {
    setClearingAlerts(true);
    try {
      const result = await clearAlerts();
      setMessage(result.cleared ? `Cleared ${result.cleared} alert${result.cleared === 1 ? "" : "s"}.` : "No active alerts to clear.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Alerts could not be cleared.");
    } finally {
      setClearingAlerts(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton fallbackHref="/settings" />
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Sign in once, then your provider keys, manual plans, budgets, alerts, and imports belong to your account.</Text>

        {!auth.configured ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Supabase is not configured yet.</Text>
            <Text style={styles.body}>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for the app, plus SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for Vercel API routes.</Text>
          </View>
        ) : null}

        {auth.user ? (
          <View style={styles.card}>
            <Text style={styles.label}>Signed in</Text>
            <Text style={styles.email}>{auth.user.email}</Text>
            <Text style={styles.body}>Provider API keys are sent only to serverless routes, encrypted at rest, and never echoed back to the app.</Text>
            <Pressable onPress={signOut} style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}>
              <Text style={styles.dangerButtonText}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Email account</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#63636a"
              style={styles.input}
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#63636a"
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <View style={styles.actions}>
              <Pressable onPress={signIn} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </Pressable>
              <Pressable onPress={signUp} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Create account</Text>
              </Pressable>
            </View>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <Pressable onPress={async () => {
              const result = await auth.signInWithGoogle();
              setMessage(result.error ?? "Redirecting to Google...");
            }} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </Pressable>
          </View>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Account settings</Text>
          <Pressable onPress={() => setCurrencyMenuOpen((value) => !value)} style={styles.select}>
            <View style={styles.selectTextBlock}>
              <Text style={styles.selectLabel}>Preferred currency</Text>
              <Text style={styles.selectValue}>{popularCurrencies.find((currency) => currency.code === preferredCurrency)?.name ?? "United States dollar"} · {preferredCurrency}</Text>
            </View>
            <Text style={styles.selectAction}>{currencyMenuOpen ? "Close" : "Choose"}</Text>
          </Pressable>
          {currencyMenuOpen ? (
            <ScrollView nestedScrollEnabled style={styles.currencyMenu}>
              {popularCurrencies.map((currency) => {
                const selected = currency.code === preferredCurrency;
                return (
                  <Pressable
                    key={currency.code}
                    onPress={() => {
                      setPreferredCurrency(currency.code);
                      setCurrencyMenuOpen(false);
                    }}
                    style={[styles.currencyOption, selected && styles.currencyOptionSelected]}
                  >
                    <Text style={styles.currencyName}>{currency.name}</Text>
                    <Text style={styles.currencyCode}>{currency.code}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <TextInput onChangeText={setMonthlyAiBudget} keyboardType="decimal-pad" style={styles.input} value={monthlyAiBudget} />
          <TextInput onChangeText={setTimezone} style={styles.input} value={timezone} />
          <Pressable disabled={!auth.user} onPress={saveSettings} style={({ pressed }) => [styles.primaryButton, !auth.user && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Save settings</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Data controls</Text>
          <Text style={styles.body}>Export includes profile, provider accounts without API keys, usage records, usage caps, alerts, and import jobs.</Text>
          <View style={styles.actions}>
            <Pressable disabled={!auth.user || exporting} onPress={exportData} style={({ pressed }) => [styles.secondaryButton, (!auth.user || exporting) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{exporting ? "Exporting..." : "Export JSON"}</Text>
            </Pressable>
            <Pressable disabled={!auth.user || clearingAlerts} onPress={clearAccountAlerts} style={({ pressed }) => [styles.secondaryButton, (!auth.user || clearingAlerts) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{clearingAlerts ? "Clearing..." : "Clear alerts"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Serverless account model</Text>
          <Text style={styles.row}>Auth: Supabase email session in app storage</Text>
          <Text style={styles.row}>API: Bearer JWT on every Vercel function request</Text>
          <Text style={styles.row}>Keys: AES-GCM encrypted before database write</Text>
          <Text style={styles.row}>Data: all provider accounts scoped by user_id</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 12 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "900" },
  subtitle: { color: "#8b8b91", fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  warningCard: { backgroundColor: "#20180a", borderColor: "#5f3b12", borderWidth: 1, borderRadius: 8, padding: 14, gap: 8 },
  warningTitle: { color: "#fbbf24", fontSize: 16, fontWeight: "900" },
  label: { color: "#8b8b91", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  email: { color: "#f4f4f5", fontSize: 20, fontWeight: "900" },
  body: { color: "#a1a1aa", fontSize: 14, lineHeight: 20 },
  row: { color: "#e4e4e7", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  input: { color: "#f4f4f5", backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  select: { minHeight: 56, backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectTextBlock: { flex: 1, minWidth: 0 },
  selectLabel: { color: "#8b8b91", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  selectValue: { color: "#f4f4f5", fontSize: 15, fontWeight: "900", marginTop: 3 },
  selectAction: { color: "#86efac", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  currencyMenu: { maxHeight: 320, borderColor: "#29292d", borderWidth: 1, borderRadius: 7, overflow: "hidden" },
  currencyOption: { minHeight: 42, backgroundColor: "#09090b", borderBottomColor: "#1f1f23", borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  currencyOptionSelected: { backgroundColor: "#102016" },
  currencyName: { color: "#f4f4f5", fontSize: 14, fontWeight: "800", flex: 1 },
  currencyCode: { color: "#86efac", fontSize: 12, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 10 },
  primaryButton: { flex: 1, minHeight: 44, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#22c55e" },
  primaryButtonText: { color: "#041006", fontSize: 15, fontWeight: "900" },
  secondaryButton: { flex: 1, minHeight: 44, borderRadius: 7, alignItems: "center", justifyContent: "center", borderColor: "#29292d", borderWidth: 1 },
  secondaryButtonText: { color: "#f4f4f5", fontSize: 15, fontWeight: "900" },
  dangerButton: { minHeight: 44, borderRadius: 7, alignItems: "center", justifyContent: "center", borderColor: "#7f1d1d", borderWidth: 1, marginTop: 4 },
  dangerButtonText: { color: "#fca5a5", fontSize: 15, fontWeight: "900" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#29292d" },
  dividerText: { color: "#63636a", fontSize: 12, fontWeight: "700" },
  googleButton: { minHeight: 44, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#3f3f46" },
  googleButtonText: { color: "#e4e4e7", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.42 },
  message: { color: "#a1a1aa", fontSize: 13, fontWeight: "700" }
});
