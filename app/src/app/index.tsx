import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SpotComplications } from "../components/Complications";
import { ItemCard } from "../components/ItemCard";
import { Reveal } from "../components/motion";
import { Button, Icon, Pusher, Register, RegisterRow, SectionTitle, Segmented } from "../components/ui";
import { VaultRing } from "../components/vault";
import { BalanceWheel, MainDial } from "../components/watch";
import { useApi } from "../lib/api";
import { money } from "../lib/format";
import { matchMaker, useMakers } from "../lib/makers";
import { useSettings } from "../lib/settings";
import { useSpot } from "../lib/spot";
import { colors, fonts, haptic, hairline, noWebOutline, type } from "../lib/theme";
import type { Item } from "../lib/types";
import { fineOz, liveValue, portfolioTotals } from "../lib/value";

const SORTS = [["value", "Value"], ["gain", "Gain"], ["weight", "Weight"], ["newest", "Newest"], ["name", "Name"]] as const;
type SortKey = (typeof SORTS)[number][0];
const TYPES = [["all", "All"], ["coin", "Coins"], ["round", "Rounds"], ["bar", "Bars"], ["other", "Other"]] as const;
const METALS = [["all", "Any metal"], ["silver", "Silver"], ["gold", "Gold"], ["platinum", "Platinum"], ["palladium", "Palladium"]] as const;

const MAX_WIDTH = 720;

