import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { haptic, nativeDriver } from "../lib/theme";

/** A pressable that settles in slightly under the finger, like a pusher. */
export function PressableScale({
  children,
  style,
  onPress,
  feedback = "select",
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  feedback?: "select" | "tap" | "press" | "none";
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        to(0.97);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback !== "none") haptic[feedback]();
        onPress?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Counts smoothly between values, like a mechanical counter settling. */
export function AnimatedNumber({
  value,
  format,
  style,
  duration = 900,
}: {
  value: number | null;
  format: (n: number | null) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<number | null>(value == null ? null : 0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(v));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (value == null) return setShown(null);
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, value, duration]);

  return <Text style={style}>{format(shown)}</Text>;
}

/** Fades and lifts content in on mount; `delay` staggers siblings. */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}
