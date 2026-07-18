import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LousaMapLibreAddressMap } from './LousaMapLibreAddressMap';
import { LousaPalette } from '../theme/designSystem';

export function RealMapPreview({
  latitude,
  longitude,
  height = 190,
  interactive = false,
  label,
}: {
  latitude: number;
  longitude: number;
  height?: number;
  interactive?: boolean;
  label?: string;
}) {
  return (
    <View style={[styles.container, { height }]}> 
      <LousaMapLibreAddressMap
        latitude={latitude}
        longitude={longitude}
        height={height}
        interactive={interactive}
        label={label}
        showDeliveryZone={false}
        unavailableText={label || 'Selected delivery point'}
      />
      {label ? (
        <View pointerEvents="none" style={styles.previewCaption}>
          <Text style={styles.previewCaptionText} numberOfLines={1}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#EFE9EC',
    borderWidth: 1,
    borderColor: LousaPalette.line,
  },
  previewCaption: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 10,
    minHeight: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(255,253,254,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  previewCaptionText: {
    color: LousaPalette.ink,
    fontFamily: 'sans-serif-medium',
    fontSize: 12,
  },
});
