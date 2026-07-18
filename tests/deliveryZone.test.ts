import {
  GYUMRI_DELIVERY_CENTER,
  checkGyumriDeliveryZone,
  distanceKmBetween,
} from '../src/services/deliveryZone';

describe('real delivery zone checks', () => {
  it('accepts a point in central Gyumri', () => {
    const result = checkGyumriDeliveryZone(GYUMRI_DELIVERY_CENTER);
    expect(result.isAvailable).toBe(true);
    expect(result.deliveryZoneId).toBe('gyumri-main');
    expect(result.deliveryFeeMinor).toBe(0);
    expect(result.estimatedMinutes).toBeGreaterThanOrEqual(20);
  });

  it('rejects coordinates outside the configured radius', () => {
    const result = checkGyumriDeliveryZone({ latitude: 40.18, longitude: 44.51 });
    expect(result.isAvailable).toBe(false);
    expect(result.deliveryZoneId).toBeNull();
    expect(result.reason).toBe('OUTSIDE_GYUMRI_DELIVERY_ZONE');
  });

  it('calculates a stable haversine distance', () => {
    expect(distanceKmBetween(GYUMRI_DELIVERY_CENTER, GYUMRI_DELIVERY_CENTER)).toBeCloseTo(0, 6);
  });
});
