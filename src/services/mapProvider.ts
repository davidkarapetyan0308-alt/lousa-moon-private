import { Platform } from 'react-native';

import { GYUMRI_DELIVERY_CENTER } from './deliveryZone';

export type LousaMapProvider =
  | 'maplibre-maptiler'
  | 'maplibre-custom'
  | 'maplibre-openfreemap'
  | 'manual-fallback';
export type LousaMapProviderStatus = 'ready' | 'missing_provider' | 'demo_forbidden' | 'blocked';

export interface LousaMapProviderConfig {
  provider: LousaMapProvider;
  status: LousaMapProviderStatus;
  styleUrl: string | null;
  attribution: string;
  isProductionReady: boolean;
  warning: string | null;
  manualFallbackRequired: boolean;
}

// Mobile map styles must be public URLs. Backend-only keys must never be bundled.
const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY || '';
const CUSTOM_STYLE_URL = process.env.EXPO_PUBLIC_LOUSA_MAP_STYLE_URL || process.env.LOUSA_MAP_STYLE_URL || '';
const MAPTILER_STYLE_ID = process.env.EXPO_PUBLIC_MAPTILER_STYLE_ID || 'dataviz';
const OPENFREEMAP_STYLE_URL =
  process.env.EXPO_PUBLIC_OPENFREEMAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
const DISABLE_PUBLIC_FALLBACK = process.env.EXPO_PUBLIC_DISABLE_PUBLIC_MAP_FALLBACK === 'true';

export const LOUSA_MAP_CENTER = GYUMRI_DELIVERY_CENTER;
export const LOUSA_MAP_MIN_ZOOM = 10;
export const LOUSA_MAP_DEFAULT_ZOOM = 13;
export const LOUSA_MAP_PICKER_ZOOM = 16;

function isForbiddenDemoStyle(styleUrl: string) {
  return /demotiles\.maplibre\.org|MapLibre demo tiles|demo tiles/i.test(styleUrl);
}

function readyConfig(
  provider: Exclude<LousaMapProvider, 'manual-fallback'>,
  styleUrl: string,
  attribution: string,
  warning: string | null = null,
): LousaMapProviderConfig {
  return {
    provider,
    status: 'ready',
    styleUrl,
    attribution,
    isProductionReady: true,
    warning,
    manualFallbackRequired: false,
  };
}

export function getLousaMapProviderConfig(): LousaMapProviderConfig {
  const custom = CUSTOM_STYLE_URL.trim();
  if (custom) {
    if (isForbiddenDemoStyle(custom)) {
      return {
        provider: 'manual-fallback',
        status: 'demo_forbidden',
        styleUrl: null,
        attribution: '',
        isProductionReady: false,
        warning: 'MAP_DEMO_STYLE_FORBIDDEN',
        manualFallbackRequired: true,
      };
    }
    return readyConfig('maplibre-custom', custom, '© OpenStreetMap contributors');
  }

  const key = MAPTILER_KEY.trim();
  if (key) {
    return readyConfig(
      'maplibre-maptiler',
      `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${encodeURIComponent(key)}`,
      '© OpenStreetMap contributors · MapTiler',
    );
  }

  const publicStyle = OPENFREEMAP_STYLE_URL.trim();
  if (!DISABLE_PUBLIC_FALLBACK && publicStyle && !isForbiddenDemoStyle(publicStyle)) {
    return readyConfig(
      'maplibre-openfreemap',
      publicStyle,
      '© OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors',
      'PUBLIC_MAP_STYLE',
    );
  }

  return {
    provider: 'manual-fallback',
    status: DISABLE_PUBLIC_FALLBACK ? 'blocked' : 'missing_provider',
    styleUrl: null,
    attribution: '',
    isProductionReady: false,
    warning: 'MAP_PROVIDER_NOT_CONFIGURED',
    manualFallbackRequired: true,
  };
}

export function shouldRenderInteractiveMap(config = getLousaMapProviderConfig()) {
  return Platform.OS !== 'web' && config.status === 'ready' && Boolean(config.styleUrl);
}

export function makeDeliveryZoneCircleGeoJson(
  latitude: number,
  longitude: number,
  radiusKm: number,
  points = 80,
) {
  const coordinates: [number, number][] = [];
  const earthRadiusKm = 6371;
  const latRad = (latitude * Math.PI) / 180;
  const lngRad = (longitude * Math.PI) / 180;
  const angularDistance = radiusKm / earthRadiusKm;

  for (let i = 0; i <= points; i += 1) {
    const bearing = (2 * Math.PI * i) / points;
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLng = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat),
    );
    coordinates.push([(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI]);
  }

  return {
    type: 'Feature' as const,
    properties: { id: 'lousa-gyumri-main-zone' },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coordinates],
    },
  };
}
