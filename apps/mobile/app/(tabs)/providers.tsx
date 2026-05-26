import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProviderUsageRow } from "@knut/ui";
import { useDashboardData } from "../../hooks/useDashboardData";
import { syncProviders } from "../../lib/accountApi";
import { blurActiveElement } from "../../lib/focus";

export default function ProvidersScreen() {
  const dashboard = useDashboardData();
  const router = useRouter();
  const providerRows = dashboard.providerRows;
  const signedIn = Boolean(dashboard.auth.user);
  const [refreshingProviderId, setRefreshingProviderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshProvider(providerAccountId: string) {
    if (refreshingProviderId) return;

    setRefreshingProviderId(providerAccountId);
    setMessage(null);
    try {
      const result = await syncProviders(providerAccountId);
      await dashboard.refresh();
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider refresh failed.");
    } finally {
      setRefreshingProviderId(null);
    }
  }

  function openProvider(providerAccountId: string) {
    blurActiveElement();
    router.push(`/provider/${providerAccountId}`);
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Providers</Text>
          <Link href="/add-provider" style={styles.add}>Add</Link>
        </View>
        <Text style={styles.subtitle}>Connected accounts and manual plans, kept separate so the numbers do not tell fibs.</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
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
          providerRows.map((provider) => {
            const isRefreshing = refreshingProviderId === provider.providerId;
            return (
              <View key={provider.providerId} style={styles.providerItem}>
                <ProviderUsageRow provider={provider} onPress={() => openProvider(provider.providerId)} />
                <Pressable disabled={Boolean(refreshingProviderId)} onPress={() => refreshProvider(provider.providerId)} style={({ pressed }) => [styles.refreshButton, refreshingProviderId !== null && styles.disabled, pressed && styles.pressed]}>
                  <Text style={styles.refreshButtonText}>{isRefreshing ? "Refreshing..." : "Refresh provider"}</Text>
                </Pressable>
              </View>
            );
          })
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
  message: { color: "#a1a1aa", fontSize: 13, fontWeight: "700" },
  providerItem: { gap: 8 },
  refreshButton: { minHeight: 38, borderRadius: 7, backgroundColor: "#1f1f23", borderColor: "#34343a", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  refreshButtonText: { color: "#e4e4e7", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  emptyCard: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 6 },
  emptyTitle: { color: "#f4f4f5", fontSize: 16, fontWeight: "900" },
  emptyBody: { color: "#a1a1aa", fontSize: 14, lineHeight: 20 }
});
