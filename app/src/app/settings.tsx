import { useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Field, Row, SectionTitle } from "../components/ui";
import { createApi } from "../lib/api";
import { useSettings } from "../lib/settings";
import { useSpot } from "../lib/spot";
import { colors } from "../lib/theme";

type Health = Awaited<ReturnType<ReturnType<typeof createApi>["health"]>>;

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
      notify("Connected", "Settings saved.");
    } catch (e) {
      setHealth(null);
      notify("Connection failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const revalue = async () => {
    setBusy("revalue");
    try {
      const { queued } = await createApi(draft()).revalue(24);
      notify("Refreshing values", `${queued} item(s) older than 24h are being re-researched in the background.`);
    } catch (e) {
      notify("Failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <SectionTitle>Server</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Field label="Server URL" value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://vault.example.com" />
        <Field label="Access token (APP_TOKEN)" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <Field label="Spot refresh interval (seconds)" value={spotSeconds} onChangeText={setSpotSeconds} keyboardType="number-pad" />
        <Button title="Test & save" onPress={test} busy={busy === "test"} />
      </Card>

      {health && (
        <Card style={{ marginTop: 12, paddingVertical: 4 }}>
          <Row label="AI identification & research" value={health.ai ? "Ready" : "Missing ANTHROPIC_API_KEY"} />
          <Row label="Spot provider" value={health.spot_provider} />
          <Row label="eBay listings" value={health.ebay ? "Connected" : "Not configured"} />
          <Row label="eBay sold data" value={health.ebay_sold_data ? "Connected" : "Not enabled"} />
        </Card>
      )}

      <SectionTitle>Data</SectionTitle>
      <View style={{ gap: 10 }}>
        <Button title="Refresh stale market values" kind="secondary" onPress={revalue} busy={busy === "revalue"} />
        <Button title="Export inventory (CSV)" kind="secondary" onPress={() => Linking.openURL(createApi(draft()).exportUrl())} />
      </View>

      <Text style={styles.note}>
        Spot prices refresh automatically. Bullion values move with spot using the premium found in the last market
        research; numismatic values hold until you refresh them. Photos and data live on your server.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 60, width: "100%", maxWidth: 760, alignSelf: "center" },
  note: { color: colors.muted, fontSize: 12, marginTop: 24, lineHeight: 18 },
});
