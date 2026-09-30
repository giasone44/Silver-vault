import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";
import type { Photo } from "./types";

/** Saved photo, also what Claude reads: the most detail it can use (1568 px), so small legends and certificates stay legible. */
const SAVE_EDGE = 1568;
/** Smaller copy for the free on-Mac AI, which slows down steeply with image size. */
const AI_EDGE = 768;

async function encode(asset: ImagePicker.ImagePickerAsset, edge: number, compress: number) {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > edge) {
    ctx.resize(asset.width >= asset.height ? { width: edge } : { height: edge });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  if (!out.base64) throw new Error("Could not encode photo");
  return out;
}

async function toPhoto(asset: ImagePicker.ImagePickerAsset): Promise<Photo> {
  const [full, small] = await Promise.all([encode(asset, SAVE_EDGE, 0.88), encode(asset, AI_EDGE, 0.8)]);
  return { uri: full.uri, base64: full.base64!, aiBase64: small.base64!, mediaType: "image/jpeg" };
}

export async function capturePhoto(source: "camera" | "library"): Promise<Photo | null> {
  if (source === "camera" && Platform.OS !== "web") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera access needed", "Enable camera access for Silver Vault in Settings.");
      return null;
    }
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
  const result =
    source === "camera" && Platform.OS !== "web"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled || !result.assets[0]) return null;
  return toPhoto(result.assets[0]);
}
