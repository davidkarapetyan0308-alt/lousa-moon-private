import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Motion } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function AnimatedScreen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? FadeIn.duration(Motion.duration.instant) : FadeIn.duration(Motion.duration.fast).easing(Motion.easing.standard)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export function AnimatedSection({
  children,
  style,
  delay = 0,
  enabled = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  enabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const entering = !enabled
    ? undefined
    : reduced
      ? FadeIn.duration(Motion.duration.instant)
      : FadeInDown.duration(Motion.duration.normal).delay(Math.min(delay, 120)).easing(Motion.easing.standard);

  return (
    <Animated.View
      entering={entering}
      exiting={reduced ? undefined : FadeOut.duration(Motion.duration.fast)}
      layout={reduced ? undefined : LinearTransition.duration(Motion.duration.fast)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
