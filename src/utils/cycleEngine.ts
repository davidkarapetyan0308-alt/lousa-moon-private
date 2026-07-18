/** LOUSA MOON — local-first cycle prediction engine. */
import { CyclePrediction, PeriodRecord } from '../domain/models';
import { calculateCyclePrediction, createLegacyPeriodRecords, PredictionOptions } from '../services/cyclePrediction';
import { addLocalDays, differenceInLocalDays, fromLocalDateString, toLocalDateString } from './date';

export interface CycleDay {
  date: string;
  cycleDay: number;
  isPeriod: boolean;
  isConfirmedPeriod: boolean;
  isPredictedPeriod: boolean;
  flow: string | null;
  isOvulation: boolean;
  isFertile: boolean;
  isPMS: boolean;
  isPredicted: boolean;
}

export interface CycleData {
  startDate: string;
  cycleLength: number;
  periodLength: number;
  currentDay: number;
  phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
  phaseLabel: string;
  daysUntilPeriod: number;
  daysUntilOvulation: number;
  predictionConfidence: 'low' | 'medium' | 'high';
  confidence: CyclePrediction['confidence'];
  prediction: CyclePrediction;
  /** False when the last forecast window passed without a new confirmed start. */
  isCyclePositionKnown: boolean;
}

const clampCycle = (value: number) => Math.max(15, Math.min(90, Math.round(value || 28)));
const clampPeriod = (value: number) => Math.max(1, Math.min(14, Math.round(value || 5)));

export function estimateAverageCycle(history: string[], fallback = 28): number {
  const records = createLegacyPeriodRecords(history, undefined, 5);
  const prediction = calculateCyclePrediction(records, { fallbackCycleLength: fallback });
  return clampCycle(prediction.weightedCycleLength ?? prediction.medianCycleLength ?? fallback);
}

function phaseForDay(currentDay: number, cycleLength: number, periodLength: number) {
  const ovulationDay = Math.max(periodLength + 3, cycleLength - 14);
  if (currentDay <= periodLength) return { phase: 'menstrual' as const, phaseLabel: 'Menstrual Phase', ovulationDay };
  if (currentDay < ovulationDay - 1) return { phase: 'follicular' as const, phaseLabel: 'Follicular Phase', ovulationDay };
  if (currentDay <= ovulationDay + 1) return { phase: 'ovulation' as const, phaseLabel: 'Estimated Ovulation', ovulationDay };
  return { phase: 'luteal' as const, phaseLabel: 'Luteal Phase', ovulationDay };
}

export function getCycleData(
  lastPeriodStart: Date | null,
  avgCycleLength = 28,
  avgPeriodLength = 5,
  targetDate: Date = new Date(),
  historyCount = 0,
  periodRecords?: PeriodRecord[],
  predictionOptions: Pick<PredictionOptions, 'cycleContext' | 'factors'> = {}
): CycleData {
  const records = (periodRecords || []).filter((record) => record.confirmed && !record.deletedAt && !record.needsReview);
  if (!records.length) {
    const emptyPrediction = calculateCyclePrediction([], {
      fallbackCycleLength: avgCycleLength,
      fallbackPeriodLength: avgPeriodLength,
      today: targetDate,
      ...predictionOptions,
    });
    return {
      startDate: '',
      cycleLength: clampCycle(avgCycleLength),
      periodLength: clampPeriod(avgPeriodLength),
      currentDay: 0,
      phase: 'follicular',
      phaseLabel: 'Not configured',
      daysUntilPeriod: 0,
      daysUntilOvulation: 0,
      predictionConfidence: 'low',
      confidence: 'insufficient',
      prediction: emptyPrediction,
      isCyclePositionKnown: false,
    };
  }
  const prediction = calculateCyclePrediction(records, {
    fallbackCycleLength: avgCycleLength,
    fallbackPeriodLength: avgPeriodLength,
    today: targetDate,
    ...predictionOptions,
  });
  const latestStart = prediction.lastConfirmedStart || (lastPeriodStart ? toLocalDateString(lastPeriodStart) : null);
  if (!latestStart) {
    return {
      startDate: '',
      cycleLength: clampCycle(avgCycleLength),
      periodLength: clampPeriod(avgPeriodLength),
      currentDay: 0,
      phase: 'follicular',
      phaseLabel: 'Not configured',
      daysUntilPeriod: 0,
      daysUntilOvulation: 0,
      predictionConfidence: 'low',
      confidence: 'insufficient',
      prediction,
      isCyclePositionKnown: false,
    };
  }
  const cycleLength = clampCycle(prediction.weightedCycleLength ?? prediction.medianCycleLength ?? avgCycleLength);
  const periodLength = clampPeriod(prediction.averagePeriodLength ?? avgPeriodLength);
  const diffDays = differenceInLocalDays(targetDate, fromLocalDateString(latestStart));
  // Never wrap with modulo: doing so silently invents unrecorded cycle starts.
  // A long current cycle remains day 35/40/etc until the user confirms a new start.
  const currentDay = Math.max(0, diffDays + 1);
  const isCyclePositionKnown = currentDay > 0 && !prediction.expectedWindowPassed;
  const phaseState = isCyclePositionKnown
    ? phaseForDay(currentDay, cycleLength, periodLength)
    : { phase: 'follicular' as const, phaseLabel: 'Awaiting confirmation', ovulationDay: 0 };
  const daysUntilPeriod = isCyclePositionKnown && prediction.mostLikelyStart
    ? Math.max(0, differenceInLocalDays(fromLocalDateString(prediction.mostLikelyStart), targetDate))
    : 0;
  const daysUntilOvulation = isCyclePositionKnown
    ? Math.max(0, currentDay <= phaseState.ovulationDay ? phaseState.ovulationDay - currentDay : 0)
    : 0;

  return {
    startDate: latestStart,
    cycleLength,
    periodLength,
    currentDay,
    phase: phaseState.phase,
    phaseLabel: phaseState.phaseLabel,
    daysUntilPeriod,
    daysUntilOvulation,
    predictionConfidence: prediction.confidence === 'high' ? 'high' : prediction.confidence === 'medium' ? 'medium' : 'low',
    confidence: prediction.confidence,
    prediction: prediction.completedCyclesCount ? prediction : {
      ...prediction,
      completedCyclesCount: historyCount,
    },
    isCyclePositionKnown,
  };
}

