import {
  checkGyumriDeliveryZoneLocal,
  normalizeBackendDeliveryZoneCheck,
} from '../src/services/deliveryZoneLocal';
import { GYUMRI_DELIVERY_CENTER } from '../src/services/deliveryZone';

describe('delivery-zone truth boundary', () => {
  it('marks the local radius only as an estimate and never exposes checkout data', () => {
    const result = checkGyumriDeliveryZoneLocal(GYUMRI_DELIVERY_CENTER);
    expect(result.source).toBe('local-estimate');
    expect(result.requiresManualReview).toBe(true);
    expect(result.deliveryZoneId).toBeNull();
    expect(result.deliveryFeeMinor).toBeNull();
    expect(result.estimatedMinutes).toBeNull();
  });

  it('accepts an explicit backend result as verified truth', () => {
    const result = normalizeBackendDeliveryZoneCheck({
      available: true,
      zoneId: 'gyumri-standard',
      distanceKm: 2.4,
      feeMinor: 70000,
      etaMin: 24,
      availableSlots: ['10:00–14:00'],
    });
    expect(result.source).toBe('backend');
    expect(result.isAvailable).toBe(true);
    expect(result.deliveryZoneId).toBe('gyumri-standard');
    expect(result.deliveryFeeMinor).toBe(0);
    expect(result.includedInPlan).toBe(true);
  });

  it('rejects malformed backend responses instead of converting them into success', () => {
    expect(() => normalizeBackendDeliveryZoneCheck({ message: 'ok' })).toThrow('DELIVERY_ZONE_RESPONSE_INVALID');
  });
});
