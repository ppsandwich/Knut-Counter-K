import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "../components/BackButton";
import { useAuthSession } from "../hooks/useAuthSession";
import { createAccountProvider } from "../lib/accountApi";

export default function AddProviderScreen() {
  const auth = useAuthSession();
  const [providerId, setProviderId] = useState("openai_api");
  const [displayName, setDisplayName] = useState("OpenAI API");
  const [authType, setAuthType] = useState<"api_key" | "manual" | "csv_json_import">("api_key");
  const [apiKey, setApiKey] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("25");
  const [resetRule, setResetRule] = useState("monthly");
  const [message, setMessage] = useState<string | null>(null);

  async function saveProvider() {
    try {
      await createAccountProvider({
        providerId,
        displayName,
        authType,
        apiKey: authType === "api_key" ? apiKey : undefined,
        monthlyBudget: monthlyBudget.trim() ? Number(monthlyBudget) : null,
        resetRule
      });
      setApiKey("");
      setMessage("Provider attached to your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider could not be saved.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton fallbackHref="/providers" />
        <Text style={styles.title}>Add Provider</Text>
        <Text style={styles.subtitle}>Connect an API account, or track a plan manually when providers keep the useful numbers hidden.</Text>
        <Text style={styles.accountNote}>{auth.user ? `Saving to ${auth.user.email}` : "Sign in from Settings before saving provider keys."}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Provider account</Text>
          <TextInput onChangeText={setDisplayName} placeholder="OpenAI API" placeholderTextColor="#63636a" style={styles.input} value={displayName} />
          <TextInput autoCapitalize="none" onChangeText={setProviderId} placeholder="openai_api" placeholderTextColor="#63636a" style={styles.input} value={providerId} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Connection method</Text>
          {[
            ["api_key", "API key"],
            ["manual", "Manual tracking"],
            ["csv_json_import", "CSV/JSON import"]
          ].map(([value, label]) => (
            <Pressable key={value} onPress={() => setAuthType(value as typeof authType)} style={[styles.option, authType === value && styles.optionActive]}>
              <Text style={styles.optionText}>{label}</Text>
            </Pressable>
          ))}
          {authType === "api_key" ? (
            <TextInput
              autoCapitalize="none"
              onChangeText={setApiKey}
              placeholder="API key"
              placeholderTextColor="#63636a"
              secureTextEntry
              style={styles.input}
              value={apiKey}
            />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Caps and budget</Text>
          <TextInput keyboardType="decimal-pad" onChangeText={setMonthlyBudget} style={styles.input} value={monthlyBudget} />
          <TextInput autoCapitalize="none" onChangeText={setResetRule} style={styles.input} value={resetRule} />
        </View>
        <Pressable disabled={!auth.user} onPress={saveProvider} style={({ pressed }) => [styles.saveButton, !auth.user && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.saveButtonText}>Save provider</Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 12 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "900" },
  subtitle: { color: "#8b8b91", fontSize: 14, lineHeight: 20 },
  accountNote: { color: "#a1a1aa", fontSize: 13, fontWeight: "800" },
  card: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  label: { color: "#8b8b91", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  input: { color: "#f4f4f5", backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  option: { minHeight: 44, borderColor: "#29292d", borderWidth: 1, borderRadius: 7, justifyContent: "center", paddingHorizontal: 12 },
  optionActive: { borderColor: "#22c55e", backgroundColor: "#102016" },
  optionText: { color: "#f4f4f5", fontSize: 15, fontWeight: "800" },
  saveButton: { minHeight: 46, borderRadius: 7, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" },
  saveButtonText: { color: "#041006", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72 },
  message: { color: "#a1a1aa", fontSize: 13, fontWeight: "700" }
});
