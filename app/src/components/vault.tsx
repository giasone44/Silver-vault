import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { colors, fonts, haptic, nativeDriver } from "../lib/theme";

/*
 * The bank-vault parts of the look: a round steel vault door that swings open
 * when the app starts, and the riveted door ring around the portfolio dial.
 * Drawn on a 1000-unit canvas and scaled to size.
 */

const useSvgId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
const C = 500;
const ring = (n: number, r: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((i * 360) / n + offset - 90) * (Math.PI / 180);
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a), deg: (i * 360) / n + offset };
  });

function SteelDefs({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={`${id}steel`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#E9ECEF" />
        <Stop offset="0.3" stopColor="#8D939B" />
        <Stop offset="0.55" stopColor="#C9CDD3" />
        <Stop offset="1" stopColor="#3F434A" />
      </LinearGradient>
      <RadialGradient id={`${id}face`} cx="42%" cy="35%" r="75%">
        <Stop offset="0" stopColor="#A7ADB5" />
        <Stop offset="0.55" stopColor="#6C727A" />
        <Stop offset="1" stopColor="#2E3137" />
      </RadialGradient>
      <RadialGradient id={`${id}frame`} cx="50%" cy="40%" r="60%">
        <Stop offset="0" stopColor="#4A4E55" />
        <Stop offset="1" stopColor="#1A1C20" />
      </RadialGradient>
      <RadialGradient id={`${id}inside`} cx="50%" cy="55%" r="50%">
        <Stop offset="0" stopColor="#6B5424" />
        <Stop offset="0.6" stopColor="#241C0D" />
        <Stop offset="1" stopColor="#050506" />
      </RadialGradient>
      <RadialGradient id={`${id}rivet`} cx="35%" cy="30%" r="70%">
        <Stop offset="0" stopColor="#F4F6F8" />
        <Stop offset="1" stopColor="#4B4F56" />
      </RadialGradient>
      <LinearGradient id={`${id}gold`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={colors.goldBright} />
        <Stop offset="0.5" stopColor={colors.gold} />
        <Stop offset="1" stopColor={colors.goldDeep} />
      </LinearGradient>
    </Defs>
  );
}

/** Frame set into the wall, with the lit vault interior behind the door. */
function DoorFrame({ size }: { size: number }) {
  const id = useSvgId("frame");
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      <SteelDefs id={id} />
      <Circle cx={C} cy={C} r={492} fill={`url(#${id}frame)`} />
      <Circle cx={C} cy={C} r={492} fill="none" stroke="#000" strokeOpacity={0.7} strokeWidth={6} />
      <Circle cx={C} cy={C} r={478} fill="none" stroke={`url(#${id}steel)`} strokeWidth={3} strokeOpacity={0.6} />
      {ring(40, 462).map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={7} fill={`url(#${id}rivet)`} />)}
      <Circle cx={C} cy={C} r={440} fill={`url(#${id}inside)`} />
      {/* Hinges on the right, where the door swings from. */}
      {[330, 670].map((y) => (
        <Rect key={y} x={905} y={y - 45} width={80} height={90} rx={10} fill={`url(#${id}steel)`} stroke="#15161A" strokeWidth={4} />
      ))}
    </Svg>
  );
}

/** Locking bolts. Drawn on their own so they can slide back into the door. */
function DoorBolts({ size }: { size: number }) {
  const id = useSvgId("bolts");
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      <SteelDefs id={id} />
      {ring(16, 0, 11.25).map((p, i) => (
        <G key={i} transform={`rotate(${p.deg} ${C} ${C})`}>
          <Rect x={C - 20} y={40} width={40} height={90} rx={8} fill={`url(#${id}steel)`} stroke="#1A1C20" strokeWidth={3} />
        </G>
      ))}
    </Svg>
  );
}

/** The door face: brushed steel with machined rings and a riveted rim. */
function DoorFace({ size }: { size: number }) {
  const id = useSvgId("face");
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      <SteelDefs id={id} />
      <Circle cx={C} cy={C} r={430} fill="#0B0C0E" />
      <Circle cx={C} cy={C} r={424} fill={`url(#${id}face)`} />
      <Circle cx={C} cy={C} r={424} fill="none" stroke={`url(#${id}steel)`} strokeWidth={10} />
      {ring(32, 396).map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={9} fill={`url(#${id}rivet)`} stroke="#23252A" strokeWidth={2} />)}
      {[370, 340, 300, 250].map((r, i) => (
        <Circle key={r} cx={C} cy={C} r={r} fill="none" stroke={i % 2 ? "#E6E9EC" : "#1E2024"} strokeOpacity={i % 2 ? 0.35 : 0.6} strokeWidth={i === 0 ? 6 : 3} />
      ))}
      <Circle cx={C} cy={C} r={160} fill="#1C1E22" stroke={`url(#${id}gold)`} strokeWidth={6} />
    </Svg>
  );
}

