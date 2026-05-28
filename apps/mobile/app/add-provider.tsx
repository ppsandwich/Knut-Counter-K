import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "../components/BackButton";
import { useAuthSession } from "../hooks/useAuthSession";
import { useProviderRegistry } from "../hooks/useProviderRegistry";
import { createAccountProvider } from "../lib/accountApi";

type ConnectionMethod = "api_key" | "manual" | "csv_json_import" | "oauth";
type ConnectionOption = [ConnectionMethod, string];

const CUSTOM_PROVIDER_ID = "other_custom";

export default function AddProviderScreen() {
  const auth = useAuthSession();
  const registry = useProviderRegistry();
  const [providerId, setProviderId] = useState("openai_api");
  const [displayName, setDisplayName] = useState("OpenAI API");
  const [displayNameEdited, setDisplayNameEdited] = useState(false);
  const [authType, setAuthType] = useState<ConnectionMethod>("api_key");
  const [apiKey, setApiKey] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("25");
  const [resetRule, setResetRule] = useState("monthly");
  const [message, setMessage] = useState<string | null>(null);

  async function saveProvider() {
    const trimmedDisplayName = displayName.trim();
    const selectedProviderName = selectedProvider?.providerName ?? "OpenAI API";

    if (!trimmedDisplayName && providerId === CUSTOM_PROVIDER_ID) {
      setMessage("Enter a provider name.");
      return;
    }

    try {
      await createAccountProvider({
        providerId,
        displayName: trimmedDisplayName || selectedProviderName,
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

  const selectedProvider = registry.providers.find((provider) => provider.providerId === providerId) ?? registry.providers[0];
  const isCustomProvider = providerId === CUSTOM_PROVIDER_ID;
  const isAntigravity = providerId === "antigravity";
  const connectionOptions = useMemo<ConnectionOption[]>(() => selectedProvider
    ? ([
        isAntigravity ? ["oauth", "Google OAuth"] : null,
        selectedProvider.supportsAccountUsageApi || selectedProvider.supportsResponseUsageMetadata ? ["api_key", "API key"] : null,
        selectedProvider.supportsManualImport ? ["manual", "Manual tracking"] : null,
        selectedProvider.supportsCsvImport || selectedProvider.supportsJsonImport ? ["csv_json_import", "CSV/JSON import"] : null
      ].filter(Boolean) as ConnectionOption[])
    : [
        ["api_key", "API key"],
        ["manual", "Manual tracking"],
        ["csv_json_import", "CSV/JSON import"]
      ], [selectedProvider, isAntigravity]);

  useEffect(() => {
    if (!connectionOptions.some(([value]) => value === authType) && connectionOptions[0]) {
      setAuthType(connectionOptions[0][0]);
    }
  }, [authType, connectionOptions]);

  function selectProvider(nextProviderId: string, providerName: string) {
    setProviderId(nextProviderId);
    if (nextProviderId === CUSTOM_PROVIDER_ID) {
      setDisplayName("");
      setDisplayNameEdited(false);
      return;
    }

    if (!displayNameEdited) {
      setDisplayName(providerName);
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
          <Text style={styles.label}>Provider</Text>
          {registry.loading ? (
            <Text style={styles.helperText}>Loading supported providers...</Text>
          ) : registry.error ? (
            <Text style={styles.errorText}>{registry.error}</Text>
          ) : registry.providers.length ? (
            <View style={styles.providerList}>
              {registry.providers.map((provider) => (
                <Pressable
                  key={provider.providerId}
                  onPress={() => selectProvider(provider.providerId, provider.providerName)}
                  style={[styles.providerOption, provider.providerId === providerId && styles.providerOptionActive]}
                >
                  <View style={styles.providerTextBlock}>
                    <Text style={styles.providerName}>{provider.providerName}</Text>
                    <Text style={styles.providerMeta}>{provider.connectorStatus.replaceAll("_", " ")}</Text>
                  </View>
                  <Text style={styles.providerCheck}>{provider.providerId === providerId ? "Selected" : ""}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>Sign in to load supported providers.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{isCustomProvider ? "Provider name" : "Account name"}</Text>
          <TextInput
            onChangeText={(value) => {
              setDisplayName(value);
              setDisplayNameEdited(true);
            }}
            placeholder={isCustomProvider ? "Provider name" : selectedProvider?.providerName ?? "OpenAI API"}
            placeholderTextColor="#63636a"
            style={styles.input}
            value={displayName}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Connection method</Text>
          {connectionOptions.map(([value, label]) => (
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
          {authType === "oauth" ? (
            <Pressable
              disabled={!auth.user}
              onPress={() => {
                const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLOUDCODE_CLIENT_ID;
                const redirectUri = `${typeof window !== "undefined" ? window.location.origin : ""}/api/antigravity/callback`;
                const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/cloudcode")}&access_type=offline&prompt=consent`;
                Linking.openURL(url);
              }}
              style={({ pressed }) => [styles.oauthButton, !auth.user && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={styles.oauthButtonText}>Connect with Google</Text>
            </Pressable>
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
  helperText: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  errorText: { color: "#fca5a5", fontSize: 13, lineHeight: 19, fontWeight: "700" },
  input: { color: "#f4f4f5", backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  providerList: { gap: 8 },
  providerOption: { minHeight: 58, borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  providerOptionActive: { borderColor: "#22c55e", backgroundColor: "#102016" },
  providerTextBlock: { flex: 1, minWidth: 0 },
  providerName: { color: "#f4f4f5", fontSize: 15, fontWeight: "900" },
  providerMeta: { color: "#8b8b91", fontSize: 12, fontWeight: "700", marginTop: 3 },
  providerCheck: { color: "#86efac", fontSize: 12, fontWeight: "900" },
  option: { minHeight: 44, borderColor: "#29292d", borderWidth: 1, borderRadius: 7, justifyContent: "center", paddingHorizontal: 12 },
  optionActive: { borderColor: "#22c55e", backgroundColor: "#102016" },
  optionText: { color: "#f4f4f5", fontSize: 15, fontWeight: "800" },
  saveButton: { minHeight: 46, borderRadius: 7, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" },
  saveButtonText: { color: "#041006", fontSize: 15, fontWeight: "900" },
  oauthButton: { minHeight: 46, borderRadius: 7, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  oauthButtonText: { color: "#1f1f1f", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72 },
  message: { color: "#a1a1aa", fontSize: 13, fontWeight: "700" }
});
