import { Link, Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { ItemCard } from "../components/ItemCard";
import { SpotTicker } from "../components/SpotTicker";
import { Button, Card, Chip } from "../components/ui";
import { useApi } from "../lib/api";
import { money, oz, pct } from "../lib/format";
import { useSettings } from "../lib/settings";
import { useSpot } from "../lib/spot";
import { colors, headerRightPad } from "../lib/theme";
import type { Item } from "../lib/types";
import { fineOz, liveValue, portfolioTotals } from "../lib/value";

const SORTS = {
  value: { label: "Value", fn: (a: number, b: number) => b - a },
  gain: { label: "Gain %", fn: (a: number, b: number) => b - a },
  weight: { label: "Metal oz", fn: (a: number, b: number) => b - a },
  newest: { label: "Newest", fn: (a: number, b: number) => b - a },
  name: { label: "Name", fn: () => 0 },
} as const;
type SortKey = keyof typeof SORTS;

const TYPES = [["all", "All"], ["coin", "Coins"], ["round", "Rounds"], ["bar", "Bars"]] as const;
const METALS = [["all", "Any metal"], ["silver", "Silver"], ["gold", "Gold"], ["platinum", "Platinum"]] as const;

export default function Inventory() {
  const api = useApi();
  const { loaded } = useSettings();
  const { quote } = useSpot();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [metal, setMetal] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("value");

  const load = useCallback(async () => {
    try {
      setItems(await api.items());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      if (loaded) void load();
    }, [loaded, load]),
  );

  const visible = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (type !== "all" && i.item_type !== type) return false;
      if (metal !== "all" && i.metal !== metal) return false;
      if (!q) return true;
      return [i.name, i.year, i.mint, i.mint_mark, i.series, i.country, i.grade, i.certification_service, i.cert_number, i.storage_location, i.notes, ...i.tags]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
    const key = (i: Item): number => {
      const lv = liveValue(i, quote);
      if (sort === "value") return lv.total ?? -1;
      if (sort === "gain") return lv.gainPct ?? -Infinity;
      if (sort === "weight") return (fineOz(i) ?? 0) * i.quantity;
      return Date.parse(i.created_at);
    };
    return sort === "name"
      ? [...filtered].sort((a, b) => a.name.localeCompare(b.name))
      : [...filtered].sort((a, b) => SORTS[sort].fn(key(a), key(b)));
  }, [items, query, type, metal, sort, quote]);

  const totals = portfolioTotals(visible, quote);
  const filteredView = visible.length !== (items?.length ?? 0);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center", paddingRight: headerRightPad }}>
              <Link href="/settings"><Text style={styles.headerLink}>Settings</Text></Link>
              <Link href="/add"><Text style={[styles.headerLink, { fontWeight: "800" }]}>＋ Add</Text></Link>
            </View>
          ),
        }}
      />
      <SpotTicker />
      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            tintColor={colors.silver}
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <Card>
              <Text style={styles.totalLabel}>{filteredView ? "Filtered value" : "Portfolio value"}</Text>
              <Text style={styles.total}>{money(totals.value)}</Text>
              <View style={styles.statsRow}>
                <Stat label="Cost basis" value={money(totals.cost, { whole: true })} />
                <Stat
                  label="Gain"
                  value={`${money(totals.gain, { whole: true })} ${totals.cost ? pct((totals.gain / totals.cost) * 100) : ""}`}
                  color={totals.gain >= 0 ? colors.up : colors.down}
                />
                <Stat label="Melt" value={money(totals.melt, { whole: true })} />
              </View>
              <View style={styles.statsRow}>
                <Stat label="Silver" value={oz(totals.silverOz)} />
                <Stat label="Gold" value={oz(totals.goldOz)} />
                <Stat label="Pieces" value={String(totals.pieces)} />
              </View>
            </Card>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, year, mint, grade, tag, location…"
              placeholderTextColor={colors.muted}
              style={styles.search}
              clearButtonMode="while-editing"
            />
            <View style={styles.chips}>
              {TYPES.map(([v, l]) => <Chip key={v} label={l} active={type === v} onPress={() => setType(v)} />)}
            </View>
            <View style={styles.chips}>
              {METALS.map(([v, l]) => <Chip key={v} label={l} active={metal === v} onPress={() => setMetal(v)} />)}
            </View>
            <View style={[styles.chips, { alignItems: "center" }]}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Sort</Text>
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <Pressable key={k} onPress={() => setSort(k)}>
                  <Text style={[styles.sort, sort === k && { color: colors.text, textDecorationLine: "underline" }]}>
                    {SORTS[k].label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error && (
              <Card style={{ borderColor: colors.danger }}>
                <Text style={{ color: colors.danger, marginBottom: 10 }}>{error}</Text>
                <Link href="/settings" asChild><Button title="Open Settings" kind="secondary" onPress={() => {}} /></Link>
              </Card>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <ItemCard item={item} quote={quote} />}
        ListEmptyComponent={
          items && !error ? (
            <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                {items.length ? "No matches" : "Your vault is empty"}
              </Text>
              {!items.length && (
                <>
                  <Text style={{ color: colors.muted, textAlign: "center" }}>
                    Photograph the front and back of a coin, round or bar and it will be identified and valued for you.
                  </Text>
                  <Link href="/add" asChild><Button title="Add your first item" onPress={() => {}} /></Link>
                </>
              )}
            </Card>
          ) : null
        }
      />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 14, paddingBottom: 60, width: "100%", maxWidth: 900, alignSelf: "center" },
  headerLink: { color: colors.silver, fontSize: 15, fontWeight: "600" },
  totalLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  total: { color: colors.text, fontSize: 34, fontWeight: "800", fontVariant: ["tabular-nums"], marginVertical: 4 },
  statsRow: { flexDirection: "row", marginTop: 10 },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  search: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sort: { color: colors.muted, fontSize: 13, fontWeight: "600" },
});