/** One slice of the door's thickness. Stacked slices form its heavy stepped steel edge. */
function DoorSlice({ size, r, fill, groove }: { size: number; r: number; fill: string; groove?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      <Circle cx={C} cy={C} r={r} fill={fill} stroke={groove ? "#1A1C20" : fill} strokeWidth={groove ? 6 : 0} />
    </Svg>
  );
}

// The door's depth, front to back: a full-width armour plate, then a narrower
// stepped plug carrying three rows of locking bolts, like a Mosler or Diebold door.
const THICKNESS = 0.2; // of the door's diameter
const SLICES = 26;
const slice = (i: number) => {
  const f = i / (SLICES - 1);
  const plate = f < 0.38;
  const tone = Math.round(150 - f * 70); // brighter at the front, shadowed toward the back
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return {
    f,
    r: plate ? 424 : f < 0.42 ? 404 : 392,
    fill: `#${hex(tone)}${hex(tone + 5)}${hex(tone + 12)}`,
    groove: plate ? i % 4 === 3 : i % 3 === 0,
  };
};
const BOLT_ROWS = [0.52, 0.68, 0.84];

/** The spoked handle wheel, drawn on its own so it can turn. */
export function VaultWheel({ size }: { size: number }) {
  const id = useSvgId("wheel");
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      <SteelDefs id={id} />
      {ring(6, 0).map((p, i) => (
        <G key={i} transform={`rotate(${p.deg} ${C} ${C})`}>
          <Rect x={C - 13} y={C - 290} width={26} height={290} rx={10} fill={`url(#${id}steel)`} stroke="#1A1C20" strokeWidth={3} />
          <Circle cx={C} cy={C - 300} r={30} fill={`url(#${id}rivet)`} stroke="#1A1C20" strokeWidth={3} />
        </G>
      ))}
      <Circle cx={C} cy={C} r={205} fill="none" stroke="#1A1C20" strokeWidth={34} />
      <Circle cx={C} cy={C} r={205} fill="none" stroke={`url(#${id}steel)`} strokeWidth={26} />
      <Circle cx={C} cy={C} r={70} fill={`url(#${id}gold)`} stroke="#3A2C10" strokeWidth={4} />
      <SvgText x={C} y={C + 22} textAnchor="middle" fontFamily={fonts.engravedBold} fontSize={62} fill="#2A2012">
        SV
      </SvgText>
    </Svg>
  );
}

