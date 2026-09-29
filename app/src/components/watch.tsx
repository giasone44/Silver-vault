import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { money, pct } from "../lib/format";
import { colors, fonts, haptic, nativeDriver, polar, type } from "../lib/theme";
import { AnimatedNumber } from "./motion";

const useSvgId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Sunburst + fine concentric engine-turning, very low contrast. */
export function Guilloche({ cx, cy, r, color = colors.ivory, rays = 120, rings = 0 }: {
  cx: number; cy: number; r: number; color?: string; rays?: number; rings?: number;
}) {
  const lines = [];
  for (let i = 0; i < rays; i++) {
    const deg = (i * 360) / rays;
    const a = polar(cx, cy, r * 0.04, deg);
    const m = polar(cx, cy, r * 0.3, deg);
    const b = polar(cx, cy, r, deg);
    // Rays thin out toward the centre, as engine-turning does, instead of piling up.
    if (i % 3 === 0) lines.push(<Line key={`i${i}`} x1={a.x} y1={a.y} x2={m.x} y2={m.y} stroke={color} strokeOpacity={0.03} strokeWidth={0.5} />);
    lines.push(<Line key={`l${i}`} x1={m.x} y1={m.y} x2={b.x} y2={b.y} stroke={color} strokeOpacity={i % 2 ? 0.035 : 0.06} strokeWidth={0.6} />);
  }
  const circles = [];
  for (let i = 1; i <= rings; i++) {
    circles.push(<Circle key={`c${i}`} cx={cx} cy={cy} r={(r * i) / (rings + 1)} stroke={color} strokeOpacity={0.05} strokeWidth={0.5} fill="none" />);
  }
  return <G>{lines}{circles}</G>;
}

/** Minute / scale track. Angles in degrees clockwise from 12 o'clock. */
export function TickRing({
  cx, cy, r, count = 60, majorEvery = 5, from = 0, to = 360, minor = 4, major = 8,
  color = colors.ivoryDim, majorColor = colors.ivory, width = 0.8, majorWidth = 1.4, skip = [],
}: {
  cx: number; cy: number; r: number; count?: number; majorEvery?: number; from?: number; to?: number;
  minor?: number; major?: number; color?: string; majorColor?: string; width?: number; majorWidth?: number; skip?: number[];
}) {
  // A full circle has `count` ticks; an arc has `count + 1` so both ends are marked.
  const closed = to - from >= 360;
  const ticks = [];
  for (let i = 0; i < (closed ? count : count + 1); i++) {
    if (skip.includes(i)) continue;
    const deg = from + ((to - from) * i) / count;
    const isMajor = i % majorEvery === 0;
    const a = polar(cx, cy, r, deg);
    const b = polar(cx, cy, r - (isMajor ? major : minor), deg);
    ticks.push(
      <Line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={isMajor ? majorColor : color} strokeWidth={isMajor ? majorWidth : width} strokeLinecap="butt" />,
    );
  }
  return <G>{ticks}</G>;
}

/** A hand that springs to its angle; drawn pointing to 12 o'clock inside a size×size box. */
export function AnimatedHand({ size, angle, from, children, style }: {
  size: number; angle: number; from?: number; children: ReactNode; style?: object;
}) {
  const v = useRef(new Animated.Value(from ?? angle)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: angle, useNativeDriver: nativeDriver, friction: 7, tension: 28 }).start();
  }, [v, angle]);
  const rotate = v.interpolate({ inputRange: [-360, 360], outputRange: ["-360deg", "360deg"] });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: size, height: size, transform: [{ rotate }] }, style]}>
      <Svg width={size} height={size}>{children}</Svg>
    </Animated.View>
  );
}

/** Petite seconde: a continuously sweeping seconds hand, synced to the real clock. */
export function SmallSeconds({ size }: { size: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const [offset] = useState(() => (new Date().getSeconds() + new Date().getMilliseconds() / 1000) * 6);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 60_000, easing: Easing.linear, useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: [`${offset}deg`, `${offset + 360}deg`] });
  const c = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={c - 1} fill={colors.dial} stroke={colors.hairlineStrong} strokeWidth={1} />
        <Guilloche cx={c} cy={c} r={c - 2} rays={0} rings={Math.round(size / 6)} />
        <TickRing cx={c} cy={c} r={c - 4} count={60} majorEvery={15} minor={2.5} major={5} width={0.5} majorWidth={1.2} />
      </Svg>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size}>
          <Line x1={c} y1={c + size * 0.14} x2={c} y2={size * 0.1} stroke={colors.goldBright} strokeWidth={1.1} strokeLinecap="round" />
          <Circle cx={c} cy={c} r={2.2} fill={colors.goldBright} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Portfolio dial

