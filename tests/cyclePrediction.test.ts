import { calculateCyclePrediction } from '../src/services/cyclePrediction';
import { period, periodsFromIntervals } from './helpers';

const TODAY = new Date(2026, 6, 5, 12);

describe('calculateCyclePrediction', () => {
  test('reports insufficient confidence with one period', () => {
    const result = calculateCyclePrediction([period('2026-06-10')], { today: TODAY });
    expect(result.completedCyclesCount).toBe(0);
    expect(result.confidence).toBe('insufficient');
    expect(result.mostLikelyStart).toBeTruthy();
    expect(result.reasons).toContain('not_enough_cycles');
  });

  test('uses regular confirmed history and returns a narrow range', () => {
    const records = periodsFromIntervals('2025-12-18', [28, 28, 29, 28, 28, 29, 28]);
    const result = calculateCyclePrediction(records, { today: TODAY });
    expect(result.completedCyclesCount).toBe(7);
    expect(result.confidence).toBe('high');
    expect(result.medianCycleLength).toBeCloseTo(28, 0);
    expect(result.variabilityDays).toBeLessThanOrEqual(1);
    expect(result.earliestStart).toBeTruthy();
    expect(result.latestStart).toBeTruthy();
  });

  test('lowers confidence for irregular history', () => {
    const records = periodsFromIntervals('2025-11-01', [21, 42, 23, 40, 25, 39]);
    const result = calculateCyclePrediction(records, { today: TODAY });
    expect(result.confidence).not.toBe('high');
    expect(result.variabilityDays).toBeGreaterThan(7);
    expect(result.reasons).toContain('high_variability');
  });

  test('ignores future records', () => {
    const records = [...periodsFromIntervals('2026-01-01', [28, 28, 28]), period('2026-12-01')];
    const result = calculateCyclePrediction(records, { today: TODAY });
    expect(result.lastConfirmedStart).toBe('2026-03-26');
  });

  test('special cycle context prevents high confidence', () => {
    const records = periodsFromIntervals('2025-12-18', [28, 28, 28, 28, 28, 28, 28]);
    const result = calculateCyclePrediction(records, { today: TODAY, cycleContext: 'postpartum' });
    expect(result.confidence).not.toBe('high');
    expect(result.reasons).toContain('hormonal_or_special_context');
  });
});

test('returns medium confidence after three stable completed cycles', () => {
  const records = periodsFromIntervals('2026-03-01', [28, 29, 28]);
  const result = calculateCyclePrediction(records, { today: new Date(2026, 5, 15, 12) });
  expect(result.completedCyclesCount).toBe(3);
  expect(result.confidence).toBe('medium');
  expect(result.earliestStart).not.toBe(result.latestStart);
});

test('marks old history as stale instead of pretending high confidence', () => {
  const records = periodsFromIntervals('2024-01-01', [28, 28, 28, 28, 28, 28]);
  const result = calculateCyclePrediction(records, { today: TODAY });
  expect(result.confidence).toBe('insufficient');
  expect(result.reasons).toContain('stale_data');
});

test('does not show ovulation with only one completed interval', () => {
  const records = periodsFromIntervals('2026-05-01', [28]);
  const result = calculateCyclePrediction(records, { today: TODAY });
  expect(result.completedCyclesCount).toBe(1);
  expect(result.estimatedOvulationDate).toBeNull();
  expect(result.estimatedFertileWindowStart).toBeNull();
});

test('moves the forecast forward and lowers confidence after confirmed no bleeding', () => {
  const records = periodsFromIntervals('2026-02-01', [28, 28, 28, 28]);
  const baseline = calculateCyclePrediction(records, { today: new Date(2026, 5, 10, 12) });
  expect(baseline.mostLikelyStart).toBeTruthy();
  const negativeDate = baseline.mostLikelyStart as string;
  const result = calculateCyclePrediction(records, {
    today: new Date(`${negativeDate}T12:00:00`),
    negativeBleedingDates: [negativeDate],
  });
  expect(result.userReportedNoBleedingThrough).toBe(negativeDate);
  expect(result.reasons).toContain('user_reported_no_bleeding');
  expect(result.mostLikelyStart).not.toBe(negativeDate);
  expect(['insufficient', 'low', 'medium']).toContain(result.confidence);
  expect(result.estimatedOvulationDate).toBeNull();
  expect(result.estimatedFertileWindowStart).toBeNull();
  expect(result.estimatedFertileWindowEnd).toBeNull();
});

test('does not invent unrecorded cycles when the expected window has passed', () => {
  const records = periodsFromIntervals('2026-01-01', [28, 28, 28]);
  const result = calculateCyclePrediction(records, { today: new Date(2026, 6, 5, 12) });

  // Last confirmed start is 2026-03-26, so the next predicted start is 2026-04-23.
  // The engine must not silently jump to May/June/July as if missing cycles occurred.
  expect(result.mostLikelyStart).toBe('2026-04-23');
  expect(result.expectedWindowPassed).toBe(true);
  expect(result.reasons).toContain('expected_window_passed');
  expect(result.warnings).toContain('do_not_assume_unrecorded_cycle');
  expect(result.confidence).toBe('insufficient');
  expect(result.estimatedOvulationDate).toBeNull();
  expect(result.estimatedFertileWindowStart).toBeNull();
  expect(result.estimatedFertileWindowEnd).toBeNull();
});
