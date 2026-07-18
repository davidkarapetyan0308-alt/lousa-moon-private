import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Deliberately sparse: ambient decoration must not compete with content.
const STARS = Array.from({ length: 12 }, (_, i) => ({
  x: ((i * 137.508) % 100),
  y: ((i * 71.137) % 100),
  size: 1 + (i % 3) * 0.45,
  delay: (i * 260) % 2400,
  opacity: 0.18 + (i % 4) * 0.1,
}));

function Star({ x, y, size, delay, opacity, reducedMotion }: typeof STARS[0] & { reducedMotion: boolean }) {
  const twinkle = useSharedValue(opacity);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(twinkle);
      twinkle.value = opacity;
      return;
    }
    twinkle.value = withRepeat(
      withSequence(
        withTiming(opacity * 0.55, { duration: 3600 + delay, easing: Easing.inOut(Easing.ease) }),
        withTiming(opacity, { duration: 3600 + delay, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(twinkle);
  }, [delay, opacity, reducedMotion, twinkle]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: twinkle.value }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#fff',
        },
        animatedStyle,
      ]}
    />
  );
}

function CloudLayer({ reducedMotion }: { reducedMotion: boolean }) {
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(drift);
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: 45000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(drift);
  }, [drift, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, 12]) },
      { translateY: interpolate(drift.value, [0, 1], [0, -10]) },
      { scale: interpolate(drift.value, [0, 1], [1, 1.04]) },
    ],
  }));

  return (
    <Animated.View style={[styles.cloudLayer, animatedStyle]}>
      <View style={[styles.cloud, styles.cloudRose]} />
      <View style={[styles.cloud, styles.cloudLavender]} />
    </Animated.View>
  );
}

interface AmbientBackgroundProps {
  variant?: 'cosmic' | 'liquid' | 'minimal';
}

export function AmbientBackground({ variant = 'cosmic' }: AmbientBackgroundProps) {
  const reducedMotion = useReducedMotion();

  if (variant === 'liquid') {
    return (
      <View style={styles.container} pointerEvents="none">
        <LinearGradient
          colors={['rgba(244, 221, 230, 0.28)', 'transparent']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(184, 166, 217, 0.12)', 'transparent']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  if (variant === 'minimal') {
    return (
      <View style={styles.container} pointerEvents="none">
        <LinearGradient
          colors={['#FBF4F7', '#FBF4F7', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={['#17131D', '#1D1824', '#17131D']}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.starsLayer}>
        {STARS.map((star, i) => <Star key={i} {...star} reducedMotion={reducedMotion} />)}
      </View>
      <CloudLayer reducedMotion={reducedMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
  starsLayer: { ...StyleSheet.absoluteFillObject, zIndex: -2 },
  cloudLayer: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
  cloud: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.34 },
  cloudRose: { left: '15%', top: '25%', backgroundColor: 'rgba(217, 133, 165, 0.09)' },
  cloudLavender: { right: '10%', bottom: '30%', backgroundColor: 'rgba(184, 166, 217, 0.07)' },
});
