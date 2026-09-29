import { router } from "expo-router";
import { PressableScale } from "../components/motion";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { CatalogPicker } from "../components/CatalogPicker";
import { emptyInput, inputFromIdentification, inputWithCatalog, ItemForm, useItemDraft } from "../components/ItemForm";
import { Reveal } from "../components/motion";
import { PhotoPair } from "../components/PhotoPair";
import { Button } from "../components/ui";
import { Subdial, Working } from "../components/watch";
import { useApi } from "../lib/api";
import { colors, fonts, haptic, hairline, type } from "../lib/theme";
import type { Health, Identification, Photo } from "../lib/types";

export default function AddItem() {
  const api = useApi();
  const [photos, setPhotos] = useState<{ obverse: Photo | null; reverse: Photo | null }>({ obverse: null, reverse: null });
  const [ident, setIdent] = useState<Identification | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<"identify" | "save" | null>(null);
  const form = useItemDraft(emptyInput());
  const [health, setHealth] = useState<Health | null>(null);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const local = health?.ai_provider === "ollama";

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    // Load the AI model now, while photos are being taken, so identifying starts straight away.
    api.warmup().catch(() => {});
  }, [api]);

  const runIdentify = async () => {
    if (!photos.obverse) return;
    setBusy("identify");
    try {
      const result = await api.identify(photos.obverse, photos.reverse, local);
      setIdent(result);
      form.reset(inputFromIdentification(result, form.value()));
      setShowForm(true);
      haptic.success();
    } catch (e) {
      haptic.error();
      Alert.alert("Couldn't identify", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const input = form.value();
    if (!input.name) return Alert.alert("Name required", "Give the piece a name.");
    setBusy("save");
    try {
      const item = await api.create(input, photos.obverse, photos.reverse);
      haptic.success();
      router.replace({ pathname: "/item/[id]", params: { id: item.id } });
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {health && (local || !health.ai) && (
          <PressableScale onPress={() => router.push("/settings")} style={styles.upgrade}>
            <Text style={type.labelGold}>{local ? "Using the free on-Mac AI" : "Connect Claude to identify pieces"}</Text>
            <Text style={[type.bodyMuted, { marginTop: 4 }]}>
              {local ? "Slower and less accurate. Tap to add Claude for expert results in seconds." : "Tap here, then paste your Claude key under Settings. It takes a minute."}
            </Text>
          </PressableScale>
        )}
        <Step numeral="I" title="Photograph both faces" note="Fill the frame, soft even light, no glare. For slabs, keep the label legible." />
        <PhotoPair photos={photos} onChange={(side, p) => setPhotos((s) => ({ ...s, [side]: p }))} />

        <View style={{ marginTop: 24 }}>
          {busy === "identify" ? (
            <Working
              title="Examining"
              detail="Reading legends, dates and mint marks…"
              timer
            />
          ) : (
            <Button title={ident ? "Examine again" : "Identify piece"} onPress={runIdentify} disabled={!photos.obverse} />
          )}
          {!showForm && busy !== "identify" && (
            <Button title="Enter details by hand" kind="secondary" onPress={() => setShowForm(true)} style={{ marginTop: 12 }} />
          )}
        </View>

        {ident && (
          <Reveal style={styles.verdict}>
            <Subdial size={70} symbol="%" change={ident.confidence * 6 - 3} accent={colors.goldBright} ends={["", ""]} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={type.labelGold}>Identified · {Math.round(ident.confidence * 100)}% confidence</Text>
              <Text style={type.heading}>{ident.name}</Text>
              {ident.notes_for_user && <Text style={[type.italic, { color: colors.goldBright }]}>{ident.notes_for_user}</Text>}
            </View>
          </Reveal>
        )}

        {showForm && (
          <Reveal>
            <Step numeral="II" title="Save it" note="Add what you paid if you know it. Everything else is researched for you after saving." />
            <ItemForm
              form={form}
              collapsible={Boolean(ident)}
              catalog={
                health?.catalog ? (
                  <View style={{ marginTop: 18, marginBottom: 8 }}>
                    <Text style={[type.labelGold, { marginBottom: 6 }]}>Catalogue match · exact specifications</Text>
                    <CatalogPicker
                      key={ident?.search_query ?? "manual"}
                      initialQuery={ident?.search_query ?? ""}
                      itemType={ident?.item_type}
                      selectedId={catalogId}
                      autoApply={Boolean(ident)}
                      at={() => {
                        const v = form.value();
                        return { year: v.year, mintMark: v.mint_mark };
                      }}
                      onApply={(c) => {
                        setCatalogId(c.numista_id);
                        form.reset(inputWithCatalog(form.value(), c));
                      }}
                    />
                  </View>
                ) : null
              }
            />
            <Button title="Enter into register" onPress={save} busy={busy === "save"} style={{ marginTop: 30 }} />
            <Text style={[type.italic, { textAlign: "center", marginTop: 10, fontSize: 13 }]}>
              Its dossier and market value are researched automatically once saved.
            </Text>
          </Reveal>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ numeral, title, note }: { numeral: string; title: string; note: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.numeral}>{numeral}</Text>
      <View style={{ flex: 1 }}>
        <Text style={type.heading}>{title}</Text>
        <Text style={[type.italic, { marginTop: 2 }]}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 80, width: "100%", maxWidth: 720, alignSelf: "center" },
  step: { flexDirection: "row", gap: 14, alignItems: "flex-start", marginTop: 34, marginBottom: 22 },
  numeral: { fontFamily: fonts.engravedBold, color: colors.gold, fontSize: 22, width: 34, textAlign: "center", marginTop: -2 },
  upgrade: { borderWidth: hairline, borderColor: colors.goldDeep, padding: 14, marginTop: 16 },
  verdict: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginTop: 26,
    paddingVertical: 16,
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderColor: colors.hairlineStrong,
  },
});
