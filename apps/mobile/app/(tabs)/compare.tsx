import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CompareScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Compare</Text>
        <View style={styles.panel}>
          <Text style={styles.label}>Task</Text>
          <TextInput placeholder="Summarise a messy PDF" placeholderTextColor="#63636a" style={styles.input} />
          <View style={styles.grid}>
            <View style={styles.field}>
              <Text style={styles.label}>Input tokens</Text>
              <TextInput defaultValue="12000" keyboardType="number-pad" style={styles.input} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Output tokens</Text>
              <TextInput defaultValue="1800" keyboardType="number-pad" style={styles.input} />
            </View>
          </View>
        </View>
        <View style={styles.reco}>
          <Text style={styles.kicker}>Recommended</Text>
          <Text style={styles.model}>Gemini 2.0 Flash</Text>
          <Text style={styles.cost}>~$0.004</Text>
          <Text style={styles.reason}>Cheap, fast, and safely under cap. Claude can do it, but it is already crispy.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 12 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "800" },
  panel: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  label: { color: "#8b8b91", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  input: { color: "#f4f4f5", backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  grid: { flexDirection: "row", gap: 10 },
  field: { flex: 1, gap: 6 },
  reco: { backgroundColor: "#132016", borderColor: "#1f4d2a", borderWidth: 1, borderRadius: 8, padding: 14 },
  kicker: { color: "#22c55e", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  model: { color: "#f4f4f5", fontSize: 22, fontWeight: "900", marginTop: 6 },
  cost: { color: "#86efac", fontSize: 30, fontWeight: "900", marginTop: 4 },
  reason: { color: "#b7c4ba", fontSize: 14, lineHeight: 20, marginTop: 6 }
});
