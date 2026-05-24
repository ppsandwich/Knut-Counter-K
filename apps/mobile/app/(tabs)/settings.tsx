import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthSession } from "../../hooks/useAuthSession";

const rows = ["Preferred currency: USD", "Monthly AI budget: $120", "Timezone: Australia/Melbourne", "Pricing refresh: daily"];

export default function SettingsScreen() {
  const auth = useAuthSession();

  return (
    <SafeAreaView style={styles.safe}>
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
  rowText: { color: "#e4e4e7", fontSize: 16, fontWeight: "600" }
});
