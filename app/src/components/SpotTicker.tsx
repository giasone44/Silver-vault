import { Pressable, StyleSheet, Text, View } from "react-native";
import { ago, money, pct } from "../lib/format";
import { useSpot } from "../lib/spot";
import { colors } from "../lib/theme";

export function SpotTicker() {
  const { quote, sessionOpen, error, refresh } = useSpot();
  const metals = [
    { key: "silver", label: "Silver", color: colors.silver },
    { key: "gold", label: "Gold", color: colors.gold },
    { key: "platinum", label: "Plat", color: colors.muted },
    { key: "palladium", label: "Pall", color: colors.muted },
  ] as const;

  return (
    <Pressable onPress={refresh} style={styles.wrap}>
      <View style={styles.row}>
        {metals.map((m) => {
          const price = quote?.[m.key] ?? null;
          const open = m.key === "silver" || m.key === "gold" ? sessionOpen[m.key] : undefined;
          const change = price != null && open ? ((price - open) / open) * 100 : null;
          return (
            <View key={m.key} style={styles.cell}>
              <Text style={[styles.metal, { color: m.color }]}>{m.label}</Text>
              <Text style={styles.price}>{money(price)}</Text>
              {change != null && Math.abs(change) >= 0.01 && (
                <Text style={{ color: change >= 0 ? colors.up : colors.down, fontSize: 11 }}>{pct(change)}</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.meta}>
        {error ? `Spot unavailable: ${error}` : quote ? `Live spot · updated ${ago(quote.fetched_at)} · tap to refresh` : "Loading spot…"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between" },
  cell: { alignItems: "center", flex: 1 },
  metal: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  price: { color: colors.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  meta: { color: colors.muted, fontSize: 10, textAlign: "center", marginTop: 6 },
});
