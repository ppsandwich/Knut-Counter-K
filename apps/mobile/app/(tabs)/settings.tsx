import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatCurrency, normaliseCurrencyCode } from "@knut/shared";
import { useAuthSession } from "../../hooks/useAuthSession";
import { syncAccountProfile } from "../../lib/accountApi";

const defaultRows = ["Preferred currency: USD", "Monthly AI budget: Not set", "Timezone: Australia/Melbourne", "Pricing refresh: daily"];

export default function SettingsScreen() {
  const auth = useAuthSession();
  const [rows, setRows] = useState(defaultRows);

  useEffect(() => {
    let mounted = true;

    if (!auth.user) {
      setRows(defaultRows);
      return;
    }

    syncAccountProfile()
      .then((result) => {
        if (!mounted || !result.profile) return;
        const currency = normaliseCurrencyCode(result.profile.preferredCurrency);
        setRows([
          `Preferred currency: ${currency}`,
          `Monthly AI budget: ${result.profile.monthlyAiBudget == null ? "Not set" : formatCurrency(result.profile.monthlyAiBudget, currency)}`,
          `Timezone: ${result.profile.timezone ?? "Australia/Melbourne"}`,
          "Pricing refresh: daily"
        ]);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [auth.user?.id]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <Link href="/account" asChild>
          <Pressable style={({ pressed }) => [styles.accountCard, pressed && styles.pressed]}>
            <View>
              <Text style={styles.accountLabel}>Account</Text>
              <Text style={styles.accountTitle}>{auth.user?.email ?? "Sign in or create account"}</Text>
              <Text style={styles.accountBody}>{auth.user ? "Keys and settings are attached to this account." : "Attach provider keys, budgets, alerts, and imports to your profile."}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
        {rows.map((row) => (
          <View key={row} style={styles.row}>
            <Text style={styles.rowText}>{row}</Text>
          </View>
        ))}
        
        <Link href="/companion" asChild>
          <Pressable style={({ pressed }) => [styles.companionCard, pressed && styles.pressed]}>
            <View style={styles.companionContent}>
              <Text style={styles.companionLabel}>Companion App</Text>
              <Text style={styles.companionTitle}>Knut Sync</Text>
              <Text style={styles.companionBody}>Connect the desktop app to automatically track subscription usage from Claude, ChatGPT, Cursor, and more.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 10 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800", marginBottom: 4 },
  accountCard: { minHeight: 92, backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  accountLabel: { color: "#8b8b91", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  accountTitle: { color: "#f4f4f5", fontSize: 18, fontWeight: "900", marginTop: 5 },
  accountBody: { color: "#a1a1aa", fontSize: 13, lineHeight: 18, marginTop: 4 },
  chevron: { color: "#71717a", fontSize: 28, fontWeight: "500", alignSelf: "center" },
  pressed: { opacity: 0.72 },
  row: { minHeight: 54, justifyContent: "center", borderBottomColor: "#222225", borderBottomWidth: 1 },
  rowText: { color: "#e4e4e7", fontSize: 16, fontWeight: "600" },
  companionCard: { minHeight: 92, backgroundColor: "#111113", borderColor: "#1f4d2a", borderWidth: 1, borderRadius: 8, padding: 14, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  companionContent: { flex: 1 },
  companionLabel: { color: "#22c55e", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  companionTitle: { color: "#f4f4f5", fontSize: 18, fontWeight: "900", marginTop: 5 },
  companionBody: { color: "#a1a1aa", fontSize: 13, lineHeight: 18, marginTop: 4 }
});
