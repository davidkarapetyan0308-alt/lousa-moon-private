import { calculateCyclePrediction } from '../src/services/cyclePrediction';
import { period, periodsFromIntervals } from './helpers';

const TODAY = new Date(2026, 6, 5, 12);

describe('cycle prediction edge cases', () => {
  test.each([21, 24, 28, 32, 35, 40, 45])('supports stable %s-day cycles', (length) => {
    const result = calculateCyclePrediction(periodsFromIntervals('2025-10-01', [length, length, length, length, length, length]), { today: TODAY });
    expect(result.medianCycleLength).toBe(length);
    expect(result.mostLikelyStart).toBeTruthy();
  });

  test.each([
    ['postpartum'],
    ['breastfeeding'],
    ['pregnant'],
    ['perimenopause'],
    ['pill'],
    ['hormonal_iud'],
  ] as const)('does not give high confidence in %s context', (cycleContext) => {
    const result = calculateCyclePrediction(periodsFromIntervals('2025-10-01', [28, 28, 28, 28, 28, 28]), { today: TODAY, cycleContext });
    expect(result.confidence).not.toBe('high');
  });

  test('ignores unconfirmed records', () => {
    const records = periodsFromIntervals('2026-01-01', [28, 28, 28]);
    records.push(period('2026-04-20', null, {}));
    records[records.length - 1].confirmed = false;
    const result = calculateCyclePrediction(records, { today: TODAY });
    expect(result.lastConfirmedStart).toBe('2026-03-26');
  });

  test('ignores records needing migration review', () => {
    const records = periodsFromIntervals('2026-01-01', [28, 28, 28]);
    records.push({ ...period('2026-04-20'), source: 'legacy', confirmed: true, needsReview: true });
    const result = calculateCyclePrediction(records, { today: TODAY });
    expect(result.lastConfirmedStart).toBe('2026-03-26');
  });

  test('ignores deleted records', () => {
    const records = periodsFromIntervals('2026-01-01', [28, 28, 28]);
    records.push({ ...period('2026-04-20'), deletedAt: '2026-04-21T00:00:00.000Z' });
    const result = calculateCyclePrediction(records, { today: TODAY });
    expect(result.lastConfirmedStart).toBe('2026-03-26');
  });

  test.each([1, 5, 10, 15, 60, 100])('filters implausible interval %s', (interval) => {
    const records = periodsFromIntervals('2026-01-01', [28, interval, 28, 28]);
    const result = calculateCyclePrediction(records, { today: TODAY });
    expect(result.medianCycleLength == null || (result.medianCycleLength >= 15 && result.medianCycleLength <= 60)).toBe(true);
  });

  test('reports calendar-only fertility estimate', () => {
    const result = calculateCyclePrediction(periodsFromIntervals('2026-01-01', [28, 28, 28, 28, 28, 28]), { today: TODAY });
    expect(result.isCalendarEstimateOnly).toBe(true);
    expect(result.estimatedOvulationDate).toBeTruthy();
    expect(result.estimatedFertileWindowStart).toBeTruthy();
    expect(result.estimatedFertileWindowEnd).toBeTruthy();
  });

  test('uses recorded end dates for average duration', () => {
    const records = periodsFromIntervals('2026-01-01', [28, 28, 28]);
    records[0].endDate = '2026-01-03';
    records[1].endDate = '2026-02-01';
    records[2].endDate = '2026-03-02';
    records[3].endDate = '2026-03-29';
    const result = calculateCyclePrediction(records, { today: TODAY });
    expect(result.averagePeriodLength).toBeGreaterThanOrEqual(3);
    expect(result.averagePeriodLength).toBeLessThanOrEqual(5);
  });

  test('wide variability produces a wider range', () => {
    const stable = calculateCyclePrediction(periodsFromIntervals('2025-10-01', [28, 28, 28, 28, 28]), { today: TODAY });
    const variable = calculateCyclePrediction(periodsFromIntervals('2025-10-01', [22, 36, 24, 39, 27]), { today: TODAY });
    const stableWidth = new Date(stable.latestStart!).getTime() - new Date(stable.earliestStart!).getTime();
    const variableWidth = new Date(variable.latestStart!).getTime() - new Date(variable.earliestStart!).getTime();
    expect(variableWidth).toBeGreaterThanOrEqual(stableWidth);
  });
});

test('calendar predicted bleeding never spans the whole uncertainty window', () => {
  const { getCalendarMonth } = require('../src/utils/cycleEngine');
  const records = periodsFromIntervals('2026-01-01', [28, 36, 24, 39, 27]);
  const days = getCalendarMonth(2026, 6, new Date(2026, 0, 1, 12), 28, 5, records);
  const predicted = days.filter((day: { isPredictedPeriod: boolean }) => day.isPredictedPeriod);
  expect(predicted.length).toBeLessThanOrEqual(8);
});
