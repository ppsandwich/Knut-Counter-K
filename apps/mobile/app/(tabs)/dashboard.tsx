import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertSummary, MonthlyDamageCard, ProviderUsageRow, RecommendationCard, SyncStatusStrip } from "@knut/ui";
import { mockDashboard } from "@knut/shared/mockData";

export default function DashboardScreen() {
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
          <Text style={styles.sectionMeta}>cap watch</Text>
        </View>
        {mockDashboard.providers.map((provider) => (
          <ProviderUsageRow key={provider.providerId} provider={provider} />
        ))}

        <SyncStatusStrip status={mockDashboard.syncStatus} />
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
  sectionMeta: { color: "#71717a", fontSize: 12, fontWeight: "700", textTransform: "uppercase" }
});
