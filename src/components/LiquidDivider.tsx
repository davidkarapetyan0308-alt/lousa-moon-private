import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LiquidDividerProps {
  color?: string;
  marginVertical?: number;
}

/**
 * Liquid divider that fades at edges — per DESIGN.md:
 * "Lists should be separated by extremely thin (0.5px) metallic dividers
 *  that fade out at the edges (radial gradient)."
 */
export function LiquidDivider({ color = 'rgba(128,116,116,0.3)', marginVertical = 0 }: LiquidDividerProps) {
  return (
    <LinearGradient
      colors={['transparent', color, 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.divider, { marginVertical }]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
  },
});
