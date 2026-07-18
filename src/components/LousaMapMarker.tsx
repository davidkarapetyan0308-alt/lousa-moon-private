import React from 'react';
import { StyleSheet, View } from 'react-native';

import { LousaPalette, LousaShadow } from '../theme/designSystem';

export function LousaMapMarker({ compact = false }: { compact?: boolean }) {
  const scale = compact ? 0.82 : 1;
  return (
    <View style={[styles.wrapper, { transform: [{ scale }] }]} collapsable={false}>
      <View style={styles.pin}>
        <View style={styles.crescentBase}>
          <View style={styles.crescentCutout} />
        </View>
      </View>
      <View style={styles.tip} />
      <View style={styles.pulse} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 54,
    height: 66,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pin: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: LousaPalette.berry,
    borderWidth: 3,
    borderColor: LousaPalette.pearl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    ...LousaShadow.floating,
  },
  tip: {
    position: 'absolute',
    top: 35,
    width: 18,
    height: 18,
    backgroundColor: LousaPalette.berry,
    transform: [{ rotate: '45deg' }],
    borderBottomRightRadius: 4,
    zIndex: 2,
  },
  pulse: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(166,77,114,0.20)',
  },
  crescentBase: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LousaPalette.pearl,
    overflow: 'hidden',
  },
  crescentCutout: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    left: 7,
    top: -2,
    backgroundColor: LousaPalette.berry,
  },
});
