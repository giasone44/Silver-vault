import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { capturePhoto } from "../lib/photos";
import { haptic, type } from "../lib/theme";
import type { Photo } from "../lib/types";
import { CoinFrame } from "./watch";

type Side = "obverse" | "reverse";

function choose(onPick: (source: "camera" | "library") => void) {
  if (Platform.OS === "web") return onPick("library");
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ["Take Photo", "Choose from Library", "Cancel"], cancelButtonIndex: 2 },
      (i) => i < 2 && onPick(i === 0 ? "camera" : "library"),
    );
  } else {
    Alert.alert("Add photo", undefined, [
      { text: "Camera", onPress: () => onPick("camera") },
      { text: "Library", onPress: () => onPick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }
}

export function PhotoPair({ photos, existing, onChange, size = 150 }: {
  photos: Record<Side, Photo | null>;
  /** URLs of already-saved photos, shown until replaced. */
  existing?: Partial<Record<Side, string | null>>;
  onChange: (side: Side, photo: Photo) => void;
  size?: number;
}) {
  const pick = (side: Side) =>
    choose(async (source) => {
      try {
        const p = await capturePhoto(source);
        if (p) {
          haptic.success();
          onChange(side, p);
        }
      } catch (e) {
        Alert.alert("Photo failed", e instanceof Error ? e.message : String(e));
      }
    });

  return (
    <View style={styles.row}>
      {(["obverse", "reverse"] as const).map((side) => (
        <View key={side} style={styles.slot}>
          <CoinFrame
            size={size}
            front={photos[side]?.uri ?? existing?.[side] ?? null}
            onPress={() => pick(side)}
            placeholder={side === "obverse" ? "+  Obverse" : "+  Reverse"}
          />
          <Text style={[type.label, { fontSize: 9 }]}>{side === "obverse" ? "Obverse · Front" : "Reverse · Back"}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-evenly" },
  slot: { alignItems: "center", gap: 10 },
});
