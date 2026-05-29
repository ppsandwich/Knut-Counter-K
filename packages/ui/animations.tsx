/**
 * Animation utilities for Knut Counter
 * 
 * Provides consistent, reusable animations across the app.
 */

import { useEffect, useRef } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated";

// ─── Timing presets ──────────────────────────────────────────────────────────

export const timing = {
  /** Fast transitions (150ms) - button presses, toggles */
  fast: { duration: 150, easing: Easing.out(Easing.quad) },
  /** Normal transitions (250ms) - cards, panels */
  normal: { duration: 250, easing: Easing.out(Easing.cubic) },
  /** Slow transitions (400ms) - page transitions, large elements */
  slow: { duration: 400, easing: Easing.out(Easing.cubic) },
  /** Extra slow (600ms) - hero animations, emphasis */
  extraSlow: { duration: 600, easing: Easing.out(Easing.cubic) },
} as const;

// ─── Spring presets ──────────────────────────────────────────────────────────

export const spring = {
  /** Gentle spring for cards and panels */
  gentle: { damping: 15, stiffness: 150, mass: 1 },
  /** Bouncy spring for interactive elements */
  bouncy: { damping: 10, stiffness: 200, mass: 0.8 },
  /** Stiff spring for quick responses */
  stiff: { damping: 20, stiffness: 300, mass: 0.5 },
} as const;

// ─── Fade In ─────────────────────────────────────────────────────────────────

export function useFadeIn(options?: { delay?: number; duration?: number }) {
  const opacity = useSharedValue(0);
  const { delay = 0, duration = timing.normal.duration } = options ?? {};

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: timing.normal.easing }));
  }, [delay, duration, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return { style, opacity };
}

// ─── Slide Up ────────────────────────────────────────────────────────────────

export function useSlideUp(options?: { delay?: number; distance?: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(options?.distance ?? 20);
  const { delay = 0 } = options ?? {};

  useEffect(() => {
    const config = { duration: timing.normal.duration, easing: timing.normal.easing };
    opacity.value = withDelay(delay, withTiming(1, config));
    translateY.value = withDelay(delay, withTiming(0, config));
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return { style, opacity, translateY };
}

// ─── Slide In From Left ──────────────────────────────────────────────────────

export function useSlideInLeft(options?: { delay?: number; distance?: number }) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-(options?.distance ?? 30));
  const { delay = 0 } = options ?? {};

  useEffect(() => {
    const config = { duration: timing.normal.duration, easing: timing.normal.easing };
    opacity.value = withDelay(delay, withTiming(1, config));
    translateX.value = withDelay(delay, withTiming(0, config));
  }, [delay, opacity, translateX]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return { style, opacity, translateX };
}

// ─── Scale In ────────────────────────────────────────────────────────────────

export function useScaleIn(options?: { delay?: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const { delay = 0 } = options ?? {};

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, timing.normal));
    scale.value = withDelay(delay, withSpring(1, spring.gentle));
  }, [delay, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return { style, opacity, scale };
}

// ─── Staggered List ──────────────────────────────────────────────────────────

export function useStaggeredAnimation(index: number, options?: { staggerDelay?: number; baseDelay?: number }) {
  const { staggerDelay = 80, baseDelay = 100 } = options ?? {};
  const delay = baseDelay + index * staggerDelay;

  return useSlideUp({ delay, distance: 15 });
}

// ─── Animated Counter ────────────────────────────────────────────────────────

export function useAnimatedNumber(targetValue: number, options?: { duration?: number; delay?: number }) {
  const animatedValue = useSharedValue(0);
  const { duration = timing.slow.duration, delay = 0 } = options ?? {};

  useEffect(() => {
    animatedValue.value = withDelay(
      delay,
      withTiming(targetValue, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [targetValue, duration, delay, animatedValue]);

  return animatedValue;
}

// ─── Pulse Animation ─────────────────────────────────────────────────────────

export function usePulse(options?: { minOpacity?: number; maxOpacity?: number; duration?: number }) {
  const opacity = useSharedValue(options?.minOpacity ?? 0.5);
  const { minOpacity = 0.5, maxOpacity = 1, duration = 1000 } = options ?? {};

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(maxOpacity, { duration: duration / 2, easing: Easing.inOut(Easing.quad) }),
        withTiming(minOpacity, { duration: duration / 2, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(opacity);
    };
  }, [minOpacity, maxOpacity, duration, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return { style, opacity };
}

// ─── Progress Bar Animation ──────────────────────────────────────────────────

export function useProgressAnimation(targetProgress: number, options?: { duration?: number; delay?: number }) {
  const width = useSharedValue(0);
  const { duration = timing.slow.duration, delay = 300 } = options ?? {};

  useEffect(() => {
    width.value = withDelay(
      delay,
      withTiming(targetProgress * 100, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [targetProgress, duration, delay, width]);

  const style = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return { style, width };
}

// ─── Draw Line (for sparklines) ──────────────────────────────────────────────

export function useDrawLine(options?: { delay?: number; duration?: number }) {
  const progress = useSharedValue(0);
  const { delay = 500, duration = 800 } = options ?? {};

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [delay, duration, progress]);

  return progress;
}

// ─── Press Scale ─────────────────────────────────────────────────────────────

export function usePressScale(scaleTo = 0.97) {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withSpring(scaleTo, spring.stiff);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, spring.stiff);
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { style, onPressIn, onPressOut };
}

// ─── Shake Animation ─────────────────────────────────────────────────────────

export function useShake() {
  const translateX = useSharedValue(0);

  const shake = () => {
    translateX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return { style, shake };
}

// ─── Animated Wrapper Components ─────────────────────────────────────────────

interface AnimatedCardProps {
  children: React.ReactNode;
  index?: number;
  style?: any;
}

export function AnimatedCard({ children, index = 0, style }: AnimatedCardProps) {
  const { style: animStyle } = useStaggeredAnimation(index);

  return (
    <Animated.View style={[animStyle, style]}>
      {children}
    </Animated.View>
  );
}

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}

export function FadeInView({ children, delay = 0, style }: FadeInViewProps) {
  const { style: animStyle } = useFadeIn({ delay });

  return (
    <Animated.View style={[animStyle, style]}>
      {children}
    </Animated.View>
  );
}

interface SlideUpViewProps {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: any;
}

export function SlideUpView({ children, delay = 0, distance = 20, style }: SlideUpViewProps) {
  const { style: animStyle } = useSlideUp({ delay, distance });

  return (
    <Animated.View style={[animStyle, style]}>
      {children}
    </Animated.View>
  );
}
