export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface DeliveryZoneCheck {
  isAvailable: boolean;
  deliveryZoneId: string | null;
  distanceKm: number;
  deliveryFeeMinor: number | null;
  estimatedMinutes: number | null;
  availableSlots: string[];
  reason: string | null;
}

export const GYUMRI_DELIVERY_CENTER: Coordinate = {
  latitude: 40.7929,
  longitude: 43.8465,
};

export const DEFAULT_DELIVERY_RADIUS_KM = 15;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKmBetween(a: Coordinate, b: Coordinate) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const firstLatitude = toRadians(a.latitude);
  const secondLatitude = toRadians(b.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function checkGyumriDeliveryZone(
  coordinate: Coordinate,
  options: {
    center?: Coordinate;
    radiusKm?: number;
    baseFeeMinor?: number;
  } = {},
): DeliveryZoneCheck {
  const center = options.center ?? GYUMRI_DELIVERY_CENTER;
  const radiusKm = options.radiusKm ?? DEFAULT_DELIVERY_RADIUS_KM;
  // Delivery is included in every active LOUSA plan. The option remains in the
  // signature for backwards compatibility, but pricing is never derived here.
  void options.baseFeeMinor;
  const distanceKm = distanceKmBetween(center, coordinate);
  const isAvailable = distanceKm <= radiusKm;

  if (!isAvailable) {
    return {
      isAvailable: false,
      deliveryZoneId: null,
      distanceKm: Number(distanceKm.toFixed(2)),
      deliveryFeeMinor: null,
      estimatedMinutes: null,
      availableSlots: [],
      reason: 'OUTSIDE_GYUMRI_DELIVERY_ZONE',
    };
  }

  return {
    isAvailable: true,
    deliveryZoneId: 'gyumri-main',
    distanceKm: Number(distanceKm.toFixed(2)),
    deliveryFeeMinor: 0,
    estimatedMinutes: Math.max(20, Math.round(20 + distanceKm * 3)),
    availableSlots: ['10:00–14:00', '14:00–18:00', '18:00–21:00'],
    reason: null,
  };
}
