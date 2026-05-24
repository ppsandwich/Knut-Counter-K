import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const options = ["API key", "Manual tracking", "CSV/JSON import"];

export default function AddProviderScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Provider</Text>
        <Text style={styles.subtitle}>Connect an API account, or track a plan manually when providers keep the useful numbers hidden.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Provider</Text>
          <TextInput placeholder="OpenAI API" placeholderTextColor="#63636a" style={styles.input} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Connection method</Text>
          {options.map((option) => (
            <View key={option} style={styles.option}>
              <Text style={styles.optionText}>{option}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Caps and budget</Text>
          <TextInput defaultValue="$25 monthly budget" style={styles.input} />
          <TextInput defaultValue="Resets monthly" style={styles.input} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050506" },
  content: { padding: 16, gap: 12 },
  title: { color: "#f5f5f5", fontSize: 34, fontWeight: "900" },
  subtitle: { color: "#8b8b91", fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: "#111113", borderColor: "#242428", borderWidth: 1, borderRadius: 8, padding: 14, gap: 10 },
  label: { color: "#8b8b91", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  input: { color: "#f4f4f5", backgroundColor: "#09090b", borderColor: "#29292d", borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, minHeight: 44, fontSize: 16 },
  option: { minHeight: 44, borderColor: "#29292d", borderWidth: 1, borderRadius: 7, justifyContent: "center", paddingHorizontal: 12 },
  optionText: { color: "#f4f4f5", fontSize: 15, fontWeight: "800" }
});
