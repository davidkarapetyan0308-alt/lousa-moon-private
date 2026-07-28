import { advanceSubscriptionSchedule, calculateSubscriptionSchedule } from '../apps/api/src/subscriptions/schedule';

describe('server subscription schedule', () => {
  test('calculates billing and preparation dates on the server', () => {
    const result = calculateSubscriptionSchedule({
      now: new Date('2026-07-22T18:00:00Z'),
      preferredDeliveryDate: '2026-08-05',
    });
    expect(result.nextDeliveryDate.toISOString().slice(0, 10)).toBe('2026-08-05');
    expect(result.nextPreparationDate.toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(result.nextBillingDate.toISOString().slice(0, 10)).toBe('2026-07-29');
    expect(result.calculationReason).toBe('validated_preferred_date');
  });

  test('rejects an unsafe client date and uses a bounded server default', () => {
    const result = calculateSubscriptionSchedule({
      now: new Date('2026-07-22T18:00:00Z'),
      preferredDeliveryDate: '2026-07-23',
      preferredWeekday: 2,
    });
    expect(result.nextDeliveryDate.toISOString().slice(0, 10)).toBe('2026-08-04');
    expect(result.calculationReason).toBe('server_default_window');
  });

  test('clamps month-end when advancing a skipped cycle', () => {
    const result = advanceSubscriptionSchedule(new Date('2026-01-31T00:00:00Z'), {
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(result.nextDeliveryDate.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  test('never accepts invalid date-only input as authoritative', () => {
    const result = calculateSubscriptionSchedule({
      now: new Date('2026-07-22T00:00:00Z'),
      preferredDeliveryDate: '2026-02-31',
    });
    expect(result.calculationReason).toBe('server_default_window');
    expect(result.nextDeliveryDate.toISOString().slice(0, 10)).toBe('2026-07-29');
  });
});
