import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const rows = ["Preferred currency: USD", "Monthly AI budget: $120", "Timezone: Australia/Melbourne", "Pricing refresh: daily"];

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>
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
  row: { minHeight: 54, justifyContent: "center", borderBottomColor: "#222225", borderBottomWidth: 1 },
  rowText: { color: "#e4e4e7", fontSize: 16, fontWeight: "600" }
});
