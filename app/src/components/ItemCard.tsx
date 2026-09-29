import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useApi } from "../lib/api";
import { money, oz, pct, typeLabel } from "../lib/format";
import { colors, fonts, hairline, type } from "../lib/theme";
import type { Item, SpotQuote } from "../lib/types";
import { fineOz, liveValue } from "../lib/value";
import { PressableScale } from "./motion";
import { CoinFrame } from "./watch";

export function ItemCard({ item, quote }: { item: Item; quote: SpotQuote | null }) {
  const api = useApi();
  const lv = liveValue(item, quote);
  const grade = item.certification_service && item.certification_service !== "none"
    ? `${item.certification_service} ${item.certification_grade ?? ""}`.trim()
    : item.grade;

  return (
    <PressableScale onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })} style={styles.row}>
      <CoinFrame size={62} front={api.photoUrl(item.obverse_photo)} ticks={false} onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })} placeholder={item.metal === "gold" ? "AU" : "AG"} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={[type.label, { fontSize: 8.5 }]} numberOfLines={1}>
          {[typeLabel[item.item_type], grade, oz(fineOz(item))].filter(Boolean).join("  ·  ")}
        </Text>
        <Text style={styles.meta}>
          {item.quantity > 1 ? `${item.quantity} × ` : ""}{money(lv.unit)}{lv.source === "melt" ? " melt" : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        <Text style={styles.value}>{money(lv.total, { whole: (lv.total ?? 0) >= 1000 })}</Text>
        {lv.gainPct != null && (
          <Text style={[styles.gain, { color: lv.gainPct >= 0 ? colors.up : colors.down }]}>{pct(lv.gainPct)}</Text>
        )}
        {!item.valuation && <Text style={[type.labelGold, { fontSize: 7.5 }]}>Unvalued</Text>}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: hairline,
    borderBottomColor: colors.hairline,
  },
  name: { fontFamily: fonts.serifBold, color: colors.ivory, fontSize: 18, lineHeight: 21 },
  meta: { fontFamily: fonts.serifItalic, color: colors.ivoryDim, fontSize: 14 },
  value: { fontFamily: fonts.numeral, color: colors.ivory, fontSize: 17, fontVariant: ["lining-nums", "tabular-nums"] },
  gain: { fontFamily: fonts.serifItalic, fontSize: 13 },
});
