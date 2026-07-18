import { evaluatePrediction, summarizePredictionAccuracy } from '../src/services/predictionAccuracy';
import { CyclePrediction, PredictionEvaluation } from '../src/domain/models';

function prediction(patch: Partial<CyclePrediction> = {}): CyclePrediction {
  return {
    id: 'pred-1',
    mostLikelyStart: '2026-07-14',
    earliestStart: '2026-07-12',
    latestStart: '2026-07-17',
    medianCycleLength: 28,
    weightedCycleLength: 28,
    averagePeriodLength: 5,
    variabilityDays: 2,
    completedCyclesCount: 6,
    confidence: 'high',
    reasons: [],
    lastConfirmedStart: '2026-06-16',
    dataQualityScore: 90,
    ...patch,
  };
}

describe('prediction accuracy', () => {
  test.each([
    ['2026-07-14', 0, true],
    ['2026-07-12', 2, true],
    ['2026-07-17', 3, true],
    ['2026-07-11', 3, false],
    ['2026-07-20', 6, false],
  ])('evaluates actual date %s', (actual, error, inside) => {
    const result = evaluatePrediction(prediction(), actual)!;
    expect(result.absoluteErrorDays).toBe(error);
    expect(result.wasInsideRange).toBe(inside);
  });

  test.each([
    { id: undefined },
    { mostLikelyStart: null },
    { earliestStart: null },
    { latestStart: null },
  ])('returns null for incomplete prediction %#', (patch) => {
    expect(evaluatePrediction(prediction(patch), '2026-07-14')).toBeNull();
  });

  test('empty summary has null rates', () => {
    expect(summarizePredictionAccuracy([])).toEqual({ total: 0, averageAbsoluteErrorDays: null, insideRangeRate: null, recent: [] });
  });

  test('summary computes average error and inside rate', () => {
    const items = [
      evaluatePrediction(prediction({ id: '1' }), '2026-07-14')!,
      evaluatePrediction(prediction({ id: '2' }), '2026-07-16')!,
      evaluatePrediction(prediction({ id: '3' }), '2026-07-20')!,
    ];
    const summary = summarizePredictionAccuracy(items);
    expect(summary.total).toBe(3);
    expect(summary.averageAbsoluteErrorDays).toBe(2.7);
    expect(summary.insideRangeRate).toBe(66.7);
  });

  test('summary returns ten most recent evaluations', () => {
    const items: PredictionEvaluation[] = Array.from({ length: 15 }, (_, index) => ({
      id: `e-${index}`,
      predictionId: `p-${index}`,
      predictedMostLikelyDate: '2026-07-14',
      predictedRangeStart: '2026-07-12',
      predictedRangeEnd: '2026-07-17',
      actualStartDate: '2026-07-14',
      absoluteErrorDays: index,
      wasInsideRange: true,
      confidenceAtPrediction: 'medium',
      evaluatedAt: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));
    const summary = summarizePredictionAccuracy(items);
    expect(summary.recent).toHaveLength(10);
    expect(summary.recent[0].id).toBe('e-14');
  });
});
