import { Linking, StyleSheet, Text, View } from "react-native";
import { colors, fonts, hairline, type } from "../lib/theme";
import type { Dossier } from "../lib/types";
import { PressableScale } from "./motion";
import { SectionTitle } from "./ui";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={type.labelGold}>{label}</Text>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          <Text style={[type.body, { color: colors.gold }]}>·</Text>
          <Text style={[type.body, { flex: 1 }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

/** The researched reference file: what the piece is, its story, and what to know as its owner. */
export function DossierPanel({ dossier: d }: { dossier: Dossier }) {
  return (
    <View>
      <SectionTitle>Dossier</SectionTitle>
      <Text style={[type.body, { fontSize: 19, lineHeight: 26 }]}>{d.summary}</Text>

      <Block label="History">
        <Text style={type.body}>{d.history}</Text>
      </Block>

      <Block label="Design">
        <Text style={type.body}>
          <Text style={styles.lead}>Obverse. </Text>
          {d.obverse_design}
        </Text>
        <Text style={[type.body, { marginTop: 6 }]}>
          <Text style={styles.lead}>Reverse. </Text>
          {d.reverse_design}
        </Text>
        {d.designer && <Text style={[type.italic, { marginTop: 6 }]}>Designed by {d.designer}</Text>}
      </Block>

      {(d.mintage || d.mintage_context) && (
        <Block label="Mintage & scarcity">
          {d.mintage && <Text style={type.body}>{d.mintage}</Text>}
          {d.mintage_context && <Text style={[type.bodyMuted, { marginTop: 4 }]}>{d.mintage_context}</Text>}
        </Block>
      )}

      {d.key_facts.length > 0 && (
        <Block label="Worth knowing">
          <Bullets items={d.key_facts} />
        </Block>
      )}

      {d.varieties.length > 0 && (
        <Block label="Varieties to check for">
          <Bullets items={d.varieties} />
        </Block>
      )}

      {d.authentication.length > 0 && (
        <Block label="Is it genuine?">
          <Bullets items={d.authentication} />
        </Block>
      )}

      {d.grading_notes && (
        <Block label="Grading">
          <Text style={type.body}>{d.grading_notes}</Text>
        </Block>
      )}

      {d.care && (
        <Block label="Care & storage">
          <Text style={type.body}>{d.care}</Text>
        </Block>
      )}

      {d.sources.length > 0 && (
        <Block label="Sources">
          {d.sources.map((s, i) => (
            <PressableScale key={i} onPress={() => Linking.openURL(s.url)} feedback="tap" style={styles.source}>
              <Text style={styles.sourceText} numberOfLines={2}>{s.title}  ↗</Text>
            </PressableScale>
          ))}
        </Block>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 22 },
  lead: { fontFamily: fonts.serifBold, color: colors.ivory },
  source: { paddingVertical: 8, borderBottomWidth: hairline, borderBottomColor: colors.hairline },
  sourceText: { fontFamily: fonts.serifItalic, color: colors.ivoryDim, fontSize: 15 },
});
