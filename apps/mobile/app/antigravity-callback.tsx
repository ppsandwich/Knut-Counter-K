import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../hooks/useAuthSession";
import { exchangeAntigravityCode } from "../lib/accountApi";

export default function AntigravityCallbackScreen() {
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const router = useRouter();
  const auth = useAuthSession();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting Antigravity...");

  useEffect(() => {
    if (error) {
      setStatus("error");
      setMessage(`Google returned an error: ${error}`);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code found in the URL.");
      return;
    }

    if (!auth.user) {
      setStatus("error");
      setMessage("You need to be signed in first.");
      return;
    }

    exchangeAntigravityCode(code)
      .then(() => {
        setStatus("success");
        setMessage("Antigravity connected successfully.");
        setTimeout(() => router.replace("/providers"), 1500);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Failed to connect Antigravity.");
      });
  }, [code, error, auth.user?.id]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>Antigravity</Text>
        <Text style={[styles.status, status === "success" && styles.statusSuccess, status === "error" && styles.statusError]}>
          {status === "loading" ? "Connecting..." : status === "success" ? "Connected" : "Failed"}
        </Text>
        <Text style={styles.message}>{message}</Text>
        {status === "error" ? (
          <Pressable onPress={() => router.replace("/add-provider")} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { flex: 1, padding: 16, justifyContent: "center", alignItems: "center", gap: 12 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "900" },
  status: { color: "#a1a1aa", fontSize: 18, fontWeight: "800" },
  statusSuccess: { color: "#22c55e" },
  statusError: { color: "#fca5a5" },
  message: { color: "#8b8b91", fontSize: 14, lineHeight: 20, textAlign: "center" },
  button: { minHeight: 44, borderRadius: 7, backgroundColor: "#22c55e", paddingHorizontal: 24, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { color: "#041006", fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.72 }
});
