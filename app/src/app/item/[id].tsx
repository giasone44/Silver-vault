import * as Clipboard from "expo-clipboard";
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Button, Card, Row, SectionTitle } from "../../components/ui";
import { useApi } from "../../lib/api";
import { ago, money, oz, pct, typeLabel } from "../../lib/format";
import { useSpot } from "../../lib/spot";
import { colors, headerRightPad } from "../../lib/theme";
import type { ItemDetail, SpotQuote } from "../../lib/types";
import { fineOz, liveValue } from "../../lib/value";

const KIND_LABEL: Record<string, string> = {
  sold: "Sold", auction: "Auction", dealer_sell: "Dealer ask", dealer_buy: "Dealer bid", price_guide: "Guide", asking: "Listed",
};

export default function ItemScreen() {
  const { id, autovalue } = useLocalSearchParams<{ id: string; autovalue?: string }>();
  const api = useApi();
  const { quote } = useSpot();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [valuing, setValuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const load = useCallback(async () => {
    try {
      const it = await api.item(id);
      setItem(it);
      return it;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [api, id]);

  const valuate = useCallback(async () => {
    setValuing(true);
    setError(null);
    try {
      await api.valuate(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setValuing(false);
    }
  }, [api, id, load]);

  useFocusEffect(
    useCallback(() => {
      void load().then((it) => {
        if (it && autovalue && !it.valuation && !autoRan.current) {
          autoRan.current = true;
          void valuate();
        }
      });
    }, [load, autovalue, valuate]),
  );

  if (!item) {
    return (
      <View style={styles.center}>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : <ActivityIndicator color={colors.silver} />}
      </View>
    );
  }

  const lv = liveValue(item, quote);
  const v = item.valuation;
  const cert = item.certification_service && item.certification_service !== "none"
    ? `${item.certification_service} ${item.certification_grade ?? ""}${item.cert_number ? ` · #${item.cert_number}` : ""}`
    : "Raw (uncertified)";

  const confirmDelete = () => {
    const doDelete = async () => {
      await api.remove(item.id);
      router.back();
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete ${item.name}?`)) void doDelete();
    } else {
      Alert.alert("Delete item?", item.name, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const shareSellSheet = async () => {
    const text = sellSheet(item, quote);
    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(text);
      window.alert("Sell sheet copied to clipboard.");
    } else {
      await Share.share({ message: text, title: item.name });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <Link href={{ pathname: "/edit/[id]", params: { id: item.id } }}>
              <Text style={{ color: colors.silver, fontSize: 15, fontWeight: "600", paddingRight: headerRightPad }}>Edit</Text>
            </Link>
          ),
        }}
      />
      <View style={styles.photos}>
        {[item.obverse_photo, item.reverse_photo].map((p, i) => {
          const uri = api.photoUrl(p);
          return uri ? (
            <Pressable key={i} style={{ flex: 1 }} onPress={() => Linking.openURL(uri)}>
              <Image source={{ uri }} style={styles.photo} />
            </Pressable>
          ) : (
            <View key={i} style={[styles.photo, { flex: 1, borderWidth: 1, borderColor: colors.border }]} />
          );
        })}
      </View>

      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.subtitle}>
        {[typeLabel[item.item_type], item.category, cert].join(" · ")}
      </Text>

      <Card style={{ marginTop: 16 }}>
        <Text style={styles.label}>Current value{item.quantity > 1 ? ` (${item.quantity} pcs)` : ""}</Text>
        <Text style={styles.big}>{money(lv.total)}</Text>
        <Text style={styles.muted}>
          {money(lv.unit)} each ·{" "}
          {lv.source === "market" ? (v?.pricing_model === "bullion" ? "market premium, tracking live spot" : "market value") : "melt value only — not yet market-valued"}
        </Text>
        <View style={styles.grid}>
          <Mini label="Melt / unit" value={money(lv.melt)} />
          <Mini label="Premium" value={pct(lv.premiumPct)} />
          <Mini label="Paid / unit" value={money(item.purchase_price_per_unit)} />
          <Mini
            label="Gain"
            value={lv.gain != null ? `${money(lv.gain)} (${pct(lv.gainPct)})` : "—"}
            color={lv.gain == null ? undefined : lv.gain >= 0 ? colors.up : colors.down}
          />
        </View>
      </Card>

      <SectionTitle>Market research</SectionTitle>
      <Card>
        {v ? (
          <>
            <View style={styles.grid}>
              <Mini label="Fair value / unit" value={money(v.estimated_value_usd)} />
              <Mini label="Range" value={`${money(v.low_usd, { whole: true })}–${money(v.high_usd, { whole: true })}`} />
              <Mini label="Dealer buys at" value={money(v.dealer_buy_usd)} />
              <Mini label="Dealer sells at" value={money(v.dealer_sell_usd)} />
            </View>
            <Text style={[styles.body2, { marginTop: 12 }]}>{v.summary}</Text>
            {v.selling_tips && <Text style={[styles.body2, { marginTop: 8, color: colors.gold }]}>Selling: {v.selling_tips}</Text>}
            <Text style={[styles.muted, { marginTop: 10 }]}>
              {v.confidence} confidence · researched {ago(v.valued_at)}
              {v.spot_at_valuation ? ` · spot then ${money(v.spot_at_valuation)}` : ""}
            </Text>
          </>
        ) : (
          <Text style={styles.body2}>
            No market research yet. Research searches recent sold listings, auctions and dealer prices for this exact item.
          </Text>
        )}
        {error && <Text style={{ color: colors.danger, marginTop: 10 }}>{error}</Text>}
        <Button
          title={valuing ? "Researching recent sales…" : v ? "Refresh market value" : "Research market value"}
          onPress={valuate}
          busy={valuing}
          style={{ marginTop: 14 }}
        />
        {valuing && <Text style={[styles.muted, { textAlign: "center", marginTop: 8 }]}>This usually takes 30–90 seconds.</Text>}
      </Card>

      {v && v.comps.length > 0 && (
        <>
          <SectionTitle>Comparable sales ({v.comps.length})</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {v.comps.map((c, i) => (
              <Pressable key={i} onPress={() => c.url && Linking.openURL(c.url)} style={styles.comp}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.compTitle} numberOfLines={2}>{c.title}</Text>
                  <Text style={styles.muted}>
                    {KIND_LABEL[c.kind] ?? c.kind} · {c.source}{c.date ? ` · ${c.date.slice(0, 10)}` : ""}
                  </Text>
                </View>
                <Text style={styles.compPrice}>{money(c.price_usd)}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Specifications</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <Row label="Metal" value={item.metal} />
        <Row label="Purity" value={item.purity != null ? String(item.purity) : null} />
        <Row label="Fine weight" value={oz(fineOz(item))} />
        <Row label="Gross weight" value={item.gross_weight_troy_oz != null ? oz(item.gross_weight_troy_oz) : null} />
        <Row label="Weight (g)" value={item.specs?.weight_grams != null ? `${item.specs.weight_grams} g` : null} />
        <Row label="Diameter" value={item.specs?.diameter_mm != null ? `${item.specs.diameter_mm} mm` : null} />
        <Row label="Thickness" value={item.specs?.thickness_mm != null ? `${item.specs.thickness_mm} mm` : null} />
        <Row label="Year" value={item.year} />
        <Row label="Mint / refiner" value={item.mint} />
        <Row label="Mint mark" value={item.mint_mark} />
        <Row label="Country" value={item.country} />
        <Row label="Denomination" value={item.denomination} />
        <Row label="Series" value={item.series} />
        <Row label="Catalog #" value={item.catalog_number} />
        <Row label="Mintage" value={item.specs?.mintage} />
        <Row label="Designer" value={item.specs?.designer} />
        <Row label="Edge" value={item.specs?.edge} />
        <Row label="Certification" value={cert} />
        <Row label="Grade" value={item.grade} />
        <Row label="Variety / error" value={item.specs?.variety_or_error} />
      </Card>
      {item.specs && (
        <Card style={{ marginTop: 10, gap: 8 }}>
          <Text style={styles.body2}><Text style={styles.label}>Obverse: </Text>{item.specs.obverse_description}</Text>
          <Text style={styles.body2}><Text style={styles.label}>Reverse: </Text>{item.specs.reverse_description}</Text>
          {item.condition_notes && <Text style={styles.body2}><Text style={styles.label}>Condition: </Text>{item.condition_notes}</Text>}
        </Card>
      )}

      <SectionTitle>Ownership</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <Row label="Quantity" value={String(item.quantity)} />
        <Row label="Cost basis" value={money(lv.cost)} />
        <Row label="Purchased" value={item.purchase_date} />
        <Row label="From" value={item.purchase_source} />
        <Row label="Location" value={item.storage_location} />
        <Row label="Tags" value={item.tags.join(", ")} />
        <Row label="Notes" value={item.notes} />
      </Card>

      {item.history.length > 1 && (
        <>
          <SectionTitle>Valuation history</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {item.history.map((h, i) => (
              <Row key={i} label={new Date(h.valued_at).toLocaleDateString()} value={`${money(h.estimated_value_usd)}${h.spot_at_valuation ? `  (spot ${money(h.spot_at_valuation)})` : ""}`} />
            ))}
          </Card>
        </>
      )}

      <View style={{ gap: 10, marginTop: 24 }}>
        <Button title="Share sell sheet" kind="secondary" onPress={shareSellSheet} />
        <Button title="Delete item" kind="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ width: "50%", paddingVertical: 6 }}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function sellSheet(item: ItemDetail, quote: SpotQuote | null): string {
  const lv = liveValue(item, quote);
  const v = item.valuation;
  const lines = [
    item.name,
    "",
    [item.year, item.mint, item.mint_mark && `Mint mark ${item.mint_mark}`, item.denomination].filter(Boolean).join(" · "),
    `${item.metal} · ${item.purity ?? "?"} fine · ${oz(fineOz(item))} fine metal`,
    item.certification_service && item.certification_service !== "none"
      ? `Certified: ${item.certification_service} ${item.certification_grade ?? ""} (cert #${item.cert_number ?? "—"})`
      : `Raw${item.grade ? ` · ${item.grade}` : ""}`,
    item.condition_notes ? `Condition: ${item.condition_notes}` : null,
    item.quantity > 1 ? `Quantity available: ${item.quantity}` : null,
    "",
    v ? `Recent market value: ${money(lv.unit)} each (range ${money(v.low_usd)}–${money(v.high_usd)})` : `Melt value: ${money(lv.melt)} each`,
    v?.comps.filter((c) => c.kind === "sold" || c.kind === "auction").slice(0, 5).map((c) => `  • ${money(c.price_usd)} — ${c.source}${c.date ? ` ${c.date.slice(0, 10)}` : ""}`).join("\n") || null,
    quote?.silver ? `Silver spot at time of listing: ${money(quote.silver)}/oz` : null,
  ];
  return lines.filter((l) => l != null).join("\n");
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, paddingBottom: 80, width: "100%", maxWidth: 760, alignSelf: "center" },
  photos: { flexDirection: "row", gap: 12 },
  photo: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.cardAlt },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 16 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4, textTransform: "capitalize" },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  big: { color: colors.text, fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"], marginVertical: 2 },
  muted: { color: colors.muted, fontSize: 12 },
  body2: { color: colors.text, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  miniLabel: { color: colors.muted, fontSize: 11 },
  miniValue: { color: colors.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  comp: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  compTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  compPrice: { color: colors.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
