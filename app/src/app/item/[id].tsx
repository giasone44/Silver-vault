import * as Clipboard from "expo-clipboard";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { AnimatedNumber, PressableScale, Reveal } from "../../components/motion";
import { Button, Certificate, Icon, PaperRow, Register, RegisterRow, Row, SectionTitle } from "../../components/ui";
import { DossierPanel } from "../../components/Dossier";
import { MakerPanel, MintageRecord, ResearchLinks } from "../../components/Reference";
import { RateRecord, ValueScale } from "../../components/ValueScale";
import { BalanceWheel, CoinFrame, Working } from "../../components/watch";
import { useApi } from "../../lib/api";
import { matchMaker, useMakers } from "../../lib/makers";
import { ago, money, oz, pct, typeLabel } from "../../lib/format";
import { useSpot } from "../../lib/spot";
import { colors, fonts, haptic, hairline, type } from "../../lib/theme";
import type { ItemDetail, SpotQuote } from "../../lib/types";
import { fineOz, liveValue } from "../../lib/value";

const KIND_LABEL: Record<string, string> = {
  sold: "Sold", auction: "Auction", dealer_sell: "Dealer ask", dealer_buy: "Dealer bid", price_guide: "Guide", asking: "Listed",
};

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { quote } = useSpot();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW, 720) - 40;
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [side, setSide] = useState<"Obverse" | "Reverse">("Obverse");
  const makers = useMakers();
  const wasResearching = useRef(false);

  const load = useCallback(async () => {
    try {
      const it = await api.item(id);
      setItem(it);
      setError(null);
      return it;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [api, id]);

  useFocusEffect(useCallback(() => void load(), [load]));

  // Research runs on the Mac in the background; check in every few seconds until it finishes.
  const researching = item?.research_status === "queued" || item?.research_status === "running";
  useEffect(() => {
    if (researching) {
      wasResearching.current = true;
      const t = setInterval(load, 4000);
      return () => clearInterval(t);
    }
    if (wasResearching.current && item?.research_status === "done") haptic.success();
    wasResearching.current = false;
  }, [researching, load, item?.research_status]);

  const refreshResearch = async () => {
    try {
      await api.research(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const reidentify = async () => {
    const go = async () => {
      setReading(true);
      setError(null);
      try {
        await api.reidentify(id);
        await load();
        haptic.success();
      } catch (e) {
        haptic.error();
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setReading(false);
      }
    };
    const msg = "Read the photos again from scratch and redo the research? What you paid, quantity, notes and location are kept.";
    if (Platform.OS === "web") {
      if (window.confirm(msg)) void go();
    } else {
      Alert.alert("Re-identify from photos?", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Re-identify", onPress: go },
      ]);
    }
  };

  if (!item) {
    return (
      <View style={styles.center}>
        {error ? <Text style={[type.body, { color: colors.down }]}>{error}</Text> : <BalanceWheel size={60} />}
      </View>
    );
  }

  const lv = liveValue(item, quote);
  const v = item.valuation;
  const ds = item.dossier?.specifications;
  const maker = matchMaker(makers, item.mint, item.name);
  const certified = item.certification_service && item.certification_service !== "none";
  const cert = certified
    ? `${item.certification_service} ${item.certification_grade ?? ""}`.trim()
    : "Uncertified";
  const heroSize = Math.min(width, 320);
  const hasBack = Boolean(item.obverse_photo && item.reverse_photo);

  const confirmDelete = () => {
    const doDelete = async () => {
      await api.remove(item.id);
      haptic.success();
      router.back();
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Remove ${item.name} from the register?`)) void doDelete();
    } else {
      Alert.alert("Remove from register?", item.name, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doDelete },
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
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.body, { width: width + 40 }]}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <PressableScale onPress={() => router.push({ pathname: "/edit/[id]", params: { id: item.id } })} feedback="tap" style={{ paddingHorizontal: Platform.OS === "web" ? 16 : 0 }}>
              <Text style={styles.headerLink}>AMEND</Text>
            </PressableScale>
          ),
        }}
      />

      <Reveal style={{ alignItems: "center" }}>
        <CoinFrame
          size={heroSize}
          front={api.photoUrl(item.obverse_photo)}
          back={api.photoUrl(item.reverse_photo)}
          onTurn={(s) => setSide(s ? "Reverse" : "Obverse")}
          placeholder={item.metal === "gold" ? "AU" : "AG"}
        />
        <View style={styles.flipHint}>
          {hasBack && <Icon name="flip" size={14} color={colors.muted} />}
          <Text style={[type.label, { fontSize: 9 }]}>{hasBack ? `${side} · tap to turn` : side}</Text>
        </View>
      </Reveal>

      <Reveal delay={80} style={{ alignItems: "center", marginTop: 20, gap: 8 }}>
        <Text style={[type.title, { textAlign: "center" }]}>{item.name}</Text>
        <Text style={[type.label, { textAlign: "center" }]}>
          {[typeLabel[item.item_type], item.category.replace("-", " "), cert].join("  ·  ")}
        </Text>
      </Reveal>

      <Reveal delay={160} style={{ alignItems: "center", marginTop: 28 }}>
        <Text style={type.labelGold}>{item.quantity > 1 ? `Present value · ${item.quantity} pieces` : "Present value"}</Text>
        <AnimatedNumber value={lv.total} format={(n) => money(n)} style={[type.figureLarge, { fontSize: 46, marginTop: 6 }]} />
        <Text style={type.italic}>
          {money(lv.unit)} each ·{" "}
          {lv.source === "market" ? (v?.pricing_model === "bullion" ? "from recent sales · moves with spot" : "collector value from recent sales · moves with spot") : "melt only — awaiting research"}
        </Text>
      </Reveal>

      <Reveal delay={220} style={{ marginTop: 22 }}>
        <RegisterRow>
          <Register label="Melt / pc" value={money(lv.melt)} />
          <Register label="Premium" value={pct(lv.premiumPct)} />
          <Register label="Paid / pc" value={money(item.purchase_price_per_unit)} />
          <Register label="Gain" value={pct(lv.gainPct)} color={lv.gain == null ? undefined : lv.gain >= 0 ? colors.up : colors.down} />
        </RegisterRow>
      </Reveal>

      {(researching || reading) && (
        <View style={styles.status}>
          <Working
            title={reading ? "Examining" : "Researching"}
            detail={
              reading
                ? "Reading your photos again…"
                : "Building this piece's dossier and checking recent sales. This takes a minute or two; you can leave this screen."
            }
            timer
          />
        </View>
      )}
      {item.research_status === "failed" && !researching && (
        <View style={styles.status}>
          <Text style={[type.body, { color: colors.down }]}>Research didn't finish: {item.research_error}</Text>
          <Button title="Try again" kind="secondary" onPress={refreshResearch} style={{ marginTop: 12 }} />
        </View>
      )}

      {item.dossier && <DossierPanel dossier={item.dossier} />}

      <SectionTitle>Market Report</SectionTitle>
      {v ? (
        <View style={{ gap: 18 }}>
          <ValueScale
            width={width}
            low={v.low_usd}
            high={v.high_usd}
            estimate={v.estimated_value_usd}
            marks={[
              { value: v.melt_at_valuation, label: "MELT", color: colors.steelDim },
              { value: v.dealer_buy_usd, label: "BID", color: colors.ivoryDim },
              { value: v.dealer_sell_usd, label: "ASK", color: colors.ivoryDim },
            ]}
          />
          <Text style={type.body}>{v.summary}</Text>
          {v.selling_tips && (
            <View style={styles.tip}>
              <Text style={type.labelGold}>On selling</Text>
              <Text style={[type.body, { marginTop: 4 }]}>{v.selling_tips}</Text>
            </View>
          )}
          <Text style={[type.italic, { fontSize: 13 }]}>
            {v.confidence[0].toUpperCase() + v.confidence.slice(1)} confidence · researched {ago(v.valued_at)}
            {v.spot_at_valuation ? ` · spot then ${money(v.spot_at_valuation)}` : ""}
          </Text>
        </View>
      ) : (
        <Text style={[type.body, { color: colors.ivoryDim }]}>
          {researching ? "Being prepared…" : "Not yet researched. The report studies recent sold listings, auction results and dealer prices for this exact piece."}
        </Text>
      )}
      {error && <Text style={[type.body, { color: colors.down, marginTop: 12 }]}>{error}</Text>}
      <ResearchLinks item={item} />

      {v && v.comps.length > 0 && (
        <>
          <SectionTitle>Comparable Sales</SectionTitle>
          {v.comps.map((c, i) => (
            <PressableScale key={i} onPress={() => c.url && Linking.openURL(c.url)} feedback={c.url ? "select" : "none"} style={styles.comp}>
              <View style={{ width: 62 }}>
                <Text style={[type.label, { fontSize: 8, color: c.kind === "sold" || c.kind === "auction" ? colors.gold : colors.muted }]}>
                  {KIND_LABEL[c.kind] ?? c.kind}
                </Text>
                <Text style={styles.compDate}>{c.date ? formatDate(c.date) : "—"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.compTitle} numberOfLines={2}>{c.title}</Text>
                <Text style={styles.compSource}>{c.source}{c.url ? "  ↗" : ""}</Text>
              </View>
              <Text style={styles.compPrice}>{money(c.price_usd)}</Text>
            </PressableScale>
          ))}
        </>
      )}

      <View style={{ height: 34 }} />
      <Certificate title="Certificate of Specification">
        <PaperRow label="Metal" value={cap(item.metal)} />
        <PaperRow label="Composition" value={ds?.composition} />
        <PaperRow label="Fineness" value={item.purity != null ? String(item.purity) : null} />
        <PaperRow label="Fine content" value={oz(fineOz(item))} />
        <PaperRow label="Gross weight" value={item.gross_weight_troy_oz != null ? oz(item.gross_weight_troy_oz) : null} />
        <PaperRow label="Mass" value={num(item.specs?.weight_grams ?? ds?.weight_grams, "g")} />
        <PaperRow label="Diameter" value={num(item.specs?.diameter_mm ?? ds?.diameter_mm, "mm")} />
        <PaperRow label="Thickness" value={num(item.specs?.thickness_mm ?? ds?.thickness_mm, "mm")} />
        <PaperRow label="Year" value={item.year} />
        <PaperRow label="Mint" value={item.mint} />
        <PaperRow label="Mint mark" value={item.mint_mark} />
        <PaperRow label="Country" value={item.country} />
        <PaperRow label="Denomination" value={item.denomination} />
        <PaperRow label="Series" value={item.series} />
        <PaperRow label="Catalogue" value={item.catalog_number} />
        <PaperRow label="Mintage" value={item.specs?.mintage} />
        <PaperRow label="Designer" value={item.specs?.designer ?? item.dossier?.designer} />
        <PaperRow label="Edge" value={item.specs?.edge ?? ds?.edge} />
        <PaperRow label="Certification" value={certified ? `${cert}${item.cert_number ? ` · No. ${item.cert_number}` : ""}` : "Uncertified"} />
        <PaperRow label="Grade" value={item.grade} />
        <PaperRow label="Variety" value={item.specs?.variety_or_error} />
        {(item.specs?.obverse_description || item.condition_notes) && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {item.specs?.obverse_description ? <Text style={styles.paperProse}><Text style={styles.paperProseLabel}>Obverse. </Text>{item.specs.obverse_description}</Text> : null}
            {item.specs?.reverse_description ? <Text style={styles.paperProse}><Text style={styles.paperProseLabel}>Reverse. </Text>{item.specs.reverse_description}</Text> : null}
            {item.condition_notes && <Text style={styles.paperProse}><Text style={styles.paperProseLabel}>Condition. </Text>{item.condition_notes}</Text>}
          </View>
        )}
      </Certificate>

      {maker && <MakerPanel maker={maker} />}
      <MintageRecord item={item} />

      <SectionTitle>Provenance</SectionTitle>
      <Row label="Quantity" value={String(item.quantity)} />
      <Row label="Cost basis" value={money(lv.cost)} />
      <Row label="Acquired" value={item.purchase_date ? formatDate(item.purchase_date) : null} />
      <Row label="From" value={item.purchase_source} />
      <Row label="Kept at" value={item.storage_location} />
      <Row label="Tags" value={item.tags.join(", ")} />
      <Row label="Notes" value={item.notes} />

      {item.history.length > 1 && (
        <>
          <SectionTitle>Rate Record</SectionTitle>
          <RateRecord width={width} values={[...item.history].reverse().map((h) => h.estimated_value_usd)} />
          {item.history.slice(0, 6).map((h, i) => (
            <Row key={i} label={formatDate(h.valued_at)} value={money(h.estimated_value_usd)} />
          ))}
        </>
      )}

      <View style={{ gap: 12, marginTop: 36 }}>
        <Button title="Refresh research" kind="secondary" onPress={refreshResearch} disabled={researching || reading} />
        <Button title="Re-identify from photos" kind="secondary" onPress={reidentify} disabled={researching || reading} />
        <Button title="Share sell sheet" kind="secondary" onPress={shareSellSheet} />
        <Button title="Remove from register" kind="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const num = (n: number | null | undefined, unit: string) => (n != null ? `${n} ${unit}` : null);

function formatDate(iso: string) {
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
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
    item.specs?.mintage ? `Mintage: ${item.specs.mintage}` : null,
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 80, alignSelf: "center" },
  headerLink: { color: colors.gold, fontFamily: fonts.engraved, fontSize: 11, letterSpacing: 2 },
  flipHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  tip: { borderLeftWidth: 1, borderLeftColor: colors.gold, paddingLeft: 14 },
  status: { marginTop: 26, paddingVertical: 8, borderTopWidth: hairline, borderBottomWidth: hairline, borderColor: colors.hairlineStrong },
  comp: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, borderBottomWidth: hairline, borderBottomColor: colors.hairline },
  compDate: { fontFamily: fonts.serifItalic, color: colors.ivoryDim, fontSize: 12, marginTop: 2 },
  compTitle: { fontFamily: fonts.serif, color: colors.ivory, fontSize: 15, lineHeight: 18 },
  compSource: { fontFamily: fonts.serifItalic, color: colors.muted, fontSize: 12, marginTop: 2 },
  compPrice: { fontFamily: fonts.numeral, color: colors.ivory, fontSize: 15, fontVariant: ["lining-nums", "tabular-nums"] },
  paperProse: { fontFamily: fonts.serif, color: colors.ink, fontSize: 15, lineHeight: 20 },
  paperProseLabel: { fontFamily: fonts.serifBold, color: colors.ink },
});
