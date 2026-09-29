import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { colors, fonts, hairline, noWebOutline, type } from "../lib/theme";
import { PressableScale } from "./motion";

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Ivory "papers" panel with a double rule, like a watch's certificate. */
export function Certificate({ title, children, style }: { title: string; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.paper, style]}>
      <View style={styles.paperInner}>
        <Text style={styles.paperTitle}>{title}</Text>
        <View style={styles.paperRule} />
        {children}
      </View>
    </View>
  );
}

export function PaperRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <View style={styles.paperRow}>
      <Text style={styles.paperLabel}>{label}</Text>
      <View style={styles.leader} />
      <Text style={styles.paperValue}>{value}</Text>
    </View>
  );
}

/** Engraved section heading flanked by fine rules. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionRule} />
      <Text style={type.section}>{children}</Text>
      <View style={styles.sectionRule} />
      {right}
    </View>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <View style={styles.row}>
      <Text style={type.label}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? <Text style={styles.rowValue}>{value}</Text> : value}
    </View>
  );
}

/** A labelled figure, arranged in hairline-divided rows. */
export function Register({ label, value, color, align = "center" }: { label: string; value: string; color?: string; align?: "center" | "left" }) {
  return (
    <View style={{ flex: 1, alignItems: align === "center" ? "center" : "flex-start", paddingVertical: 10, gap: 3 }}>
      <Text style={[type.label, { fontSize: 9 }]}>{label}</Text>
      <Text style={[type.figure, { fontSize: 16 }, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

export function RegisterRow({ children }: { children: ReactNode[] }) {
  return (
    <View style={styles.registerRow}>
      {children.map((child, i) => (
        <View key={i} style={[{ flex: 1 }, i > 0 && styles.registerDivider]}>{child}</View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  title, onPress, kind = "primary", busy, disabled, style,
}: {
  title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; busy?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  const inactive = disabled || busy;
  if (kind === "primary") {
    return (
      <PressableScale onPress={onPress} disabled={inactive} feedback="press" style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
        <LinearGradient
          colors={[colors.goldBright, colors.gold, colors.goldDeep]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.button}
        >
          <View style={styles.buttonSheen} />
          {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={[styles.buttonText, { color: colors.ink }]}>{title}</Text>}
        </LinearGradient>
      </PressableScale>
    );
  }
  const fg = kind === "danger" ? colors.down : colors.ivory;
  return (
    <PressableScale onPress={onPress} disabled={inactive} feedback="tap" style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
      <View style={[styles.button, styles.buttonOutline, kind === "danger" && { borderColor: "transparent" }]}>
        {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
      </View>
    </PressableScale>
  );
}

/** Horizontal engraved selector, like the positions of a crown. */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {options.map(([v, label]) => {
        const active = v === value;
        return (
          <PressableScale key={v} onPress={() => onChange(v)} style={[styles.seg, active && styles.segActive]}>
            <Text style={[styles.segText, active && { color: colors.ink }]}>{label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flex: 1, minWidth: 140 }}>
      <Text style={[type.label, { fontSize: 9 }, focused && { color: colors.gold }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.gold}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={[styles.input, noWebOutline, focused && { borderBottomColor: colors.gold }, props.multiline && { minHeight: 64, textAlignVertical: "top" }]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Icons (hairline, drawn to match the dial furniture)
// ---------------------------------------------------------------------------

export function Icon({ name, size = 20, color = colors.ivory }: { name: "plus" | "gear" | "search" | "share" | "flip"; size?: number; color?: string }) {
  const s = size;
  const c = s / 2;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {name === "plus" && (
        <>
          <Line x1={c} y1={s * 0.22} x2={c} y2={s * 0.78} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={s * 0.22} y1={c} x2={s * 0.78} y2={c} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        </>
      )}
      {name === "gear" && (
        <>
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * Math.PI) / 6;
            return <Line key={i} x1={c + Math.cos(a) * s * 0.3} y1={c + Math.sin(a) * s * 0.3} x2={c + Math.cos(a) * s * 0.44} y2={c + Math.sin(a) * s * 0.44} stroke={color} strokeWidth={1.6} strokeLinecap="round" />;
          })}
          <Circle cx={c} cy={c} r={s * 0.3} stroke={color} strokeWidth={1.2} fill="none" />
          <Circle cx={c} cy={c} r={s * 0.1} stroke={color} strokeWidth={1.2} fill="none" />
        </>
      )}
      {name === "search" && (
        <>
          <Circle cx={s * 0.43} cy={s * 0.43} r={s * 0.26} stroke={color} strokeWidth={1.3} fill="none" />
          <Line x1={s * 0.62} y1={s * 0.62} x2={s * 0.84} y2={s * 0.84} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
        </>
      )}
      {name === "share" && (
        <Path d={`M ${c} ${s * 0.15} L ${c} ${s * 0.62} M ${s * 0.33} ${s * 0.32} L ${c} ${s * 0.15} L ${s * 0.67} ${s * 0.32} M ${s * 0.25} ${s * 0.5} L ${s * 0.25} ${s * 0.85} L ${s * 0.75} ${s * 0.85} L ${s * 0.75} ${s * 0.5}`} stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {name === "flip" && (
        <Path d={`M ${s * 0.2} ${s * 0.4} A ${s * 0.3} ${s * 0.3} 0 0 1 ${s * 0.78} ${s * 0.36} M ${s * 0.78} ${s * 0.18} L ${s * 0.78} ${s * 0.36} L ${s * 0.6} ${s * 0.36} M ${s * 0.8} ${s * 0.6} A ${s * 0.3} ${s * 0.3} 0 0 1 ${s * 0.22} ${s * 0.64} M ${s * 0.22} ${s * 0.82} L ${s * 0.22} ${s * 0.64} L ${s * 0.4} ${s * 0.64}`} stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

/** Round pusher button with a steel rim. */
export function Pusher({ icon, onPress, accent }: { icon: "plus" | "gear" | "share"; onPress: () => void; accent?: boolean }) {
  return (
    <PressableScale onPress={onPress} feedback="tap" style={[styles.pusher, accent && styles.pusherAccent]}>
      <Icon name={icon} size={18} color={accent ? colors.ink : colors.ivory} />
    </PressableScale>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 4, borderWidth: hairline, borderColor: colors.hairlineStrong, padding: 16 },
  paper: { backgroundColor: colors.paper, borderRadius: 2, padding: 5 },
  paperInner: { borderWidth: 1, borderColor: colors.paperEdge, padding: 16 },
  paperTitle: { fontFamily: fonts.engravedBold, color: colors.ink, fontSize: 11, letterSpacing: 3, textAlign: "center" },
  paperRule: { height: 3, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.paperEdge, marginTop: 10, marginBottom: 8 },
  paperRow: { flexDirection: "row", alignItems: "flex-end", paddingVertical: 5, gap: 6 },
  paperLabel: { fontFamily: fonts.serifItalic, color: colors.inkMuted, fontSize: 15 },
  leader: { flex: 1, borderBottomWidth: 1, borderColor: colors.paperEdge, borderStyle: "dotted", marginBottom: 5 },
  paperValue: { fontFamily: fonts.serifBold, color: colors.ink, fontSize: 15, maxWidth: "60%", textAlign: "right" },
  sectionWrap: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 34, marginBottom: 14 },
  sectionRule: { flex: 1, height: hairline, backgroundColor: colors.hairlineStrong },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, borderBottomWidth: hairline, borderBottomColor: colors.hairline, gap: 12 },
  rowValue: { fontFamily: fonts.serifBold, color: colors.ivory, fontSize: 16, flexShrink: 1, textAlign: "right" },
  registerRow: { flexDirection: "row", borderTopWidth: hairline, borderBottomWidth: hairline, borderColor: colors.hairline },
  registerDivider: { borderLeftWidth: hairline, borderLeftColor: colors.hairline },
  button: { borderRadius: 2, paddingVertical: 15, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  buttonSheen: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.55)" },
  buttonOutline: { borderWidth: 1, borderColor: colors.hairlineStrong, backgroundColor: "transparent" },
  buttonText: { fontFamily: fonts.engravedBold, fontSize: 12, letterSpacing: 2.6, textTransform: "uppercase" },
  seg: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: hairline, borderColor: colors.hairlineStrong },
  segActive: { backgroundColor: colors.ivory, borderColor: colors.ivory },
  segText: { fontFamily: fonts.engraved, color: colors.ivoryDim, fontSize: 10.5, letterSpacing: 1.8, textTransform: "uppercase" },
  input: {
    color: colors.ivory,
    fontFamily: fonts.serif,
    fontSize: 18,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineStrong,
  },
  pusher: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pusherAccent: { backgroundColor: colors.gold, borderColor: colors.goldBright },
});
