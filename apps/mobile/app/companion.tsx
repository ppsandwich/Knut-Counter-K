import { useState, useEffect } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthSession } from "../hooks/useAuthSession";
import { authorizeDeviceCode } from "../lib/companionApi";

export default function CompanionAuthScreen() {
  const router = useRouter();
  const auth = useAuthSession();
  const [userCode, setUserCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!auth.user) {
      router.replace("/(tabs)/settings");
    }
  }, [auth.user]);

  async function handleAuthorize() {
    if (!userCode.trim() || !auth.user) return;

    setStatus("loading");
    setMessage("");

    try {
      const success = await authorizeDeviceCode(userCode.trim(), auth.user.id);
      if (success) {
        setStatus("success");
        setMessage("Knut Sync has been connected! You can close this page.");
      } else {
        setStatus("error");
        setMessage("Invalid or expired code. Please check and try again.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Authorization failed");
    }
  }

  function formatCode(text: string) {
    // Remove non-alphanumeric and format as XXXX-XXXX
    const cleaned = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cleaned.length > 4) {
      return cleaned.slice(0, 4) + "-" + cleaned.slice(4, 8);
    }
    return cleaned;
  }

  if (!auth.user) {
    return null;
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Connect Knut Sync</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.description}>
            Enter the code shown in the Knut Sync desktop app to connect it to your account.
          </Text>

          <View style={styles.codeInput}>
            <TextInput
              style={styles.input}
              value={userCode}
              onChangeText={(text) => setUserCode(formatCode(text))}
              placeholder="XXXX-XXXX"
              placeholderTextColor="#71717a"
              maxLength={9}
              autoCapitalize="characters"
              autoComplete="off"
              autoFocus
            />
          </View>

          <Text style={styles.hint}>
            The code is shown in the Knut Sync app when you click "Connect Account".
          </Text>

          <Pressable
            disabled={!userCode.trim() || status === "loading" || status === "success"}
            onPress={handleAuthorize}
            style={[
              styles.button,
              (!userCode.trim() || status === "loading" || status === "success") && styles.buttonDisabled
            ]}
          >
            <Text style={styles.buttonText}>
              {status === "loading" ? "Connecting..." : status === "success" ? "Connected!" : "Connect"}
            </Text>
          </Pressable>

          {message ? (
            <Text style={[styles.message, status === "success" ? styles.success : styles.error]}>
              {message}
            </Text>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What is Knut Sync?</Text>
          <Text style={styles.infoText}>
            Knut Sync is a desktop companion app that automatically tracks your AI subscription 
            usage (Claude, ChatGPT, Cursor, etc.) and syncs it to Knut Counter.
          </Text>
          <Text style={styles.infoText}>
            It reads usage data directly from your desktop apps — no manual entry required.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { color: "#f5f5f5", fontSize: 28, fontWeight: "800" },
  back: { color: "#22c55e", fontSize: 16, fontWeight: "600" },
  card: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 12, padding: 20 },
  description: { color: "#a1a1aa", fontSize: 15, lineHeight: 22, marginBottom: 20 },
  codeInput: { marginBottom: 12 },
  input: {
    backgroundColor: "#09090b",
    borderColor: "#29292d",
    borderWidth: 2,
    borderRadius: 8,
    padding: 16,
    fontSize: 28,
    fontWeight: "700",
    color: "#f4f4f5",
    textAlign: "center",
    fontFamily: "monospace",
    letterSpacing: 4,
  },
  hint: { color: "#71717a", fontSize: 13, marginBottom: 20 },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#000", fontSize: 16, fontWeight: "700" },
  message: { marginTop: 16, fontSize: 14, textAlign: "center" },
  success: { color: "#22c55e" },
  error: { color: "#ef4444" },
  infoCard: { 
    backgroundColor: "#111113", 
    borderColor: "#242428", 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 20, 
    marginTop: 16 
  },
  infoTitle: { color: "#f4f4f5", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  infoText: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, marginBottom: 8 },
});
