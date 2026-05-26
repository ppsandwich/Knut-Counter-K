import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { blurActiveElement } from "../lib/focus";

export function BackButton({ fallbackHref = "/providers" }: { fallbackHref?: string }) {
  const router = useRouter();

  function goBack() {
    blurActiveElement();

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={goBack}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" color="#f4f4f5" size={20} />
      <Text style={styles.label}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#242428",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 3,
    minHeight: 38,
    paddingLeft: 9,
    paddingRight: 12
  },
  label: {
    color: "#f4f4f5",
    fontSize: 14,
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.72
  }
});
