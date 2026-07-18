import { CyclePrediction, PredictionEvaluation } from '../domain/models';
import { differenceInLocalDays, fromLocalDateString } from '../utils/date';

export function evaluatePrediction(
  prediction: CyclePrediction,
  actualStartDate: string,
  evaluatedAt = new Date().toISOString()
): PredictionEvaluation | null {
  if (!prediction.id || !prediction.mostLikelyStart || !prediction.earliestStart || !prediction.latestStart) return null;
  const absoluteErrorDays = Math.abs(
    differenceInLocalDays(
      fromLocalDateString(actualStartDate),
      fromLocalDateString(prediction.mostLikelyStart)
    )
  );
  return {
    id: `evaluation-${prediction.id}-${actualStartDate}`,
    predictionId: prediction.id,
    predictedMostLikelyDate: prediction.mostLikelyStart,
    predictedRangeStart: prediction.earliestStart,
    predictedRangeEnd: prediction.latestStart,
    actualStartDate,
    absoluteErrorDays,
    wasInsideRange: actualStartDate >= prediction.earliestStart && actualStartDate <= prediction.latestStart,
    confidenceAtPrediction: prediction.confidence,
    evaluatedAt,
  };
}

export interface PredictionAccuracySummary {
  total: number;
  averageAbsoluteErrorDays: number | null;
  insideRangeRate: number | null;
  recent: PredictionEvaluation[];
}

export function summarizePredictionAccuracy(evaluations: PredictionEvaluation[]): PredictionAccuracySummary {
  if (!evaluations.length) {
    return { total: 0, averageAbsoluteErrorDays: null, insideRangeRate: null, recent: [] };
  }
  const averageAbsoluteErrorDays = evaluations.reduce((sum, item) => sum + item.absoluteErrorDays, 0) / evaluations.length;
  const insideRangeRate = evaluations.filter((item) => item.wasInsideRange).length / evaluations.length;
  return {
    total: evaluations.length,
    averageAbsoluteErrorDays: Math.round(averageAbsoluteErrorDays * 10) / 10,
    insideRangeRate: Math.round(insideRangeRate * 1000) / 10,
    recent: [...evaluations].sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt)).slice(0, 10),
  };
}
