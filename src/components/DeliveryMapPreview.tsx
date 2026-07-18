import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { LousaMapLibreAddressMap } from './LousaMapLibreAddressMap';
import { LousaPalette, LousaShadow } from '../theme/designSystem';

export function DeliveryMapPreview({
  title,
  eta,
  latitude,
  longitude,
  demo: _demo = false,
}: {
  title: string;
  eta: string;
  latitude?: number | null;
  longitude?: number | null;
  demo?: boolean;
}) {
  const hasCoordinate = Number.isFinite(latitude) && Number.isFinite(longitude);

  return (
    <View style={styles.card}>
      <View style={styles.map}>
        {hasCoordinate ? (
          <LousaMapLibreAddressMap
            latitude={latitude as number}
            longitude={longitude as number}
            height={210}
            interactive={false}
            label={title}
            showDeliveryZone={false}
            unavailableText="Delivery address"
          />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackTitle}>Delivery address</Text>
            <Text style={styles.fallbackText}>Map point is not available yet</Text>
          </View>
        )}
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>LOUSA MAP</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Image source={require('../../assets/images/delivery/courier-avatar.png')} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.eta}>{eta}</Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>LIVE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFDFE',
    borderWidth: 1,
    borderColor: LousaPalette.line,
    ...LousaShadow.soft,
  },
  map: {
    height: 210,
    overflow: 'hidden',
    backgroundColor: '#F4EEF1',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  fallbackTitle: {
    color: LousaPalette.ink,
    fontFamily: 'sans-serif-medium',
    fontSize: 14,
  },
  fallbackText: {
    color: LousaPalette.inkSoft,
    fontFamily: 'sans-serif',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  mapBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,254,0.94)',
  },
  mapBadgeText: {
    color: LousaPalette.berry,
    fontFamily: 'sans-serif-medium',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  footer: {
    minHeight: 92,
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  title: { fontFamily: 'sans-serif-medium', fontSize: 14, color: LousaPalette.ink },
  eta: { fontFamily: 'sans-serif', fontSize: 12, color: LousaPalette.inkSoft, marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E7F3EC', borderRadius: 999, paddingHorizontal: 9, height: 30 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3D8A5B' },
  statusText: { fontFamily: 'sans-serif-medium', fontSize: 12, color: '#3D8A5B', letterSpacing: 0.8 },
});
