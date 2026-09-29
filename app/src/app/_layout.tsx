import { router, Stack } from "expo-router";
import { Platform, Pressable, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SettingsProvider } from "../lib/settings";
import { SpotProvider } from "../lib/spot";
import { colors } from "../lib/theme";

// iOS dismisses modals with a swipe; the web build needs an explicit button.
const modalCancel =
  Platform.OS === "web"
    ? () => (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ paddingLeft: 16 }}>
          <Text style={{ color: colors.silver, fontSize: 15, fontWeight: "600" }}>Cancel</Text>
        </Pressable>
      )
    : undefined;

export default function RootLayout() {
  return (
    <SettingsProvider>
      <SpotProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Silver Vault" }} />
          <Stack.Screen name="add" options={{ title: "Add Item", presentation: "modal", headerLeft: modalCancel }} />
          <Stack.Screen name="item/[id]" options={{ title: "" }} />
          <Stack.Screen name="edit/[id]" options={{ title: "Edit Item", presentation: "modal", headerLeft: modalCancel }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
        </Stack>
      </SpotProvider>
    </SettingsProvider>
  );
}