/** Fits a date-window: 3–4 significant figures. */
function windowOz(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
// ---------------------------------------------------------------------------

export function MainDial({ size, value, gain, gainPct, silverOz, goldOz, label = "Portfolio" }: {
  size: number; value: number | null; gain: number | null; gainPct: number | null;
  silverOz: number; goldOz: number; label?: string;
}) {
  const id = useSvgId("dial");
  const c = size / 2;
  const rBezel = c - 2;
  const rDial = c - 10;
  const rTrack = rDial - 6;
  const secSize = size * 0.22;
  const secCy = size * 0.735;

  const indices = [];
  for (let h = 0; h < 12; h++) {
    if (h === 4 || h === 6 || h === 8) continue; // windows and small seconds sit here
    const deg = h * 30;
    const len = size * 0.055;
    const w = h === 0 ? 2.4 : 3.2;
    const top = c - rTrack + 12;
    const bars = h === 0 ? [-3.4, 3.4] : [0];
    for (const dx of bars) {
      indices.push(
        <G key={`${h}${dx}`} transform={`rotate(${deg} ${c} ${c})`}>
          <Rect x={c - w / 2 + dx} y={top} width={w} height={len} rx={0.6} fill={`url(#${id}gold)`} />
          <Line x1={c + dx - w / 2 + 0.6} y1={top + 1} x2={c + dx - w / 2 + 0.6} y2={top + len - 1} stroke={colors.goldBright} strokeWidth={0.5} strokeOpacity={0.9} />
        </G>,
      );
    }
  }

  const win = (deg: number, text: string, symbol: string) => {
    const p = polar(c, c, size * 0.3, deg);
    return (
      <View style={[styles.window, { left: p.x - size * 0.105, top: p.y - 13, width: size * 0.21 }]}>
        <Text style={styles.windowSym}>{symbol}</Text>
        <Text style={styles.windowText} numberOfLines={1} adjustsFontSizeToFit>{text}</Text>
      </View>
    );
  };

  const gainColor = gain == null ? colors.ivoryDim : gain >= 0 ? colors.up : colors.down;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}bezel`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F1F2F4" />
            <Stop offset="0.35" stopColor="#8E939B" />
            <Stop offset="0.55" stopColor="#E3E5E8" />
            <Stop offset="1" stopColor="#5D6168" />
          </LinearGradient>
          <RadialGradient id={`${id}face`} cx="50%" cy="42%" r="62%">
            <Stop offset="0" stopColor={colors.dialLight} />
            <Stop offset="1" stopColor="#07080A" />
          </RadialGradient>
          <LinearGradient id={`${id}gold`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.goldBright} />
            <Stop offset="0.5" stopColor={colors.gold} />
            <Stop offset="1" stopColor={colors.goldDeep} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={rBezel} fill="none" stroke={`url(#${id}bezel)`} strokeWidth={4} />
        <Circle cx={c} cy={c} r={rBezel - 3} fill="none" stroke="#000" strokeOpacity={0.6} strokeWidth={1.5} />
        <Circle cx={c} cy={c} r={rDial} fill={`url(#${id}face)`} />
        <Guilloche cx={c} cy={c} r={rDial} rays={144} />
        <Circle cx={c} cy={c} r={rTrack} fill="none" stroke={colors.ivoryDim} strokeOpacity={0.35} strokeWidth={0.5} />
        <Circle cx={c} cy={c} r={rTrack - 9} fill="none" stroke={colors.ivoryDim} strokeOpacity={0.25} strokeWidth={0.5} />
        <TickRing cx={c} cy={c} r={rTrack} count={60} majorEvery={5} minor={4} major={9} width={0.6} majorWidth={0} color={colors.ivoryDim} />
        <TickRing cx={c} cy={c} r={rTrack} count={300} majorEvery={1000} minor={2} width={0.3} color={colors.ivoryDim} />
        {indices}
      </Svg>

      <View style={[styles.center, { top: size * 0.25 }]} pointerEvents="none">
        <Text style={[type.labelGold, { fontSize: Math.max(9, size * 0.03) }]}>{label}</Text>
      </View>
      <View style={[styles.center, { top: size * 0.335 }]} pointerEvents="none">
        <AnimatedNumber
          value={value}
          format={(n) => money(n)}
          style={[type.figureLarge, { fontSize: size * 0.115 }]}
        />
        <Text style={[styles.gain, { color: gainColor, fontSize: Math.max(13, size * 0.045) }]}>
          {gain == null ? " " : `${gain >= 0 ? "+" : "−"}${money(Math.abs(gain), { whole: true })}  ·  ${pct(gainPct)}`}
        </Text>
      </View>

      {win(240, windowOz(silverOz), "AG")}
      {win(120, windowOz(goldOz), "AU")}

      <View style={{ position: "absolute", left: c - secSize / 2, top: secCy - secSize / 2 }}>
        <SmallSeconds size={secSize} />
      </View>
      <Text style={[styles.secLabel, { top: secCy + secSize / 2 + 4, width: size }]}>Live · Troy oz</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Register (spot complication)
// ---------------------------------------------------------------------------

/** Chronograph-style register: hand shows % change on a ±range scale. */
export function Subdial({ size, symbol, change, range = 3, accent = colors.steel, ends = ["−", "+"] }: {
  size: number; symbol: string; change: number | null; range?: number; accent?: string; ends?: [string, string];
}) {
  const c = size / 2;
  const sweep = 130;
  const angle = change == null ? -sweep : (Math.max(-range, Math.min(range, change)) / range) * sweep;
  const id = useSvgId("sub");
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${id}f`} cx="50%" cy="40%" r="65%">
            <Stop offset="0" stopColor={colors.dialLight} />
            <Stop offset="1" stopColor="#08090B" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 1} fill={`url(#${id}f)`} stroke={colors.hairlineStrong} strokeWidth={1} />
        <Guilloche cx={c} cy={c} r={c - 3} rays={0} rings={Math.round(size / 7)} />
        <TickRing cx={c} cy={c} r={c - 5} count={range * 4} majorEvery={2} from={-sweep} to={sweep}
          minor={3} major={6} width={0.6} majorWidth={1.2} />
        <Circle cx={c} cy={13} r={1.6} fill={colors.gold} />
      </Svg>
      <Text style={[styles.subSym, { top: size * 0.6, width: size, color: accent }]}>{symbol}</Text>
      <Text style={[styles.subSign, { left: size * 0.14, top: size * 0.66 }]}>{ends[0]}</Text>
      <Text style={[styles.subSign, { right: size * 0.14, top: size * 0.66 }]}>{ends[1]}</Text>
      <AnimatedHand size={size} angle={angle} from={-sweep}>
        <Path d={`M ${c - 1.4} ${c + 6} L ${c} ${size * 0.13} L ${c + 1.4} ${c + 6} Z`} fill={accent} />
        <Circle cx={c} cy={c} r={3.4} fill={accent} />
        <Circle cx={c} cy={c} r={1.2} fill={colors.bg} />
      </AnimatedHand>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Balance wheel (busy indicator)
// ---------------------------------------------------------------------------

function spiral(cx: number, cy: number, r0: number, r1: number, turns: number) {
  const pts: string[] = [];
  const steps = turns * 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push(`${i ? "L" : "M"} ${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** An oscillating balance wheel over its hairspring, the heartbeat of a movement. */
export function BalanceWheel({ size = 72 }: { size?: number }) {
  const v = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const half = (to: number) => Animated.timing(v, { toValue: to, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver });
    const loop = Animated.loop(Animated.sequence([half(1), half(-1)]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const rotate = v.interpolate({ inputRange: [-1, 1], outputRange: ["-210deg", "210deg"] });
  const c = size / 2;
  const rim = size * 0.42;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path d={spiral(c, c, size * 0.05, size * 0.3, 7)} stroke={colors.steelDim} strokeWidth={0.6} fill="none" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={rim} stroke={colors.gold} strokeWidth={size * 0.05} fill="none" />
          <Circle cx={c} cy={c} r={rim + size * 0.025} stroke={colors.goldBright} strokeWidth={0.6} fill="none" />
          {[0, 120, 240].map((d) => {
            const p = polar(c, c, rim, d);
            return <Line key={d} x1={c} y1={c} x2={p.x} y2={p.y} stroke={colors.gold} strokeWidth={size * 0.035} strokeLinecap="round" />;
          })}
          {[30, 90, 150, 210, 270, 330].map((d) => {
            const p = polar(c, c, rim, d);
            return <Circle key={d} cx={p.x} cy={p.y} r={size * 0.03} fill={colors.goldBright} />;
          })}
          <Circle cx={c} cy={c} r={size * 0.06} fill={colors.ruby} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function Working({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 16 }}>
      <BalanceWheel />
      <Text style={[type.labelGold, { letterSpacing: 3 }]}>{title}</Text>
      {detail && <Text style={[type.italic, { textAlign: "center" }]}>{detail}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Coin frame: an exhibition caseback that turns over
// ---------------------------------------------------------------------------

export function CoinFrame({ size, front, back, onPress, onTurn, placeholder, ticks = true }: {
  size: number; front: string | null; back?: string | null; onPress?: () => void;
  /** Called with 0 (obverse) or 1 (reverse) after the coin is turned. */
  onTurn?: (side: 0 | 1) => void; placeholder?: string; ticks?: boolean;
}) {
  const id = useSvgId("frame");
  const flip = useRef(new Animated.Value(0)).current;
  const [side, setSide] = useState<0 | 1>(0);
  const canFlip = Boolean(front && back && !onPress);
  const c = size / 2;
  const inner = size * (ticks ? 0.8 : 0.9);

  const turn = () => {
    if (onPress) return onPress();
    if (!canFlip) return;
    haptic.tap();
    const next = side ? 0 : 1;
    setSide(next);
    onTurn?.(next);
    Animated.spring(flip, { toValue: next, useNativeDriver: nativeDriver, friction: 8, tension: 30 }).start();
  };

  const face = (uri: string | null | undefined, rot: Animated.AnimatedInterpolation<string>) => (
    <Animated.View style={[styles.face, { width: inner, height: inner, borderRadius: inner / 2, left: c - inner / 2, top: c - inner / 2, transform: [{ perspective: 800 }, { rotateY: rot }] }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: inner, height: inner }} />
      ) : (
        <View style={styles.emptyFace}>
          <Text style={[type.labelGold, { fontSize: Math.max(9, size * 0.06) }]}>{placeholder ?? "No image"}</Text>
        </View>
      )}
    </Animated.View>
  );

  return (
    <Pressable onPress={turn} disabled={!canFlip && !onPress} style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.goldBright} />
            <Stop offset="0.5" stopColor={colors.goldDeep} />
            <Stop offset="1" stopColor={colors.gold} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 1.5} fill={colors.dial} stroke={`url(#${id}b)`} strokeWidth={size > 100 ? 2.5 : 1.5} />
        {ticks && <TickRing cx={c} cy={c} r={c - 5} count={60} majorEvery={5} minor={size * 0.025} major={size * 0.05} width={0.5} majorWidth={1} color={colors.ivoryDim} majorColor={colors.gold} />}
        <Circle cx={c} cy={c} r={inner / 2 + 1.5} fill="none" stroke={colors.hairlineStrong} strokeWidth={1} />
      </Svg>
      {face(front, flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }))}
      {canFlip && face(back, flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] }))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  gain: { fontFamily: fonts.serifItalic, marginTop: 2 },
  window: {
    position: "absolute",
    height: 26,
    borderRadius: 2,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.goldDeep,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  windowSym: { fontFamily: fonts.engravedBold, fontSize: 8, color: colors.inkMuted, letterSpacing: 1 },
  windowText: { fontFamily: fonts.numeralBold, fontSize: 12, color: colors.ink, fontVariant: ["lining-nums", "tabular-nums"] },
  secLabel: { position: "absolute", left: 0, textAlign: "center", fontFamily: fonts.engraved, fontSize: 7.5, letterSpacing: 2, color: colors.muted, textTransform: "uppercase" },
  subSym: { position: "absolute", left: 0, textAlign: "center", fontFamily: fonts.engravedBold, fontSize: 9, letterSpacing: 1.5 },
  subSign: { position: "absolute", fontFamily: fonts.numeral, fontSize: 9, color: colors.ivoryDim },
  face: { position: "absolute", overflow: "hidden", backfaceVisibility: "hidden", backgroundColor: colors.dial },
  emptyFace: { flex: 1, alignItems: "center", justifyContent: "center" },
});
