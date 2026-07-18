import { Easing, ReduceMotion } from 'react-native-reanimated';

/**
 * LOUSA motion system.
 * Calm, fast transitions with automatic support for the OS Reduce Motion setting.
 */
export const Motion = {
  duration: {
    instant: 120,
    fast: 180,
    normal: 240,
    slow: 320,
    expressive: 480,
  },
  stagger: {
    compact: 30,
    regular: 45,
  },
  easing: {
    standard: Easing.out(Easing.cubic),
    emphasized: Easing.inOut(Easing.cubic),
    exit: Easing.in(Easing.cubic),
  },
  spring: {
    press: { damping: 20, stiffness: 320, mass: 0.55 },
    sheet: { damping: 24, stiffness: 260, mass: 0.7 },
    selection: { damping: 18, stiffness: 280, mass: 0.6 },
  },
  reduceMotion: ReduceMotion.System,
} as const;