function confirmedPeriodForDate(date: string, records: PeriodRecord[]): PeriodRecord | null {
  return records.find((record) => {
    if (!record.confirmed) return false;
    const start = fromLocalDateString(record.startDate);
    const end = fromLocalDateString(record.endDate || record.startDate);
    const value = fromLocalDateString(date);
    return value >= start && value <= end;
  }) || null;
}

export function getCalendarMonth(
  year: number,
  month: number,
  lastPeriodStart: Date | null,
  avgCycleLength = 28,
  avgPeriodLength = 5,
  periodRecords: PeriodRecord[] = [],
  predictionOptions: Pick<PredictionOptions, 'cycleContext' | 'factors'> = {}
): CycleDay[] {
  const records = periodRecords.filter((record) => record.confirmed && !record.deletedAt && !record.needsReview);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (!records.length) {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1, 12);
      return {
        date: toLocalDateString(date),
        cycleDay: 0,
        isPeriod: false,
        isConfirmedPeriod: false,
        isPredictedPeriod: false,
        flow: null,
        isOvulation: false,
        isFertile: false,
        isPMS: false,
        isPredicted: false,
      };
    });
  }
  const prediction = calculateCyclePrediction(records, { fallbackCycleLength: avgCycleLength, fallbackPeriodLength: avgPeriodLength, ...predictionOptions });
  const cycleLength = clampCycle(prediction.weightedCycleLength ?? prediction.medianCycleLength ?? avgCycleLength);
  const periodLength = clampPeriod(prediction.averagePeriodLength ?? avgPeriodLength);
  const latestStart = prediction.lastConfirmedStart || (lastPeriodStart ? toLocalDateString(lastPeriodStart) : null);
  const confirmedStarts = records.map((record) => record.startDate).sort();
  const today = new Date();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1, 12);
    const dateStr = toLocalDateString(date);
    const relevantStart = [...confirmedStarts].reverse().find((start) => start <= dateStr) || null;
    const cycleDay = relevantStart
      ? Math.max(1, differenceInLocalDays(date, fromLocalDateString(relevantStart)) + 1)
      : 0;
    const confirmedRecord = confirmedPeriodForDate(dateStr, records);
    const predictedStart = prediction.mostLikelyStart ? fromLocalDateString(prediction.mostLikelyStart) : null;
    const predictedEnd = predictedStart ? addLocalDays(predictedStart, Math.max(1, Math.min(8, periodLength)) - 1) : null;
    const predictedPeriod = !confirmedRecord && predictedStart && predictedEnd
      ? date >= predictedStart && date <= predictedEnd
      : false;
    const isOvulation = Boolean(prediction.estimatedOvulationDate && dateStr === prediction.estimatedOvulationDate);
    const isFertile = Boolean(
      prediction.estimatedFertileWindowStart
      && prediction.estimatedFertileWindowEnd
      && dateStr >= prediction.estimatedFertileWindowStart
      && dateStr <= prediction.estimatedFertileWindowEnd
    );
    const daysUntilPredictedPeriod = predictedStart
      ? differenceInLocalDays(predictedStart, date)
      : null;
    return {
      date: dateStr,
      cycleDay,
      isPeriod: Boolean(confirmedRecord) || predictedPeriod,
      isConfirmedPeriod: Boolean(confirmedRecord),
      isPredictedPeriod: predictedPeriod,
      flow: confirmedRecord?.flowByDay?.[dateStr] || null,
      isOvulation,
      isFertile,
      isPMS: daysUntilPredictedPeriod !== null && daysUntilPredictedPeriod >= 1 && daysUntilPredictedPeriod <= 7,
      isPredicted: predictedPeriod || isOvulation || isFertile,
    };
  });
}
