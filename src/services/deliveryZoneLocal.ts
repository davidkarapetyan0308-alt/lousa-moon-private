import {
  DEFAULT_DELIVERY_RADIUS_KM,
  GYUMRI_DELIVERY_CENTER,
  checkGyumriDeliveryZone,
  type Coordinate,
  type DeliveryZoneCheck,
} from './deliveryZone';

export type DeliveryZoneTruth = DeliveryZoneCheck & {
  source: 'backend' | 'local-estimate';
  requiresManualReview?: boolean;
  includedInPlan?: boolean;
  planCode?: string | null;
  verifiedAt?: string | null;
};

export function checkGyumriDeliveryZoneLocal(coordinate: Coordinate): DeliveryZoneTruth {
  const result = checkGyumriDeliveryZone(coordinate, {
    center: GYUMRI_DELIVERY_CENTER,
    radiusKm: DEFAULT_DELIVERY_RADIUS_KM,
  });
  return {
    ...result,
    source: 'local-estimate',
    requiresManualReview: true,
    // A local radius is only a visual estimate. It must never unlock checkout.
    deliveryZoneId: null,
    deliveryFeeMinor: null,
    estimatedMinutes: null,
    includedInPlan: true,
    planCode: null,
    verifiedAt: null,
  };
}

export function normalizeBackendDeliveryZoneCheck(payload: any): DeliveryZoneTruth {
  if (!payload || typeof payload !== 'object') {
    throw new Error('DELIVERY_ZONE_RESPONSE_INVALID');
  }

  const isAvailable = typeof payload.isAvailable === 'boolean'
    ? payload.isAvailable
    : typeof payload.available === 'boolean'
      ? payload.available
      : null;

  if (isAvailable === null) {
    throw new Error('DELIVERY_ZONE_RESPONSE_INVALID');
  }

  return {
    isAvailable,
    deliveryZoneId: isAvailable ? payload.zoneId || payload.deliveryZoneId || null : null,
    distanceKm: Number(payload.distanceKm || 0),
    deliveryFeeMinor: isAvailable ? 0 : null,
    estimatedMinutes: isAvailable ? payload.etaMin ?? payload.estimatedMinutes ?? null : null,
    availableSlots: Array.isArray(payload.availableSlots) ? payload.availableSlots : [],
    reason: payload.message || payload.reason || null,
    source: 'backend',
    requiresManualReview: false,
    includedInPlan: payload.includedInPlan !== false,
    planCode: payload.planCode || null,
    verifiedAt: payload.verifiedAt || null,
  };
}

// Backward-compatible helper for old imports. Invalid backend payloads are no longer
// converted into a false success; callers must handle the thrown verification error.
export function normalizeDeliveryZoneCheck(payload: any, _coordinate?: Coordinate): DeliveryZoneTruth {
  return normalizeBackendDeliveryZoneCheck(payload);
}
