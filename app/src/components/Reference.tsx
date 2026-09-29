import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useApi } from "../lib/api";
import { colors, fonts, hairline, type } from "../lib/theme";
import type { CatalogIssue, Item, Maker } from "../lib/types";
import { findIssue } from "../lib/issues";
import { PressableScale } from "./motion";
import { SectionTitle } from "./ui";

/** Background on the mint or refiner that made a piece. */
export function MakerPanel({ maker }: { maker: Maker }) {
  return (
    <View>
      <SectionTitle>The Maker</SectionTitle>
      <Text style={type.heading}>{maker.name}</Text>
      <Text style={[type.label, { marginTop: 4 }]}>
        {[maker.kind, maker.country, maker.founded && `Est. ${maker.founded}`].filter(Boolean).join("  ·  ")}
      </Text>
      <Text style={[type.italic, { marginTop: 6 }]}>{maker.status}</Text>
      <Text style={[type.body, { marginTop: 12 }]}>{maker.about}</Text>
      <View style={styles.tip}>
        <Text style={type.labelGold}>For collectors</Text>
        <Text style={[type.body, { marginTop: 4 }]}>{maker.collecting}</Text>
      </View>
    </View>
  );
}

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));

/** Every year / mint mark of this catalogue type with its mintage; this piece's issue highlighted. */
export function MintageRecord({ item }: { item: Item }) {
  const api = useApi();
  const [issues, setIssues] = useState<CatalogIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (!item.numista_id) return;
    api.catalogIssues(item.numista_id).then(setIssues).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [api, item.numista_id]);

  const mine = useMemo(() => (issues ? findIssue(issues, item.year, item.mint_mark) : null), [issues, item.year, item.mint_mark]);
  const shown = useMemo(() => {
    if (!issues || all || issues.length <= 12) return issues ?? [];
    const i = mine ? issues.indexOf(mine) : 0;
    return issues.slice(Math.max(0, i - 5), Math.max(0, i - 5) + 11);
  }, [issues, all, mine]);

  if (!item.numista_id) return null;
  const known = issues?.filter((i) => i.mintage != null) ?? [];
  const ranked = [...known].sort((a, b) => a.mintage! - b.mintage!);
  const rank = mine?.mintage != null ? ranked.indexOf(mine) + 1 : null;

  return (
    <View>
      <SectionTitle>Mintage Record</SectionTitle>
      {error && <Text style={[type.italic, { color: colors.down }]}>{error}</Text>}
      {!issues && !error && <Text style={type.italic}>Consulting the catalogue…</Text>}
      {issues && issues.length === 0 && <Text style={type.italic}>The catalogue lists no issues for this type.</Text>}
      {mine && (
        <Text style={[type.body, { marginBottom: 10 }]}>
          {mine.mintage != null
            ? `${fmt(mine.mintage)} struck for ${mine.year ?? ""}${mine.mint_letter ? `-${mine.mint_letter}` : ""}.${rank && known.length > 1 ? ` Scarcity: ${ordinal(rank)} lowest of ${known.length} issues with a recorded mintage.` : ""}`
            : "The mintage for this issue isn't recorded in the catalogue."}
        </Text>
      )}
      {shown.map((i) => {
        const current = i === mine;
        return (
          <View key={i.id} style={[styles.row, current && styles.rowMine]}>
            <Text style={[styles.year, current && { color: colors.goldBright }]}>
              {i.year ?? "Undated"}{i.mint_letter ? `-${i.mint_letter}` : ""}
            </Text>
            {i.comment ? <Text style={styles.comment} numberOfLines={1}>{i.comment}</Text> : <View style={{ flex: 1 }} />}
            <Text style={[styles.mintage, current && { color: colors.goldBright }]}>{fmt(i.mintage)}</Text>
          </View>
        );
      })}
      {issues && issues.length > shown.length && (
        <Pressable onPress={() => setAll(true)} style={{ paddingVertical: 12 }}>
          <Text style={[type.labelGold, { textAlign: "center" }]}>Show all {issues.length} issues</Text>
        </Pressable>
      )}
    </View>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Free outside references: actual sold prices on eBay and the catalogue page. */
export function ResearchLinks({ item }: { item: Item }) {
  const q = encodeURIComponent(item.search_query ?? item.name);
  const links = [
    { label: "eBay sold listings", url: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&_sop=13` },
    item.numista_id ? { label: "Numista catalogue", url: `https://en.numista.com/catalogue/pieces${item.numista_id}.html` } : null,
  ].filter((l): l is { label: string; url: string } => l != null);
  return (
    <View style={styles.links}>
      {links.map((l) => (
        <PressableScale key={l.url} onPress={() => Linking.openURL(l.url)} feedback="tap" style={styles.link}>
          <Text style={[type.labelGold, { fontSize: 9.5 }]}>{l.label}  ↗</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { borderLeftWidth: 1, borderLeftColor: colors.gold, paddingLeft: 14, marginTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderBottomWidth: hairline, borderBottomColor: colors.hairline },
  rowMine: { borderBottomColor: colors.gold },
  year: { fontFamily: fonts.numeral, color: colors.ivory, fontSize: 15, width: 84, fontVariant: ["lining-nums", "tabular-nums"] },
  comment: { flex: 1, fontFamily: fonts.serifItalic, color: colors.muted, fontSize: 13 },
  mintage: { fontFamily: fonts.numeral, color: colors.ivory, fontSize: 15, fontVariant: ["lining-nums", "tabular-nums"] },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  link: { borderWidth: hairline, borderColor: colors.goldDeep, borderRadius: 2, paddingVertical: 10, paddingHorizontal: 14 },
});
