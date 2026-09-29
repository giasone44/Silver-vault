import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { emptyInput, inputFromIdentification, ItemForm, useItemDraft } from "../components/ItemForm";
import { PhotoPair } from "../components/PhotoPair";
import { Button, Card } from "../components/ui";
import { useApi } from "../lib/api";
import { colors } from "../lib/theme";
import type { Identification, Photo } from "../lib/types";

export default function AddItem() {
  const api = useApi();
  const [photos, setPhotos] = useState<{ obverse: Photo | null; reverse: Photo | null }>({ obverse: null, reverse: null });
  const [ident, setIdent] = useState<Identification | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<"identify" | "save" | null>(null);
  const form = useItemDraft(emptyInput());

  const runIdentify = async () => {
    if (!photos.obverse) return;
    setBusy("identify");
    try {
      const result = await api.identify(photos.obverse, photos.reverse);
      setIdent(result);
      form.reset(inputFromIdentification(result, form.value()));
      setShowForm(true);
    } catch (e) {
      Alert.alert("Couldn't identify", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const input = form.value();
    if (!input.name) return Alert.alert("Name required", "Give the item a name.");
    setBusy("save");
    try {
      const item = await api.create(input, photos.obverse, photos.reverse);
      router.replace({ pathname: "/item/[id]", params: { id: item.id, autovalue: "1" } });
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.h}>1. Photograph both sides</Text>
        <Text style={styles.p}>
          Fill the frame, use even light, avoid glare. For slabs, make sure the label is readable.
        </Text>
        <PhotoPair photos={photos} onChange={(side, p) => setPhotos((s) => ({ ...s, [side]: p }))} />
        <View style={{ height: 14 }} />
        <Button title={ident ? "Identify again" : "Identify with AI"} onPress={runIdentify} busy={busy === "identify"} disabled={!photos.obverse} />
        {busy === "identify" && <Text style={[styles.p, { textAlign: "center", marginTop: 8 }]}>Reading legends, dates and mint marks…</Text>}
        {!showForm && (
          <Button title="Skip — enter details manually" kind="secondary" onPress={() => setShowForm(true)} style={{ marginTop: 10 }} />
        )}

        {ident && (
          <Card style={{ marginTop: 16, gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Identified with {Math.round(ident.confidence * 100)}% confidence
            </Text>
            {ident.notes_for_user && <Text style={{ color: colors.gold }}>{ident.notes_for_user}</Text>}
            <Text style={styles.p}>Review and correct anything below, then add what you paid.</Text>
          </Card>
        )}

        {showForm && (
          <>
            <Text style={[styles.h, { marginTop: 24 }]}>2. Confirm details</Text>
            <ItemForm form={form} />
            <View style={{ height: 20 }} />
            <Button title="Save & get market value" onPress={save} busy={busy === "save"} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 80, width: "100%", maxWidth: 760, alignSelf: "center" },
  h: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 6 },
  p: { color: colors.muted, fontSize: 13, marginBottom: 12 },
});
