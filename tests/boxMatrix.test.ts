import { recommendBox } from '../src/services/boxRecommendation';
import { basePreferences, period } from './helpers';

function quantity(result: ReturnType<typeof recommendBox>, id = 'menstrual-primary') {
  return result.items.find((item) => item.id === id)?.quantity ?? 0;
}

describe('box recommendation matrix', () => {
  test.each([
    ['pads'], ['tampons'], ['mixed'], ['cup'], ['disc'],
  ] as const)('uses primary product %s', (primaryProduct) => {
    const result = recommendBox({ plan: 'comfort', preferences: { ...basePreferences, primaryProduct, menstrualProducts: [primaryProduct] }, periods: [], feedback: [] });
    expect(result.items[0].sku).toBe(`menstrual-${primaryProduct}`);
  });

  test.each([
    ['essential', 6], ['comfort', 9], ['ritual', 12],
  ] as const)('%s respects category limit', (plan, limit) => {
    const result = recommendBox({ plan, preferences: basePreferences, periods: [], feedback: [] });
    expect(result.items.length).toBeLessThanOrEqual(limit);
  });

  test.each([2, 3, 5, 7, 10])('coverage follows period length %s', (periodLengthEstimate) => {
    const result = recommendBox({ plan: 'essential', preferences: { ...basePreferences, periodLengthEstimate }, periods: [], feedback: [] });
    expect(result.estimatedCoverageDays).toBe(periodLengthEstimate);
  });

  test('minimum quantity is respected', () => {
    const result = recommendBox({ plan: 'essential', preferences: { ...basePreferences, minimumMenstrualItems: 40 }, periods: [], feedback: [] });
    expect(quantity(result)).toBeGreaterThanOrEqual(40);
  });

  test('maximum quantity is respected', () => {
    const result = recommendBox({ plan: 'essential', preferences: { ...basePreferences, dailyQuantityEstimate: 12, periodLengthEstimate: 10, maximumMenstrualItems: 20 }, periods: [], feedback: [] });
    expect(quantity(result)).toBeLessThanOrEqual(20);
  });

  test.each([
    ['milk', 'chocolate'],
    ['herbs', 'tea'],
    ['fragrance', 'candle'],
  ])('excludes allergen %s from item %s', (allergen, itemId) => {
    const result = recommendBox({
      plan: 'ritual',
      preferences: { ...basePreferences, chocolatePreference: 'milk', fragranceFree: false, foodAllergies: [allergen], cosmeticAllergies: [] },
      periods: [], feedback: [],
    });
    expect(result.items.some((item) => item.id === itemId)).toBe(false);
  });

  test('fragrance-free excludes candle', () => {
    const result = recommendBox({ plan: 'ritual', preferences: { ...basePreferences, fragranceFree: true }, periods: [], feedback: [] });
    expect(result.items.some((item) => item.id === 'candle')).toBe(false);
  });

  test('actual product usage raises recommendation', () => {
    const low = recommendBox({ plan: 'essential', preferences: basePreferences, periods: [], feedback: [] });
    const used = period('2026-06-01');
    used.productsUsedByDay = { '2026-06-01': 10, '2026-06-02': 10, '2026-06-03': 8 };
    const high = recommendBox({ plan: 'essential', preferences: basePreferences, periods: [used, { ...used, id: 'p2', startDate: '2026-05-01' }], feedback: [] });
    expect(quantity(high)).toBeGreaterThan(quantity(low));
  });

  test('night leakage history adds night protection', () => {
    const one = period('2026-06-01');
    one.nightLeakageByDay = { '2026-06-01': true, '2026-06-02': true };
    const two = { ...period('2026-05-01'), id: 'two', nightLeakageByDay: { '2026-05-01': false } };
    const result = recommendBox({ plan: 'essential', preferences: { ...basePreferences, nightProtection: false }, periods: [one, two], feedback: [] });
    expect(result.items.some((item) => item.id === 'night-protection')).toBe(true);
  });

  test.each([0, 1, 2, 4])('confidence reflects history count %s', (count) => {
    const periods = Array.from({ length: count }, (_, i) => period(`2026-0${i + 1}-01`));
    const result = recommendBox({ plan: 'comfort', preferences: basePreferences, periods, feedback: [] });
    if (count < 2) expect(result.confidence).toBe('low');
    else expect(['medium', 'high']).toContain(result.confidence);
  });

  test('never includes medicines', () => {
    const result = recommendBox({ plan: 'ritual', preferences: basePreferences, periods: [], feedback: [] });
    expect(result.items.some((item) => /medicine|drug|таблет|лекар/i.test(item.name))).toBe(false);
  });
});
