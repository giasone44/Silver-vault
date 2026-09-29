import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";
import { money } from "../lib/format";
import { colors, fonts } from "../lib/theme";

type Mark = { value: number | null | undefined; label: string; color: string };

/**
 * A vernier-style rule: the researched range as a gold band, the fair value as
 * the main pointer, and melt / dealer bid / dealer ask as fine index marks.
 */
export function ValueScale({ width, low, high, estimate, marks }: {
  width: number; low: number; high: number; estimate: number; marks: Mark[];
}) {
  const values = [low, high, estimate, ...marks.map((m) => m.value).filter((v): v is number => v != null)];
  const span = Math.max(...values) - Math.min(...values) || Math.max(estimate * 0.1, 1);
  const min = Math.min(...values) - span * 0.12;
  const max = Math.max(...values) + span * 0.12;
  const pad = 14;
  const x = (v: number) => pad + ((v - min) / (max - min)) * (width - pad * 2);
  const axisY = 44;
  const h = 108;

  const ticks = [];
  for (let i = 0; i <= 50; i++) {
    const tx = pad + (i / 50) * (width - pad * 2);
    const major = i % 10 === 0;
    ticks.push(<Line key={i} x1={tx} y1={axisY} x2={tx} y2={axisY + (major ? 9 : i % 5 === 0 ? 6 : 3.5)} stroke={colors.ivoryDim} strokeOpacity={major ? 0.8 : 0.45} strokeWidth={major ? 0.9 : 0.5} />);
  }

  const ex = x(estimate);
  const shown = marks.filter((m): m is Mark & { value: number } => m.value != null);

  return (
    <View style={{ width, height: h }}>
      <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
        <Line x1={pad} y1={axisY} x2={width - pad} y2={axisY} stroke={colors.ivoryDim} strokeOpacity={0.6} strokeWidth={0.8} />
        {ticks}
        <Rect x={x(low)} y={axisY - 3} width={Math.max(2, x(high) - x(low))} height={3} fill={colors.gold} opacity={0.85} />
        {shown.map((m) => (
          <Line key={m.label} x1={x(m.value)} y1={axisY - 12} x2={x(m.value)} y2={axisY + 12} stroke={m.color} strokeWidth={1} />
        ))}
        <Path d={`M ${ex - 6} ${axisY - 20} L ${ex + 6} ${axisY - 20} L ${ex} ${axisY - 5} Z`} fill={colors.goldBright} />
        <Circle cx={ex} cy={axisY} r={2.2} fill={colors.goldBright} />
      </Svg>
      <Text style={[styles.estimate, { left: Math.min(Math.max(ex - 60, 0), width - 120) }]}>{money(estimate)}</Text>
      {shown.map((m, i) => (
        <Text key={m.label} style={[styles.mark, { left: Math.min(Math.max(x(m.value) - 40, 0), width - 80), top: axisY + 16 + (i % 2) * 14, color: m.color }]}>
          {m.label} {money(m.value, { whole: m.value >= 100 })}
        </Text>
      ))}
      <Text style={[styles.end, { left: x(low) - 30, top: axisY + 16 + 28 }]}>{money(low, { whole: low >= 100 })}</Text>
      <Text style={[styles.end, { left: x(high) - 30, top: axisY + 16 + 28 }]}>{money(high, { whole: high >= 100 })}</Text>
    </View>
  );
}

/** Small line record of past valuations, oldest to newest. */
export function RateRecord({ width, values }: { width: number; values: number[] }) {
  if (values.length < 2) return null;
  const h = 56;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => {
    const px = 6 + (i / (values.length - 1)) * (width - 12);
    const py = h - 8 - ((v - min) / (max - min || 1)) * (h - 16);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(",").map(Number);
  return (
    <Svg width={width} height={h}>
      {[0.25, 0.5, 0.75].map((f) => (
        <Line key={f} x1={0} x2={width} y1={h * f} y2={h * f} stroke={colors.hairline} strokeWidth={0.5} />
      ))}
      <Polyline points={pts.join(" ")} fill="none" stroke={colors.gold} strokeWidth={1.2} />
      <Circle cx={last[0]} cy={last[1]} r={2.5} fill={colors.goldBright} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  estimate: { position: "absolute", top: 0, width: 120, textAlign: "center", fontFamily: fonts.numeralBold, color: colors.goldBright, fontSize: 14, fontVariant: ["lining-nums"] },
  mark: { position: "absolute", width: 80, textAlign: "center", fontFamily: fonts.engraved, fontSize: 8, letterSpacing: 1 },
  end: { position: "absolute", width: 60, textAlign: "center", fontFamily: fonts.serifItalic, color: colors.muted, fontSize: 11 },
});
