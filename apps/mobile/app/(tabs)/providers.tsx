import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProviderUsageRow } from "@knut/ui";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function ProvidersScreen() {
  const dashboard = useDashboardData();
  const providerRows = dashboard.providerRows;
  const signedIn = Boolean(dashboard.auth.user);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Providers</Text>
          <Link href="/add-provider" style={styles.add}>Add</Link>
        </View>
        <Text style={styles.subtitle}>Connected accounts and manual plans, kept separate so the numbers do not tell fibs.</Text>
        {!signedIn ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sign in first.</Text>
            <Text style={styles.emptyBody}>Provider accounts are attached to your Knut Counter account.</Text>
          </View>
        ) : dashboard.loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Loading providers...</Text>
          </View>
        ) : dashboard.error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Providers could not load.</Text>
            <Text style={styles.emptyBody}>{dashboard.error}</Text>
          </View>
        ) : providerRows.length ? (
          providerRows.map((provider) => (
          <Link key={provider.providerId} href={`/provider/${provider.providerId}`} asChild>
            <ProviderUsageRow provider={provider} />
          </Link>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No providers connected yet.</Text>
            <Text style={styles.emptyBody}>Tap Add to attach an API key or create a manual plan.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800" },
  add: { color: "#22c55e", fontSize: 17, fontWeight: "800" },
  subtitle: { color: "#8b8b91", fontSize: 14, lineHeight: 20, marginBottom: 6 },
  emptyCard: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 6 },
  emptyTitle: { color: "#f4f4f5", fontSize: 16, fontWeight: "900" },
  emptyBody: { color: "#a1a1aa", fontSize: 14, lineHeight: 20 }
});
