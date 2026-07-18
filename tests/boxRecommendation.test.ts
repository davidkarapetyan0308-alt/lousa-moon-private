import { recommendBox } from '../src/services/boxRecommendation';
import { basePreferences, period } from './helpers';

function menstrualQuantity(result: ReturnType<typeof recommendBox>) {
  return result.items.find((item) => item.id === 'menstrual-primary')?.quantity ?? 0;
}

describe('recommendBox', () => {
  test('heavy flow increases recommended quantity', () => {
    const light = recommendBox({ plan: 'essential', preferences: basePreferences, periods: [period('2026-06-01', null, { '2026-06-01': 'light', '2026-06-02': 'light' })], feedback: [] });
    const heavy = recommendBox({ plan: 'essential', preferences: basePreferences, periods: [period('2026-06-01', null, { '2026-06-01': 'heavy', '2026-06-02': 'very_heavy' })], feedback: [] });
    expect(menstrualQuantity(heavy)).toBeGreaterThan(menstrualQuantity(light));
  });

  test('adds night protection when requested', () => {
    const result = recommendBox({ plan: 'comfort', preferences: { ...basePreferences, nightProtection: true }, periods: [], feedback: [] });
    expect(result.items.some((item) => item.id === 'night-protection')).toBe(true);
  });

  test('uses previous shortage feedback to increase quantity', () => {
    const base = recommendBox({ plan: 'comfort', preferences: basePreferences, periods: [], feedback: [] });
    const adjusted = recommendBox({
      plan: 'comfort',
      preferences: basePreferences,
      periods: [],
      feedback: [{
        orderId: '1', enoughItems: false, tooFewCategories: ['menstrual'], tooManyCategories: [], likedItems: [], removeItems: [], allergyReaction: false,
        packagingRating: 4, deliveryRating: 4, note: '', createdAt: new Date().toISOString(),
      }],
    });
    expect(menstrualQuantity(adjusted)).toBeGreaterThan(menstrualQuantity(base));
  });

  test('removes disliked products and emits allergy warning', () => {
    const result = recommendBox({
      plan: 'ritual',
      preferences: { ...basePreferences, dislikedItems: ['свеча'], foodAllergies: ['орехи'] },
      periods: [],
      feedback: [],
    });
    expect(result.items.some((item) => item.name.toLowerCase().includes('свеча'))).toBe(false);
    expect(result.warnings).toContain('allergy_review_required');
  });
});

test('respects explicit food exclusions', () => {
  const result = recommendBox({
    plan: 'ritual',
    preferences: { ...basePreferences, teaPreference: 'none', chocolatePreference: 'none' },
    periods: [],
    feedback: [],
  });
  expect(result.items.some((item) => item.id === 'tea')).toBe(false);
  expect(result.items.some((item) => item.id === 'chocolate')).toBe(false);
});
