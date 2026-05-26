import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabIcon = (name: keyof typeof Ionicons.glyphMap) =>
  function Icon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const tabBarStyle =
    Platform.OS === "web"
      ? {
          backgroundColor: "#09090b",
          borderTopColor: "#222225",
          height: 84,
          paddingTop: 8,
          paddingBottom: 20
        }
      : {
          backgroundColor: "#09090b",
          borderTopColor: "#222225",
          height: 64 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset || 8
        };

  return (
    <Tabs
      safeAreaInsets={Platform.OS === "web" ? { bottom: 0 } : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#f4f4f5",
        tabBarInactiveTintColor: "#737373",
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: tabIcon("analytics") }} />
      <Tabs.Screen name="compare" options={{ title: "Compare", tabBarIcon: tabIcon("git-compare") }} />
      <Tabs.Screen name="models-table" options={{ title: "Models", tabBarIcon: tabIcon("list") }} />
      <Tabs.Screen name="providers" options={{ title: "Providers", tabBarIcon: tabIcon("server") }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts", tabBarIcon: tabIcon("warning") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: tabIcon("settings") }} />
    </Tabs>
  );
}