/** One depth layer of the door, turning about the hinge on the right edge. */
function DoorLayer({ depth, rotateY, children }: { depth: number; rotateY: Animated.AnimatedInterpolation<string>; children: ReactNode }) {
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transformOrigin: ["100%", "50%", depth], transform: [{ perspective: 1400 }, { rotateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

// The door opens once each time the app starts, not on every screen change.
let opened = false;

/** Full-screen vault door that unlocks and swings open as the app starts. Tap to skip. */
export function VaultEntrance() {
  const [show, setShow] = useState(!opened);
  const { width, height } = useWindowDimensions();
  const size = Math.min(width * 0.96, height * 0.66, 620);
  const wheel = useRef(new Animated.Value(0)).current;
  const bolts = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    opened = true;
    setShow(false);
  };

  const skip = () => {
    Animated.timing(leave, { toValue: 1, duration: 200, useNativeDriver: nativeDriver }).start(finish);
  };

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    const t = (v: Animated.Value, duration: number, easing = Easing.inOut(Easing.cubic)) =>
      Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: nativeDriver });
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) return finish();
        haptic.tap();
        Animated.sequence([
          Animated.delay(250),
          t(wheel, 950),
          t(bolts, 260, Easing.in(Easing.quad)),
          t(swing, 1300, Easing.out(Easing.cubic)),
          Animated.delay(500), // hold on the open door
          t(leave, 550, Easing.in(Easing.quad)),
        ]).start(finish);
        setTimeout(() => !cancelled && haptic.press(), 250 + 950 + 200); // the bolts' clunk
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  const doorSize = size * 0.98; // the door's own square; its bolts reach into the frame
  const rotate = wheel.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-300deg"] });
  const boltScale = bolts.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const rotateY = swing.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-58deg"] });
  const shift = swing.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.14] });
  const opacity = leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const scale = leave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wall, { opacity }]}>
      <Pressable style={styles.fill} onPress={skip} accessibilityRole="button" accessibilityLabel="Open the vault">
        <Animated.Text style={[styles.title, { opacity: bolts.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>SILVER VAULT</Animated.Text>
        <Animated.View style={{ width: size, height: size, transform: [{ translateX: shift }, { scale }] }}>
          <View style={StyleSheet.absoluteFill}>
            <DoorFrame size={size} />
          </View>
          <View style={[styles.door, { width: doorSize, height: doorSize, left: (size - doorSize) / 2, top: (size - doorSize) / 2 }]}>
            {/* Back to front. Each layer turns about the hinge from its own depth, so the open door shows its thickness. */}
            {Array.from({ length: SLICES }, (_, i) => SLICES - 1 - i).map((i) => {
              const sl = slice(i);
              return (
                <DoorLayer key={`s${i}`} depth={sl.f * THICKNESS * doorSize} rotateY={rotateY}>
                  <DoorSlice size={doorSize} r={sl.r} fill={sl.fill} groove={sl.groove} />
                </DoorLayer>
              );
            })}
            {BOLT_ROWS.flatMap((row) => [0, 1, 2].map((k) => row + (k - 1) * 0.012)).reverse().map((f) => (
              <DoorLayer key={`b${f}`} depth={f * THICKNESS * doorSize} rotateY={rotateY}>
                <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: boltScale }] }]}>
                  <DoorBolts size={doorSize} />
                </Animated.View>
              </DoorLayer>
            ))}
            <DoorLayer depth={0} rotateY={rotateY}>
              <DoorFace size={doorSize} />
            </DoorLayer>
            <DoorLayer depth={-2} rotateY={rotateY}>
              <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
                <VaultWheel size={doorSize} />
              </Animated.View>
            </DoorLayer>
          </View>
        </Animated.View>
        <Text style={styles.hint}>Tap to enter</Text>
      </Pressable>
    </Animated.View>
  );
}

/** A riveted steel vault-door ring with locking bolts, set around the portfolio dial. */
export function VaultRing({ size, band, children }: { size: number; band: number; children: ReactNode }) {
  const id = useSvgId("vring");
  const k = 1000 / size; // screen points → canvas units
  const rOuter = 498;
  const rInner = C - band * k;
  const mid = (rOuter + rInner) / 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 1000 1000" style={StyleSheet.absoluteFill}>
        <SteelDefs id={id} />
        <Circle cx={C} cy={C} r={rOuter} fill={`url(#${id}frame)`} />
        <Circle cx={C} cy={C} r={rOuter - 4} fill="none" stroke={`url(#${id}steel)`} strokeWidth={6} />
        <Circle cx={C} cy={C} r={rInner + 2} fill="none" stroke="#000" strokeOpacity={0.8} strokeWidth={6} />
        {ring(8, mid, 22.5).map((p, i) => (
          <G key={`b${i}`} transform={`rotate(${p.deg} ${C} ${C})`}>
            <Rect x={C - 16} y={C - mid - (rOuter - rInner) * 0.28} width={32} height={(rOuter - rInner) * 0.56} rx={7} fill={`url(#${id}steel)`} stroke="#15161A" strokeWidth={3} />
          </G>
        ))}
        {ring(40, mid).map((p, i) =>
          i % 5 === 2 ? null : <Circle key={i} cx={p.x} cy={p.y} r={6} fill={`url(#${id}rivet)`} stroke="#1A1C20" strokeWidth={1.5} />,
        )}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { backgroundColor: "#0A0A0C", zIndex: 1000 },
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  door: { position: "absolute" },
  title: { fontFamily: fonts.engravedBold, color: colors.gold, fontSize: 18, letterSpacing: 8, marginBottom: 28 },
  hint: { position: "absolute", bottom: 48, fontFamily: fonts.engraved, color: colors.muted, fontSize: 10, letterSpacing: 3, textTransform: "uppercase" },
});
