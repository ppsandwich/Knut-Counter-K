import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertSummary, MonthlyDamageCard, ProviderUsageRow, RecommendationCard, SyncStatusStrip } from "@knut/ui";
import { mockDashboard } from "@knut/shared/mockData";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function DashboardScreen() {
  const dashboard = useDashboardData();
  const providerRows = dashboard.providerRows;
  const signedIn = Boolean(dashboard.auth.user);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Knut Counter</Text>
            <Text style={styles.subtitle}>Today</Text>
          </View>
          <Text style={styles.currency}>USD</Text>
        </View>

        <MonthlyDamageCard summary={mockDashboard.summary} />
        <RecommendationCard recommendation={mockDashboard.recommendation} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Providers</Text>
          <Text style={styles.sectionMeta}>{providerRows.length ? "live accounts" : "setup"}</Text>
        </View>
        {!signedIn ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sign in to see your accounts.</Text>
            <Text style={styles.emptyBody}>Your API keys, manual plans, budgets, and imports will follow your account.</Text>
          </View>
        ) : dashboard.loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Loading providers...</Text>
          </View>
        ) : dashboard.error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Dashboard could not load.</Text>
            <Text style={styles.emptyBody}>{dashboard.error}</Text>
          </View>
        ) : providerRows.length ? (
          providerRows.map((provider) => (
            <ProviderUsageRow key={provider.providerId} provider={provider} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No providers connected yet.</Text>
            <Text style={styles.emptyBody}>Add a provider to start tracking where the tokens are escaping.</Text>
          </View>
        )}

        <SyncStatusStrip status={signedIn ? `${providerRows.length} provider accounts loaded.` : "Sign in to sync account data."} />
        <AlertSummary alerts={mockDashboard.alerts} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 10 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800", letterSpacing: 0 },
  subtitle: { color: "#8b8b91", fontSize: 15, marginTop: 2 },
  currency: { color: "#a1a1aa", fontSize: 12, fontWeight: "700", paddingBottom: 6 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { color: "#f4f4f5", fontSize: 20, fontWeight: "800" },
  sectionMeta: { color: "#71717a", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  emptyCard: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 6 },
  emptyTitle: { color: "#f4f4f5", fontSize: 16, fontWeight: "900" },
  emptyBody: { color: "#a1a1aa", fontSize: 14, lineHeight: 20 }
});
