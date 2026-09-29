import { ActionSheetIOS, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { capturePhoto } from "../lib/photos";
import { colors } from "../lib/theme";
import type { Photo } from "../lib/types";

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

export function PhotoPair({
  photos,
  existing,
  onChange,
}: {
  photos: Record<Side, Photo | null>;
  /** URLs of already-saved photos, shown until replaced. */
  existing?: Partial<Record<Side, string | null>>;
  onChange: (side: Side, photo: Photo) => void;
}) {
  const pick = (side: Side) =>
    choose(async (source) => {
      try {
        const p = await capturePhoto(source);
        if (p) onChange(side, p);
      } catch (e) {
        Alert.alert("Photo failed", e instanceof Error ? e.message : String(e));
      }
    });

  return (
    <View style={styles.row}>
      {(["obverse", "reverse"] as const).map((side) => {
        const uri = photos[side]?.uri ?? existing?.[side] ?? null;
        return (
          <Pressable key={side} onPress={() => pick(side)} style={styles.slot}>
            {uri ? (
              <Image source={{ uri }} style={styles.img} resizeMode="cover" />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.plus}>＋</Text>
                <Text style={styles.hint}>{side === "obverse" ? "Front" : "Back"}</Text>
              </View>
            )}
            <Text style={styles.caption}>{side === "obverse" ? "Obverse (front)" : "Reverse (back)"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  slot: { flex: 1, alignItems: "center", gap: 6 },
  img: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.cardAlt },
  empty: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { color: colors.silver, fontSize: 32 },
  hint: { color: colors.muted, fontSize: 13 },
  caption: { color: colors.muted, fontSize: 12 },
});
