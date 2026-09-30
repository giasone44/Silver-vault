import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { notify } from "../lib/notify";
import { capturePhoto } from "../lib/photos";
import { colors, fonts, haptic, hairline, type } from "../lib/theme";
import type { Photo } from "../lib/types";
import { choosePhotoSource } from "./PhotoPair";

export const MAX_EXTRAS = 4;
const TILE = 72;

/**
 * Optional supporting photos: a receipt, certificate of authenticity, sealed
 * tube or box, or printed information. Claude reads them with the piece.
 */
export function ExtraPhotos({ photos, onChange }: { photos: Photo[]; onChange: (photos: Photo[]) => void }) {
  const add = () =>
    choosePhotoSource(async (source) => {
      try {
        const p = await capturePhoto(source);
        if (p) {
          haptic.success();
          onChange([...photos, p].slice(0, MAX_EXTRAS));
        }
      } catch (e) {
        notify("Photo failed", e instanceof Error ? e.message : String(e));
      }
    });

  return (
    <View style={styles.wrap}>
      <Text style={type.labelGold}>Extra photos · optional</Text>
      <Text style={[type.italic, { fontSize: 14, marginTop: 2 }]}>
        Receipt, certificate, sealed tube or box, printed info. A receipt fills in what you paid.
      </Text>
      <View style={styles.row}>
        {photos.map((p, i) => (
          <Pressable
            key={p.uri}
            onPress={() => { haptic.select(); onChange(photos.filter((_, j) => j !== i)); }}
            accessibilityLabel={`Remove extra photo ${i + 1}`}
          >
            <Image source={{ uri: p.uri }} style={styles.tile} />
            <View style={styles.remove}><Text style={styles.removeText}>×</Text></View>
          </Pressable>
        ))}
        {photos.length < MAX_EXTRAS && (
          <Pressable onPress={add} style={[styles.tile, styles.addTile]} accessibilityLabel="Add extra photo">
            <Text style={styles.plus}>+</Text>
            <Text style={styles.addLabel}>Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Saved extra photos on a piece's page. Tap one to open it full size. */
export function SavedExtras({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <View style={[styles.row, { justifyContent: "center" }]}>
      {urls.map((u) => (
        <Pressable key={u} onPress={() => Linking.openURL(u)} accessibilityLabel="Open supporting photo">
          <Image source={{ uri: u }} style={styles.tile} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 22 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  tile: { width: TILE, height: TILE, borderRadius: 6, borderWidth: hairline, borderColor: colors.hairlineStrong, backgroundColor: colors.surface },
  addTile: { alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderColor: colors.goldDeep },
  plus: { color: colors.gold, fontSize: 24, lineHeight: 26, fontFamily: fonts.engraved },
  addLabel: { color: colors.muted, fontSize: 9, letterSpacing: 1.5, fontFamily: fonts.engraved, textTransform: "uppercase" },
  remove: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.gold, alignItems: "center", justifyContent: "center" },
  removeText: { color: colors.gold, fontSize: 14, lineHeight: 16 },
});
