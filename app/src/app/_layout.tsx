import { BodoniModa_500Medium, BodoniModa_600SemiBold, useFonts as useBodoni } from "@expo-google-fonts/bodoni-moda";
import { Cinzel_500Medium, Cinzel_600SemiBold, useFonts as useCinzel } from "@expo-google-fonts/cinzel";
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_700Bold,
  useFonts as useCormorant,
} from "@expo-google-fonts/cormorant-garamond";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, Text, View } from "react-native";
import { SettingsProvider } from "../lib/settings";
import { SpotProvider } from "../lib/spot";
import { colors, fonts } from "../lib/theme";

// iOS dismisses modals with a swipe; the web build needs an explicit button.
const modalCancel =
  Platform.OS === "web"
    ? () => (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ paddingLeft: 16 }}>
          <Text style={{ color: colors.gold, fontFamily: fonts.engraved, fontSize: 11, letterSpacing: 2 }}>CANCEL</Text>
        </Pressable>
      )
    : undefined;

export default function RootLayout() {
  const [a] = useCinzel({ Cinzel_500Medium, Cinzel_600SemiBold });
  const [b] = useCormorant({ CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_700Bold });
  const [c] = useBodoni({ BodoniModa_500Medium, BodoniModa_600SemiBold });
  if (!(a && b && c)) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SettingsProvider>
      <SpotProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.gold,
            headerTitleStyle: { fontFamily: fonts.engravedBold, fontSize: 13, color: colors.ivory },
            headerTitleAlign: "center",
            headerShadowVisible: false,
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, title: "Silver Vault" }} />
          <Stack.Screen name="add" options={{ title: "NEW ACQUISITION", presentation: "modal", headerLeft: modalCancel }} />
          <Stack.Screen name="item/[id]" options={{ title: "" }} />
          <Stack.Screen name="edit/[id]" options={{ title: "AMEND RECORD", presentation: "modal", headerLeft: modalCancel }} />
          <Stack.Screen name="settings" options={{ title: "SETTINGS" }} />
        </Stack>
      </SpotProvider>
    </SettingsProvider>
  );
}
