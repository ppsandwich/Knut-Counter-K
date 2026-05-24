import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProviderUsageRow } from "@knut/ui";
import { mockDashboard } from "@knut/shared/mockData";

export default function ProvidersScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Providers</Text>
          <Link href="/add-provider" style={styles.add}>Add</Link>
        </View>
        <Text style={styles.subtitle}>Connected accounts and manual plans, kept separate so the numbers do not tell fibs.</Text>
        {mockDashboard.providers.map((provider) => (
          <Link key={provider.providerId} href={`/provider/${provider.providerId}`} asChild>
            <ProviderUsageRow provider={provider} />
          </Link>
        ))}
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
  subtitle: { color: "#8b8b91", fontSize: 14, lineHeight: 20, marginBottom: 6 }
});
