import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabIcon = (name: keyof typeof Ionicons.glyphMap) =>
  function Icon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

const webTabs: Record<string, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  dashboard: { title: "Dashboard", icon: "analytics" },
  compare: { title: "Compare", icon: "git-compare" },
  "models-table": { title: "Models", icon: "list" },
  providers: { title: "Providers", icon: "server" },
  alerts: { title: "Alerts", icon: "warning" },
  settings: { title: "Settings", icon: "settings" }
};

function WebTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.webTabBar}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const item = webTabs[route.name] ?? {
          title: descriptors[route.key]?.options?.title ?? route.name,
          icon: "ellipse"
        };
        const color = focused ? "#f4f4f5" : "#737373";

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
            style={styles.webTabItem}
          >
            <Ionicons name={item.icon} color={color} size={25} />
            <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.webTabLabel, { color }]}>
              {item.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "web" ? 0 : insets.bottom;
  const tabBarHeight = Platform.OS === "web" ? 84 : 64 + bottomInset;
  const tabBarPaddingBottom = Platform.OS === "web" ? 20 : bottomInset || 8;

  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      tabBar={Platform.OS === "web" ? (props) => <WebTabBar {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#f4f4f5",
        tabBarInactiveTintColor: "#737373",
        tabBarStyle: {
          backgroundColor: "#09090b",
          borderTopColor: "#222225",
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarPaddingBottom
        },
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

const styles = StyleSheet.create({
  webTabBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: -52,
    height: 136,
    paddingTop: 8,
    paddingBottom: 20,
    backgroundColor: "#09090b",
    borderTopColor: "#222225",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    zIndex: 2147483647
  } as unknown as ViewStyle,
  webTabItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 2
  },
  webTabLabel: {
    maxWidth: "100%",
    fontSize: 11,
    fontWeight: "600"
  }
});
