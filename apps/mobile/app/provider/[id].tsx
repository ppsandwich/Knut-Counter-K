import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProviderUsageRow } from "@knut/ui";
import { mockDashboard } from "@knut/shared";
import { BackButton } from "../../components/BackButton";

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const provider = mockDashboard.providers.find((item) => item.providerId === id) ?? mockDashboard.providers[0];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton fallbackHref="/providers" />
        <Text style={styles.title}>{provider.providerName}</Text>
        <Text style={styles.subtitle}>{provider.accountDisplayName}</Text>
        <ProviderUsageRow provider={provider} />

        <View style={styles.card}>
          <Text style={styles.label}>Cap progress</Text>
          <Text style={styles.big}>{provider.primaryMetric}</Text>
          <Text style={styles.body}>Reset window: {provider.resetCountdown}. Confidence: {provider.confidence}.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Model breakdown</Text>
          <Text style={styles.row}>Primary model · {provider.secondaryMetric}</Text>
          <Text style={styles.row}>Pricing source · public catalogue</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Connector limitations</Text>
          <Text style={styles.body}>Consumer plans stay separate from API usage. Manual values never display as exact.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 10 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "900" },
  subtitle: { color: "#8b8b91", fontSize: 15, marginBottom: 4 },
  card: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14 },
  label: { color: "#8b8b91", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  big: { color: "#f4f4f5", fontSize: 32, fontWeight: "900", marginTop: 8 },
  body: { color: "#a1a1aa", fontSize: 14, lineHeight: 20, marginTop: 6 },
  row: { color: "#e4e4e7", fontSize: 15, fontWeight: "700", paddingTop: 12 }
});
