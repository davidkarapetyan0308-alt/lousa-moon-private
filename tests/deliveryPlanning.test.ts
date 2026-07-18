import { planBoxDelivery } from '../src/services/deliveryPlanning';
import { CyclePrediction } from '../src/domain/models';

const prediction: CyclePrediction = {
  mostLikelyStart: '2026-07-20',
  earliestStart: '2026-07-18',
  latestStart: '2026-07-23',
  medianCycleLength: 28,
  weightedCycleLength: 28,
  averagePeriodLength: 5,
  variabilityDays: 2,
  completedCyclesCount: 6,
  confidence: 'high',
  reasons: [],
  lastConfirmedStart: '2026-06-22',
  dataQualityScore: 90,
};

describe('planBoxDelivery', () => {
  test('plans a standard delivery before earliest period date', () => {
    const result = planBoxDelivery({ prediction, today: new Date(2026, 6, 5, 12) });
    expect(result.mode).toBe('standard');
    expect(result.targetDate).toBe('2026-07-16');
    expect(result.canArriveBeforePeriod).toBe(true);
  });

  test('moves to next cycle when delivery cannot arrive before tomorrow period', () => {
    const urgentPrediction = { ...prediction, mostLikelyStart: '2026-07-06', earliestStart: '2026-07-06', latestStart: '2026-07-08' };
    const result = planBoxDelivery({ prediction: urgentPrediction, today: new Date(2026, 6, 5, 12) });
    expect(result.mode).toBe('next_cycle');
    expect(result.reasons).toContain('cannot_arrive_before_period');
  });

  test('returns insufficient data without a usable forecast', () => {
    const result = planBoxDelivery({ prediction: { ...prediction, confidence: 'insufficient', earliestStart: null }, today: new Date(2026, 6, 5, 12) });
    expect(result.mode).toBe('insufficient_data');
    expect(result.targetDate).toBeNull();
  });

  test('respects subscription pause', () => {
    const result = planBoxDelivery({ prediction, paused: true, today: new Date(2026, 6, 5, 12) });
    expect(result.mode).toBe('next_cycle');
    expect(result.reasons).toContain('subscription_paused');
  });
});

test('does not schedule the skipped next box', () => {
  const result = planBoxDelivery({ prediction, skipNext: true, today: new Date(2026, 6, 5, 12) });
  expect(result.mode).toBe('next_cycle');
  expect(result.targetDate).toBeNull();
  expect(result.reasons).toContain('next_box_skipped');
});
