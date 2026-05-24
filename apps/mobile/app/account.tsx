import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "../components/BackButton";
import { useAuthSession } from "../hooks/useAuthSession";
import { saveAccountSettings } from "../lib/accountApi";

export default function AccountScreen() {
  const auth = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState("Australia/Melbourne");
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [monthlyAiBudget, setMonthlyAiBudget] = useState("120");
  const [message, setMessage] = useState<string | null>(null);

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
          </View>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Account settings</Text>
          <TextInput onChangeText={setPreferredCurrency} style={styles.input} value={preferredCurrency} />
          <TextInput onChangeText={setMonthlyAiBudget} keyboardType="decimal-pad" style={styles.input} value={monthlyAiBudget} />
          <TextInput onChangeText={setTimezone} style={styles.input} value={timezone} />
          <Pressable disabled={!auth.user} onPress={saveSettings} style={({ pressed }) => [styles.primaryButton, !auth.user && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Save settings</Text>
          </Pressable>
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
  actions: { flexDirection: "row", gap: 10 },
  primaryButton: { flex: 1, minHeight: 44, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#22c55e" },
  primaryButtonText: { color: "#041006", fontSize: 15, fontWeight: "900" },
  secondaryButton: { flex: 1, minHeight: 44, borderRadius: 7, alignItems: "center", justifyContent: "center", borderColor: "#29292d", borderWidth: 1 },
  secondaryButtonText: { color: "#f4f4f5", fontSize: 15, fontWeight: "900" },
  dangerButton: { minHeight: 44, borderRadius: 7, alignItems: "center", justifyContent: "center", borderColor: "#7f1d1d", borderWidth: 1, marginTop: 4 },
  dangerButtonText: { color: "#fca5a5", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.42 },
  message: { color: "#a1a1aa", fontSize: 13, fontWeight: "700" }
});
