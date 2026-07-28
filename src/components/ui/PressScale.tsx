import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Motion } from '../../theme/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressScaleProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityState?: PressableProps['accessibilityState'];
  accessibilityHint?: string;
  testID?: string;
  hitSlop?: PressableProps['hitSlop'];
};

export function PressScale({
  children,
  onPress,
  style,
  disabled,
  haptic = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityHint,
  testID,
  hitSlop,
}: PressScaleProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      testID={testID}
      hitSlop={hitSlop ?? 6}
      disabled={disabled}
      onPressIn={() => {
        if (reducedMotion) {
          opacity.value = withTiming(0.82, { duration: Motion.duration.instant });
          return;
        }
        scale.value = withSpring(0.985, Motion.spring.press);
        opacity.value = withTiming(0.92, { duration: Motion.duration.instant });
      }}
      onPressOut={() => {
        scale.value = reducedMotion ? 1 : withSpring(1, Motion.spring.press);
        opacity.value = withTiming(1, { duration: Motion.duration.instant });
      }}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={[animatedStyle, style, disabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