export default function Inventory() {
  const api = useApi();
  const { loaded } = useSettings();
  const { quote } = useSpot();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW, MAX_WIDTH) - 40;
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof TYPES)[number][0]>("all");
  const [metal, setMetal] = useState<(typeof METALS)[number][0]>("all");
  const [sort, setSort] = useState<SortKey>("value");
  const [makerFilter, setMakerFilter] = useState<string>("all");
  const makers = useMakers();

  // Each piece's maker under its standard name, falling back to the recorded mint.
  const makerOf = useCallback(
    (i: Item) => matchMaker(makers, i.mint, i.name)?.name ?? i.mint ?? null,
    [makers],
  );
  const makerOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items ?? []) {
      const m = makerOf(i);
      if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    return [["all", "All makers"] as const, ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => [m, `${m} · ${n}`] as const)];
  }, [items, makerOf]);

  const load = useCallback(async () => {
    try {
      setItems(await api.items());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useFocusEffect(useCallback(() => { if (loaded) void load(); }, [loaded, load]));

  const visible = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const queryMaker = q ? matchMaker(makers, q) : null; // "englehard" finds Engelhard
    const filtered = items.filter((i) => {
      if (kind !== "all" && i.item_type !== kind) return false;
      if (metal !== "all" && i.metal !== metal) return false;
      if (makerFilter !== "all" && makerOf(i) !== makerFilter) return false;
      if (!q) return true;
      if (queryMaker && makerOf(i) === queryMaker.name) return true;
      return [i.name, i.year, i.mint, i.mint_mark, i.series, i.country, i.grade, i.certification_service, i.cert_number, i.storage_location, i.notes, ...i.tags]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
    if (sort === "name") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    const key = (i: Item): number => {
      const lv = liveValue(i, quote);
      if (sort === "value") return lv.total ?? -1;
      if (sort === "gain") return lv.gainPct ?? -Infinity;
      if (sort === "weight") return (fineOz(i) ?? 0) * i.quantity;
      return Date.parse(i.created_at);
    };
    return [...filtered].sort((a, b) => key(b) - key(a));
  }, [items, query, kind, metal, makerFilter, makerOf, makers, sort, quote]);

  const totals = portfolioTotals(visible, quote);
  const filtered = visible.length !== (items?.length ?? 0);
  const unvalued = visible.filter((i) => !i.valuation).length;
  const vaultSize = Math.min(width, 400);
  const band = Math.round(vaultSize * 0.075);
  const dialSize = vaultSize - band * 2;

  const header = (
    <View style={{ width, alignSelf: "center" }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={type.brand}>SILVER VAULT</Text>
          <Text style={styles.tagline}>Precious metals register</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pusher icon="gear" onPress={() => router.push("/settings")} />
          <Pusher icon="plus" accent onPress={() => router.push("/add")} />
        </View>
      </View>

      <Reveal style={{ alignItems: "center", marginTop: 18 }}>
        <VaultRing size={vaultSize} band={band}>
        <MainDial
          size={dialSize}
          label={filtered ? "Selection" : "Portfolio"}
          value={items ? totals.value : null}
          gain={items && totals.cost ? totals.gain : null}
          gainPct={totals.cost ? (totals.gain / totals.cost) * 100 : null}
          silverOz={totals.silverOz}
          goldOz={totals.goldOz}
        />
        </VaultRing>
      </Reveal>

      <Reveal delay={120} style={{ marginTop: 22 }}>
        <RegisterRow>
          <Register label="Cost basis" value={money(totals.cost, { whole: true })} />
          <Register label="Melt value" value={money(totals.melt, { whole: true })} />
          <Register label="Pieces" value={String(totals.pieces)} />
          <Register label="Unvalued" value={String(unvalued)} color={unvalued ? colors.gold : undefined} />
        </RegisterRow>
      </Reveal>

      <Reveal delay={220}>
        <SectionTitle>Spot</SectionTitle>
        <SpotComplications width={width} />
      </Reveal>

      <SectionTitle>The Collection</SectionTitle>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search maker, year, grade, tag, location…"
          placeholderTextColor={colors.muted}
          selectionColor={colors.gold}
          style={[styles.searchInput, noWebOutline]}
          clearButtonMode="while-editing"
        />
      </View>
      <View style={{ gap: 10, marginTop: 14 }}>
        <Segmented options={TYPES} value={kind} onChange={setKind} />
        <Segmented options={METALS} value={metal} onChange={setMetal} />
        {makerOptions.length > 2 && <Segmented options={makerOptions} value={makerFilter} onChange={setMakerFilter} />}
      </View>
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Ordered by</Text>
        {SORTS.map(([k, label]) => (
          <Pressable key={k} onPress={() => { haptic.select(); setSort(k); }} hitSlop={6}>
            <Text style={[styles.sort, sort === k && styles.sortActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={[type.body, { color: colors.down }]}>{error}</Text>
          <Button title="Open settings" kind="secondary" onPress={() => router.push("/settings")} style={{ marginTop: 12 }} />
        </View>
      )}
      {!items && !error && <View style={{ alignItems: "center", paddingTop: 30 }}><BalanceWheel size={54} /></View>}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={visible}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      refreshControl={
        <RefreshControl
          tintColor={colors.gold}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            haptic.tap();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <View style={{ width, alignSelf: "center" }}>
          <ItemCard item={item} quote={quote} />
        </View>
      )}
      ListEmptyComponent={
        items && !error ? (
          <View style={[styles.empty, { width, alignSelf: "center" }]}>
            <Text style={[type.heading, { textAlign: "center" }]}>{items.length ? "Nothing matches" : "The vault awaits its first piece"}</Text>
            {!items.length && (
              <>
                <Text style={[type.italic, { textAlign: "center" }]}>
                  Photograph both faces of a coin, round or bar. It will be identified, catalogued and valued against the live market.
                </Text>
                <Button title="Record an acquisition" onPress={() => router.push("/add")} style={{ alignSelf: "stretch" }} />
              </>
            )}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tagline: { fontFamily: fonts.serifItalic, color: colors.muted, fontSize: 13, marginTop: 1 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.hairlineStrong, paddingBottom: 4 },
  searchInput: { flex: 1, color: colors.ivory, fontFamily: fonts.serif, fontSize: 18, paddingVertical: 8 },
  sortRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 18, marginBottom: 6 },
  sortLabel: { fontFamily: fonts.serifItalic, color: colors.muted, fontSize: 14 },
  sort: { fontFamily: fonts.engraved, color: colors.muted, fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase", paddingBottom: 3 },
  sortActive: { color: colors.gold, borderBottomWidth: 1, borderBottomColor: colors.gold },
  errorBox: { marginTop: 18, padding: 16, borderWidth: hairline, borderColor: colors.down },
  empty: { alignItems: "center", gap: 16, paddingVertical: 40 },
});
