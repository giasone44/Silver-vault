import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";
import type { Photo } from "./types";

// Enough to read dates and mint marks, small enough for a local model on an 8 GB Mac.
const MAX_EDGE = 1280;

/** Downscale to keep uploads small while leaving enough detail to read dates and mint marks. */
async function toPhoto(asset: ImagePicker.ImagePickerAsset): Promise<Photo> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    ctx.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!out.base64) throw new Error("Could not encode photo");
  return { uri: out.uri, base64: out.base64, mediaType: "image/jpeg" };
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
