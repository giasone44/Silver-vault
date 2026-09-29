import * as Haptics from "expo-haptics";
import { Platform, StyleSheet, type TextStyle } from "react-native";

/**
 * "Grand Complication" palette: a black lacquer dial, ivory lume, applied
 * gold indices, and brushed steel. Warm neutrals keep hairlines from
 * reading as cold UI grey.
 */
export const colors = {
  bg: "#09090B",
  dial: "#101115",
  dialLight: "#1B1D23",
  surface: "#131419",
  hairline: "#2A2823",
  hairlineStrong: "#3D392F",
  ivory: "#EEE6D2",
  ivoryDim: "#BDB39C",
  muted: "#7F7867",
  gold: "#C9A55E",
  goldBright: "#E6C888",
  goldDeep: "#8A6B30",
  steel: "#CDD1D7",
  steelDim: "#8C929A",
  blued: "#3E5C9A",
  ruby: "#8E1F2A",
  up: "#93B38D",
  down: "#C4665D",
  paper: "#EFE7D5",
  paperEdge: "#D9CDB3",
  ink: "#2A2419",
  inkMuted: "#6F6553",
};

export const fonts = {
  engraved: "Cinzel_500Medium",
  engravedBold: "Cinzel_600SemiBold",
  serif: "CormorantGaramond_500Medium",
  serifItalic: "CormorantGaramond_500Medium_Italic",
  serifBold: "CormorantGaramond_700Bold",
  numeral: "BodoniModa_500Medium",
  numeralBold: "BodoniModa_600SemiBold",
};

const lining: TextStyle["fontVariant"] = ["lining-nums", "tabular-nums"];

/** Typographic presets. Custom families carry their own weight, so no fontWeight. */
export const type = StyleSheet.create({
  brand: { fontFamily: fonts.engravedBold, color: colors.ivory, fontSize: 17, letterSpacing: 5 },
  label: { fontFamily: fonts.engraved, color: colors.muted, fontSize: 10, letterSpacing: 2.2, textTransform: "uppercase" },
  labelGold: { fontFamily: fonts.engraved, color: colors.gold, fontSize: 10, letterSpacing: 2.4, textTransform: "uppercase" },
  section: { fontFamily: fonts.engravedBold, color: colors.ivoryDim, fontSize: 11, letterSpacing: 3, textTransform: "uppercase" },
  title: { fontFamily: fonts.serifBold, color: colors.ivory, fontSize: 28, lineHeight: 32 },
  heading: { fontFamily: fonts.serifBold, color: colors.ivory, fontSize: 19, lineHeight: 23 },
  body: { fontFamily: fonts.serif, color: colors.ivory, fontSize: 17, lineHeight: 23 },
  bodyMuted: { fontFamily: fonts.serif, color: colors.ivoryDim, fontSize: 15, lineHeight: 20 },
  italic: { fontFamily: fonts.serifItalic, color: colors.ivoryDim, fontSize: 15, lineHeight: 20 },
  figure: { fontFamily: fonts.numeral, color: colors.ivory, fontSize: 17, fontVariant: lining },
  figureLarge: { fontFamily: fonts.numeral, color: colors.ivory, fontSize: 40, fontVariant: lining, letterSpacing: -0.5 },
});

export const hairline = StyleSheet.hairlineWidth;

/** Animated's native driver isn't available on web. */
export const nativeDriver = Platform.OS !== "web";

export const haptic = {
  select: () => Platform.OS !== "web" && Haptics.selectionAsync().catch(() => {}),
  tap: () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  press: () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

/** Degrees → point on a circle, 0° at 12 o'clock, clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
