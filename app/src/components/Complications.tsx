import { StyleSheet, Text, View } from "react-native";
import { ago, money, pct } from "../lib/format";
import { useSpot, type SpotMetal } from "../lib/spot";
import { colors, fonts, type } from "../lib/theme";
import { AnimatedNumber, PressableScale } from "./motion";
import { Subdial } from "./watch";

const METALS: { key: SpotMetal; name: string; symbol: string; accent: string }[] = [
  { key: "silver", name: "Silver", symbol: "AG", accent: colors.steel },
  { key: "gold", name: "Gold", symbol: "AU", accent: colors.goldBright },
  { key: "platinum", name: "Platinum", symbol: "PT", accent: colors.steelDim },
  { key: "palladium", name: "Palladium", symbol: "PD", accent: colors.steelDim },
];

/** Four registers showing live spot; each hand reads the % move over the last 24h (±3%). */
export function SpotComplications({ width }: { width: number }) {
  const { quote, change, since, error, refresh } = useSpot();
  const dial = Math.min(78, (width - 48) / 4);
  const window = since && Date.now() - Date.parse(since + ":00Z") > 20 * 3600_000 ? "24h" : "since open";

  return (
    <PressableScale onPress={refresh} feedback="tap" style={{ gap: 10 }}>
      <View style={styles.row}>
        {METALS.map((m) => {
          const ch = change[m.key];
          return (
            <View key={m.key} style={styles.cell}>
              <Subdial size={dial} symbol={m.symbol} change={ch} accent={m.accent} />
              <Text style={[type.label, { fontSize: 8.5, marginTop: 8 }]}>{m.name}</Text>
              <AnimatedNumber value={quote?.[m.key] ?? null} format={(n) => money(n)} style={styles.price} duration={600} />
              <Text style={[styles.change, { color: ch == null || Math.abs(ch) < 0.005 ? colors.muted : ch > 0 ? colors.up : colors.down }]}>
                {ch == null ? " " : pct(ch)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.caption}>
        {error ? `Spot unavailable — ${error}` : quote ? `Spot per troy oz · change ${window} · updated ${ago(quote.fetched_at)}` : "Winding…"}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  cell: { flex: 1, alignItems: "center" },
  price: { fontFamily: fonts.numeral, color: colors.ivory, fontSize: 14, marginTop: 3, fontVariant: ["lining-nums", "tabular-nums"] },
  change: { fontFamily: fonts.serifItalic, fontSize: 12, marginTop: 1 },
  caption: { fontFamily: fonts.serifItalic, color: colors.muted, fontSize: 12, textAlign: "center" },
});
