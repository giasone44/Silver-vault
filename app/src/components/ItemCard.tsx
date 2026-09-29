import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useApi } from "../lib/api";
import { money, oz, pct, typeLabel } from "../lib/format";
import { colors, radius } from "../lib/theme";
import type { Item, SpotQuote } from "../lib/types";
import { fineOz, liveValue } from "../lib/value";

export function ItemCard({ item, quote }: { item: Item; quote: SpotQuote | null }) {
  const api = useApi();
  const lv = liveValue(item, quote);
  const thumb = api.photoUrl(item.obverse_photo);
  const grade = item.certification_service && item.certification_service !== "none"
    ? `${item.certification_service} ${item.certification_grade ?? ""}`
    : item.grade;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.id } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} /> : <View style={[styles.thumb, styles.noThumb]} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[typeLabel[item.item_type], grade, oz(fineOz(item))].filter(Boolean).join(" · ")}
        </Text>
        <Text style={styles.meta}>
          Qty {item.quantity} · {money(lv.unit)} ea{lv.source === "melt" ? " (melt)" : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text style={styles.value}>{money(lv.total, { whole: (lv.total ?? 0) >= 1000 })}</Text>
        {lv.gainPct != null && (
          <Text style={{ color: lv.gainPct >= 0 ? colors.up : colors.down, fontSize: 12, fontWeight: "600" }}>
            {pct(lv.gainPct)}
          </Text>
        )}
        {!item.valuation && <Text style={styles.badge}>not valued</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cardAlt },
  noThumb: { borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  badge: { color: colors.gold, fontSize: 10, fontWeight: "700" },
});
