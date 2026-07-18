import { CyclePrediction } from '../src/domain/models';
import { planBoxDelivery } from '../src/services/deliveryPlanning';

function prediction(patch: Partial<CyclePrediction> = {}): CyclePrediction {
  return {
    id: 'p', mostLikelyStart: '2026-07-20', earliestStart: '2026-07-18', latestStart: '2026-07-23',
    medianCycleLength: 28, weightedCycleLength: 28, averagePeriodLength: 5, variabilityDays: 2,
    completedCyclesCount: 6, confidence: 'high', reasons: [], lastConfirmedStart: '2026-06-22', dataQualityScore: 90,
    ...patch,
  };
}

const TODAY = new Date(2026, 6, 5, 12);

describe('delivery planning matrix', () => {
  test.each([
    [0, 1, 0], [1, 1, 1], [2, 1, 2], [3, 2, 2], [5, 3, 3],
  ])('plans with prep=%s delivery=%s buffer=%s', (preparationDays, deliveryDays, safetyBufferDays) => {
    const result = planBoxDelivery({ prediction: prediction(), today: TODAY, preparationDays, deliveryDays, safetyBufferDays });
    expect(['standard', 'urgent']).toContain(result.mode);
    expect(result.targetDate).toBeTruthy();
    expect(result.customizationDeadline).toBeTruthy();
  });

  test('unavailable zone requires manual selection', () => {
    const result = planBoxDelivery({ prediction: prediction(), today: TODAY, deliveryZoneAvailable: false });
    expect(result.mode).toBe('manual_selection');
    expect(result.warnings).toContain('choose_another_address_or_contact_support');
  });

  test.each(['low', 'medium'] as const)('adds warning for %s confidence', (confidence) => {
    const result = planBoxDelivery({ prediction: prediction({ confidence }), today: TODAY });
    expect((result.warnings || []).length).toBeGreaterThan(0);
  });

  test('warns when delivery slot is not confirmed', () => {
    const result = planBoxDelivery({ prediction: prediction(), today: TODAY });
    expect(result.warnings || []).toContain('delivery_slot_not_confirmed');
  });

  test('does not warn about slot when available', () => {
    const result = planBoxDelivery({ prediction: prediction(), today: TODAY, availableSlots: ['10:00–14:00'] });
    expect(result.warnings || []).not.toContain('delivery_slot_not_confirmed');
  });

  test.each([
    ['2026-07-06', 'next_cycle'],
    ['2026-07-08', 'urgent'],
    ['2026-07-12', 'standard'],
    ['2026-07-18', 'standard'],
  ] as const)('chooses mode for earliest start %s', (earliestStart, expected) => {
    const result = planBoxDelivery({ prediction: prediction({ earliestStart, mostLikelyStart: earliestStart }), today: TODAY });
    expect(result.mode).toBe(expected);
  });

  test('weekend target moves to prior business day', () => {
    const result = planBoxDelivery({ prediction: prediction({ earliestStart: '2026-07-13', mostLikelyStart: '2026-07-15' }), today: TODAY, safetyBufferDays: 1 });
    expect(result.targetDate).toBe('2026-07-10');
  });

  test('weekend movement can be disabled', () => {
    const result = planBoxDelivery({ prediction: prediction({ earliestStart: '2026-07-13', mostLikelyStart: '2026-07-15' }), today: TODAY, safetyBufferDays: 1, excludeWeekends: false });
    expect(result.targetDate).toBe('2026-07-12');
  });

  test.each([
    [null, 'insufficient_data'],
    [prediction({ earliestStart: null }), 'insufficient_data'],
    [prediction({ mostLikelyStart: null }), 'insufficient_data'],
    [prediction({ confidence: 'insufficient' }), 'insufficient_data'],
  ] as const)('handles unusable prediction %#', (value, mode) => {
    expect(planBoxDelivery({ prediction: value, today: TODAY }).mode).toBe(mode);
  });
});
