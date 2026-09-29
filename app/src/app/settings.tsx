import { useEffect, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Reveal } from "../components/motion";
import { Button, Field, Row, SectionTitle } from "../components/ui";
import { createApi } from "../lib/api";
import { useSettings } from "../lib/settings";
import { useSpot } from "../lib/spot";
import { colors, haptic, type } from "../lib/theme";
import type { Health } from "../lib/types";


function notify(title: string, msg: string) {
  if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export default function SettingsScreen() {
  const { settings, save } = useSettings();
  const { refresh } = useSpot();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [token, setToken] = useState(settings.token);
  const [spotSeconds, setSpotSeconds] = useState(String(settings.spotRefreshSeconds));
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [aiKey, setAiKey] = useState("");

  useEffect(() => {
    createApi(settings).health().then(setHealth).catch(() => {});
  }, [settings]);

  const saveKey = async () => {
    setBusy("key");
    try {
      await createApi(draft()).saveAiKey(aiKey.trim());
      setAiKey("");
      setHealth(await createApi(draft()).health());
      haptic.success();
      notify("Claude connected", "Identification and market research now use Claude.");
    } catch (e) {
      haptic.error();
      notify("Key not saved", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const draft = () => ({
    serverUrl: serverUrl.trim().replace(/\/+$/, ""),
    token: token.trim(),
    spotRefreshSeconds: Math.max(10, parseInt(spotSeconds, 10) || 30),
  });

  const test = async () => {
    setBusy("test");
    try {
      const api = createApi(draft());
      const h = await api.health();
      await api.items(); // verifies the token
      setHealth(h);
      await save(draft());
      void refresh();
      haptic.success();
    } catch (e) {
      setHealth(null);
      haptic.error();
      notify("Connection failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const revalue = async () => {
    setBusy("revalue");
    try {
      const { queued } = await createApi(draft()).revalue(24);
      haptic.success();
      notify("Reports scheduled", `${queued} piece(s) with reports older than 24 hours are being re-researched in the background.`);
    } catch (e) {
      notify("Failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <SectionTitle>Claude · Best Accuracy</SectionTitle>
      {health?.ai_provider === "claude" ? (
        <Text style={[type.body, { color: colors.up }]}>Connected · {health.ai_model}</Text>
      ) : (
        <View style={{ gap: 14 }}>
          <Text style={type.bodyMuted}>
            Claude reads dates, mint marks, slabs and refiner hallmarks with expert accuracy in seconds, and researches
            actual sold prices. About 2–5¢ per identification and 10–40¢ per market report, billed by Anthropic.
          </Text>
          <Button title="1 · Get a key" kind="secondary" onPress={() => Linking.openURL("https://console.anthropic.com/settings/keys")} />
          <Field label="2 · Paste your key" value={aiKey} onChangeText={setAiKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="sk-ant-…" />
          <Button title="3 · Save" onPress={saveKey} busy={busy === "key"} disabled={!aiKey.trim()} />
        </View>
      )}

      <SectionTitle>Connection</SectionTitle>
      <View style={{ gap: 22 }}>
        <Field label="Server address" value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://vault.example.com" />
        <Field label="Access token" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <Field label="Spot refresh · seconds" value={spotSeconds} onChangeText={setSpotSeconds} keyboardType="number-pad" />
        <Button title="Test & save" onPress={test} busy={busy === "test"} />
      </View>

      {health && (
        <Reveal style={{ marginTop: 18 }}>
          <Row
            label={health.ai_provider === "ollama" ? "Photo reading · on this Mac" : "Photo reading · Claude"}
            value={
              <Text style={[type.body, { color: health.ai ? colors.up : colors.down }]}>
                {health.ai ? `Ready · ${health.ai_model}` : health.ai_detail ?? "API key missing"}
              </Text>
            }
          />
          <Row label="Numista catalogue" value={health.catalog ? "Connected" : "Not connected"} />
          <Row label="Spot source" value={health.spot_provider} />
          <Row label="eBay listings" value={health.ebay ? "Connected" : "Not configured"} />
          <Row label="eBay sold data" value={health.ebay_sold_data ? "Connected" : "Not enabled"} />
        </Reveal>
      )}

      <SectionTitle>Register</SectionTitle>
      <View style={{ gap: 12 }}>
        <Button title="Refresh stale reports" kind="secondary" onPress={revalue} busy={busy === "revalue"} />
        <Button title="Export register · CSV" kind="secondary" onPress={() => Linking.openURL(createApi(draft()).exportUrl())} />
      </View>

      <Text style={[type.italic, { marginTop: 30, fontSize: 14, lineHeight: 20 }]}>
        Spot prices are refreshed automatically. Bullion values move with spot, keeping the premium found in the most
        recent market report; numismatic values hold until the report is refreshed. Photographs and records are kept on
        your server.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, paddingBottom: 60, width: "100%", maxWidth: 720, alignSelf: "center" },
});
