import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { emptyInput, ItemForm, useItemDraft } from "../../components/ItemForm";
import { PhotoPair } from "../../components/PhotoPair";
import { Button, SectionTitle } from "../../components/ui";
import { BalanceWheel } from "../../components/watch";
import { useApi } from "../../lib/api";
import { colors } from "../../lib/theme";
import type { Item, ItemInput, Photo } from "../../lib/types";

export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [item, setItem] = useState<Item | null>(null);
  const [photos, setPhotos] = useState<{ obverse: Photo | null; reverse: Photo | null }>({ obverse: null, reverse: null });
  const [busy, setBusy] = useState(false);
  const form = useItemDraft(emptyInput());

  useEffect(() => {
    api.item(id).then((it) => {
      setItem(it);
      const { id: _id, obverse_photo, reverse_photo, valuation, created_at, updated_at, history, ...input } = it;
      form.reset(input as ItemInput);
    }).catch((e) => Alert.alert("Load failed", String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, id]);

  if (!item) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}><BalanceWheel size={56} /></View>;

  const save = async () => {
    setBusy(true);
    try {
      await api.update(id, form.value(), photos.obverse, photos.reverse);
      router.back();
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80, width: "100%", maxWidth: 760, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <SectionTitle>Photographs</SectionTitle>
        <PhotoPair
          photos={photos}
          existing={{ obverse: api.photoUrl(item.obverse_photo), reverse: api.photoUrl(item.reverse_photo) }}
          onChange={(side, p) => setPhotos((s) => ({ ...s, [side]: p }))}
        />
        <View style={{ height: 8 }} />
        <ItemForm form={form} />
        <View style={{ height: 20 }} />
        <Button title="Save amendments" onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
