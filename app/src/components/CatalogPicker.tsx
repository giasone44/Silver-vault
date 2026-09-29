import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from "react-native";
import { useApi } from "../lib/api";
import { colors, fonts, hairline, haptic, type } from "../lib/theme";
import type { CatalogHit, CatalogSpecs } from "../lib/types";
import { PressableScale } from "./motion";
import { Icon } from "./ui";

/**
 * Search the free Numista catalogue and apply a match's exact specifications.
 * With `autoApply`, the best match for the initial query is applied at once.
 */
export function CatalogPicker({ initialQuery, itemType, selectedId, autoApply, onApply }: {
  initialQuery: string;
  itemType?: string;
  selectedId: number | null;
  autoApply?: boolean;
  onApply: (specs: CatalogSpecs) => void;
}) {
  const api = useApi();
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<CatalogHit[] | null>(null);
  const [busy, setBusy] = useState<number | "search" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoDone = useRef(false);

  const apply = useCallback(async (id: number) => {
    setBusy(id);
    try {
      onApply(await api.catalogSpecs(id));
      haptic.success();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [api, onApply]);

  const search = useCallback(async (q: string, auto = false) => {
    if (!q.trim()) return;
    setBusy("search");
    setError(null);
    try {
      const results = await api.catalogSearch(q, itemType);
      setHits(results);
      setBusy(null);
      if (auto && results[0]) await apply(results[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }, [api, itemType, apply]);

  useEffect(() => {
    setQuery(initialQuery);
    if (initialQuery && !autoDone.current) {
      autoDone.current = true;
      void search(initialQuery, autoApply);
    }
  }, [initialQuery, autoApply, search]);

  return (
    <View>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search(query)}
          returnKeyType="search"
          placeholder="e.g. 1881 Morgan dollar, Engelhard 10 oz"
          placeholderTextColor={colors.muted}
          selectionColor={colors.gold}
          style={styles.input}
        />
        <PressableScale onPress={() => search(query)} style={styles.go}>
          <Text style={[type.labelGold, { fontSize: 9 }]}>Search</Text>
        </PressableScale>
      </View>
      {busy === "search" && <ActivityIndicator color={colors.gold} style={{ marginTop: 14 }} />}
      {error && <Text style={[type.italic, { color: colors.down, marginTop: 10 }]}>{error}</Text>}
      {hits && hits.length === 0 && <Text style={[type.italic, { marginTop: 10 }]}>No catalogue matches. Try fewer words.</Text>}
      {hits?.slice(0, 6).map((h) => {
        const selected = h.id === selectedId;
        return (
          <PressableScale key={h.id} onPress={() => apply(h.id)} style={[styles.hit, selected && styles.hitSelected]}>
            {h.thumbnail ? <Image source={{ uri: h.thumbnail }} style={styles.thumb} /> : <View style={[styles.thumb, styles.noThumb]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{h.title}</Text>
              <Text style={[type.label, { fontSize: 8.5 }]}>{[h.issuer, h.years].filter(Boolean).join("  ·  ")}</Text>
            </View>
            {busy === h.id ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Text style={[type.labelGold, { fontSize: 8.5, color: selected ? colors.goldBright : colors.muted }]}>
                {selected ? "Applied" : "Use"}
              </Text>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.hairlineStrong },
  input: { flex: 1, color: colors.ivory, fontFamily: fonts.serif, fontSize: 17, paddingVertical: 9 },
  go: { paddingVertical: 6, paddingHorizontal: 4 },
  hit: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: hairline, borderBottomColor: colors.hairline },
  hitSelected: { borderBottomColor: colors.gold },
  thumb: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dial },
  noThumb: { borderWidth: hairline, borderColor: colors.hairlineStrong },
  title: { fontFamily: fonts.serifBold, color: colors.ivory, fontSize: 16, lineHeight: 19 },
});
