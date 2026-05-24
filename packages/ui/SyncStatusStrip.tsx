import { StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";

export function SyncStatusStrip({ status }: { status: string }) {
  return (
    <View style={styles.strip}>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, minHeight: 42, justifyContent: "center" },
  text: { color: colors.muted, fontSize: 13, fontWeight: "700" }
});
