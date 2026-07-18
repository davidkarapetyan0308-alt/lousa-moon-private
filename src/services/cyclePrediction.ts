import {
  CyclePrediction,
  PeriodRecord,
  CycleContext,
  CycleFactor,
} from '../domain/models';
import {
  addLocalDays,
  differenceInLocalDays,
  fromLocalDateString,
  toLocalDateString,
} from '../utils/date';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function weightedAverage(values: number[]): number | null {
  if (!values.length) return null;
  const weights = values.map((_, index) => Math.pow(index + 1, 1.25));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
}

function medianAbsoluteDeviation(values: number[]): number | null {
  const med = median(values);
  if (med == null || values.length < 2) return null;
  return median(values.map((value) => Math.abs(value - med)));
}

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function periodLength(record: PeriodRecord): number | null {
  if (record.endDate) {
    const diff = differenceInLocalDays(fromLocalDateString(record.endDate), fromLocalDateString(record.startDate)) + 1;
    if (diff >= 1 && diff <= 14) return diff;
  }
  const flowDates = Object.keys(record.flowByDay || {}).sort();
  if (flowDates.length) {
    const first = flowDates[0];
    const last = flowDates[flowDates.length - 1];
    const diff = differenceInLocalDays(fromLocalDateString(last), fromLocalDateString(first)) + 1;
    if (diff >= 1 && diff <= 14) return diff;
  }
  return null;
}

function predictionId(generatedAt: string, lastStart: string | null) {
  return `prediction-${lastStart || 'none'}-${generatedAt}`;
}

export interface PredictionOptions {
  fallbackCycleLength?: number;
  fallbackPeriodLength?: number;
  cycleContext?: CycleContext;
  factors?: CycleFactor[];
  today?: Date;
  negativeBleedingDates?: string[];
}

export function calculateCyclePrediction(
  records: PeriodRecord[],
  options: PredictionOptions = {}
): CyclePrediction {
  const today = options.today ?? new Date();
  const generatedAt = today.toISOString();
  const warnings: string[] = [];
  const todayString = toLocalDateString(today);
  const negativeBleedingDates = Array.from(new Set(options.negativeBleedingDates || []))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayString)
    .sort();

  const confirmed = records
    .filter((record) =>
      record.confirmed &&
      !record.deletedAt &&
      !record.needsReview &&
      record.startDate &&
      fromLocalDateString(record.startDate) <= today
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const starts = Array.from(new Set(confirmed.map((record) => record.startDate))).sort();
  const rawIntervals = starts
    .slice(1)
    .map((date, index) => differenceInLocalDays(fromLocalDateString(date), fromLocalDateString(starts[index])));

  const plausibleIntervals = rawIntervals.filter((days) => days >= 15 && days <= 90);
  const clinicallyPlausible = plausibleIntervals.filter((days) => days >= 21 && days <= 45);
  const workingIntervals = clinicallyPlausible.length ? clinicallyPlausible : plausibleIntervals;
  const med = median(workingIntervals);
  const weighted = weightedAverage(workingIntervals);
  const robustCycleLength = med != null && weighted != null
    ? med * 0.65 + weighted * 0.35
    : med ?? weighted ?? options.fallbackCycleLength ?? 28;
  const cycleLength = Math.round(clamp(robustCycleLength, 15, 90));

  const periodLengths = confirmed.map(periodLength).filter((value): value is number => value != null);
  const averagePeriodLength = periodLengths.length
    ? Math.round(periodLengths.reduce((sum, value) => sum + value, 0) / periodLengths.length)
    : options.fallbackPeriodLength ?? 5;

  const std = standardDeviation(workingIntervals);
  const mad = medianAbsoluteDeviation(workingIntervals);
  const variabilityDays = std == null ? null : Math.round(std * 10) / 10;
  const robustVariability = mad == null ? variabilityDays : Math.max(mad * 1.4826, variabilityDays ?? 0);
  const completedCyclesCount = workingIntervals.length;
  const lastConfirmedStart = starts.length ? starts[starts.length - 1] : null;
  const reasons: string[] = [];

  const specialContexts: CycleContext[] = [
    'pill',
    'hormonal_iud',
    'implant',
    'injection',
    'pregnant',
    'postpartum',
    'breastfeeding',
    'perimenopause',
    'amenorrhea',
  ];
  const contextPenalty = Boolean(options.cycleContext && specialContexts.includes(options.cycleContext));
  const factorPenalty = (options.factors || []).some((factor) => !['none', 'prefer_not_to_say'].includes(factor));
  const lastAge = lastConfirmedStart
    ? differenceInLocalDays(today, fromLocalDateString(lastConfirmedStart))
    : Number.POSITIVE_INFINITY;
  const staleData = lastAge > Math.max(120, cycleLength * 4);
  const suspiciousIntervals = rawIntervals.filter((days) => days < 15 || days > 90).length;
  const possibleMissingRecords = rawIntervals.filter((days) => days > Math.max(50, cycleLength * 1.7)).length;
  const unreviewedLegacy = records.filter((record) => record.source === 'legacy' && (record.needsReview || !record.confirmed)).length;

  let confidence: CyclePrediction['confidence'] = 'insufficient';
  const variability = robustVariability ?? 99;
  if (completedCyclesCount >= 6 && variability <= 3 && !contextPenalty && !factorPenalty && !staleData && suspiciousIntervals === 0) {
    confidence = 'high';
  } else if (completedCyclesCount >= 3 && variability <= 7 && !contextPenalty && !staleData) {
    confidence = 'medium';
  } else if (completedCyclesCount >= 1 && !staleData) {
    confidence = 'low';
  }

  if (completedCyclesCount < 3) reasons.push('not_enough_cycles');
  if (variability > 7) reasons.push('high_variability');
  if (contextPenalty) reasons.push('hormonal_or_special_context');
  if (factorPenalty) reasons.push('cycle_affecting_factors');
  if (staleData) reasons.push('stale_data');
  if (suspiciousIntervals > 0) reasons.push('invalid_intervals_ignored');
  if (possibleMissingRecords > 0) reasons.push('possible_missing_records');
  if (unreviewedLegacy > 0) reasons.push('legacy_records_need_review');
  if (!lastConfirmedStart) reasons.push('no_confirmed_period');

  if (contextPenalty) warnings.push('standard_calendar_model_may_not_apply');
  if (confidence === 'insufficient') warnings.push('do_not_rely_on_exact_date');
  warnings.push('calendar_estimate_not_contraception');

  let mostLikelyStart: string | null = null;
  let earliestStart: string | null = null;
  let latestStart: string | null = null;
  let estimatedOvulationDate: string | null = null;
  let estimatedFertileWindowStart: string | null = null;
  let estimatedFertileWindowEnd: string | null = null;

  if (lastConfirmedStart) {
    // Predict only the next cycle after the last confirmed start. Never jump the
    // date forward by silently assuming that unrecorded periods happened. If the
    // window passes, the UI must ask the user what happened and lower confidence.
    const predicted = addLocalDays(lastConfirmedStart, cycleLength);
    mostLikelyStart = toLocalDateString(predicted);

    const baseWindow = confidence === 'high' ? 2 : confidence === 'medium' ? 4 : confidence === 'low' ? 7 : 10;
    const variabilityWindow = Math.ceil(robustVariability ?? baseWindow);
    const contextWindow = contextPenalty || factorPenalty ? 3 : 0;
    const missingDataWindow = possibleMissingRecords || unreviewedLegacy ? 2 : 0;
    const window = clamp(Math.max(baseWindow, variabilityWindow) + contextWindow + missingDataWindow, 2, 16);
    earliestStart = toLocalDateString(addLocalDays(predicted, -window));
    latestStart = toLocalDateString(addLocalDays(predicted, window));

    // Calendar estimate only. Do not show an ovulation estimate until there are
    // at least two completed intervals (three confirmed starts). With less data the
    // date looks precise while being based almost entirely on the fallback length.
    if (completedCyclesCount >= 2) {
      const ovulation = addLocalDays(predicted, -14);
      estimatedOvulationDate = toLocalDateString(ovulation);
      estimatedFertileWindowStart = toLocalDateString(addLocalDays(ovulation, -5));
      estimatedFertileWindowEnd = toLocalDateString(addLocalDays(ovulation, 1));
    }

    const relevantNegativeDates = negativeBleedingDates
      .filter((date) => !earliestStart || date >= earliestStart);
    const latestNegative = relevantNegativeDates.length
      ? relevantNegativeDates[relevantNegativeDates.length - 1]
      : null;
    if (latestNegative && mostLikelyStart && latestNegative >= mostLikelyStart) {
      const nextPossible = toLocalDateString(addLocalDays(latestNegative, 1));
      const originalLatest = latestStart;
      const shift = Math.max(1, differenceInLocalDays(fromLocalDateString(nextPossible), fromLocalDateString(mostLikelyStart)));
      mostLikelyStart = nextPossible;
      earliestStart = nextPossible;
      latestStart = originalLatest
        ? toLocalDateString(addLocalDays(originalLatest, Math.min(10, shift + 2)))
        : toLocalDateString(addLocalDays(nextPossible, 10));
      reasons.push('user_reported_no_bleeding');
      warnings.push('forecast_shifted_after_no_bleeding');
      confidence = confidence === 'high' ? 'medium' : confidence === 'medium' ? 'low' : 'insufficient';
      // Once the expected start was explicitly not observed, an ovulation date
      // derived from that same expected cycle is no longer trustworthy.
      estimatedOvulationDate = null;
      estimatedFertileWindowStart = null;
      estimatedFertileWindowEnd = null;
    }
  }

  let dataQualityScore = 0;
  dataQualityScore += clamp(completedCyclesCount / 6, 0, 1) * 42;
  dataQualityScore += clamp(1 - variability / 12, 0, 1) * 30;
  dataQualityScore += staleData ? 0 : 10;
  dataQualityScore += suspiciousIntervals ? 0 : 8;
  dataQualityScore += unreviewedLegacy ? 0 : 10;
  if (contextPenalty) dataQualityScore -= 15;
  if (factorPenalty) dataQualityScore -= 10;
  if (possibleMissingRecords) dataQualityScore -= 8;

  let score = Math.round(clamp(dataQualityScore, 0, 100));
  const latestNegative = negativeBleedingDates.length
    ? negativeBleedingDates[negativeBleedingDates.length - 1]
    : null;
  const expectedWindowPassed = Boolean(latestStart && latestStart < todayString);
  if (expectedWindowPassed) {
    reasons.push('expected_window_passed');
    warnings.push('do_not_assume_unrecorded_cycle');
    confidence = 'insufficient';
    score = Math.min(score, 35);
    // Fertile/ovulation markers belong to the unconfirmed expected cycle and
    // must disappear once that window passed without a new confirmed start.
    estimatedOvulationDate = null;
    estimatedFertileWindowStart = null;
    estimatedFertileWindowEnd = null;
  }
  const confidenceExplanation = [
    confirmed.length <= 1 ? 'only_one_confirmed_start' : null,
    completedCyclesCount < 3 ? 'limited_cycle_history' : null,
    robustVariability != null && robustVariability > 7 ? 'cycle_length_varies' : null,
    contextPenalty ? 'special_cycle_context' : null,
    factorPenalty ? 'cycle_affecting_factors' : null,
    latestNegative ? 'no_bleeding_observation_recorded' : null,
    expectedWindowPassed ? 'expected_window_passed_without_confirmation' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    id: predictionId(generatedAt, lastConfirmedStart),
    generatedAt,
    mostLikelyStart,
    earliestStart,
    latestStart,
    medianCycleLength: med == null ? null : Math.round(med * 10) / 10,
    weightedCycleLength: weighted == null ? null : Math.round(weighted * 10) / 10,
    weightedAverageCycleLength: weighted == null ? null : Math.round(weighted * 10) / 10,
    averagePeriodLength: Math.round(averagePeriodLength),
    variabilityDays: robustVariability == null ? null : Math.round(robustVariability * 10) / 10,
    completedCyclesCount,
    confirmedPeriodsCount: confirmed.length,
    confidence,
    confidenceScore: score,
    reasons,
    warnings,
    lastConfirmedStart,
    dataQualityScore: score,
    estimatedOvulationDate,
    estimatedFertileWindowStart,
    estimatedFertileWindowEnd,
    isCalendarEstimateOnly: true,
    expectedWindowPassed,
    userReportedNoBleedingThrough: latestNegative,
    confidenceExplanation,
  };
}

export function createLegacyPeriodRecords(history: string[], fallbackLastStart?: string, periodLength = 5): PeriodRecord[] {
  const dates = Array.from(new Set([...(history || []), ...(fallbackLastStart ? [fallbackLastStart] : [])]))
    .filter(Boolean)
    .sort();
  return dates.map((startDate, index) => {
    const now = new Date().toISOString();
    const endDate = toLocalDateString(addLocalDays(startDate, Math.max(1, periodLength) - 1));
    return {
      id: `legacy-${startDate}-${index}`,
      startDate,
      endDate,
      confirmed: false,
      source: 'legacy',
      needsReview: true,
      migrationNote: 'Imported from an older LOUSA version. Confirm before using it for predictions.',
      flowByDay: {},
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function confidenceTranslationKey(confidence: CyclePrediction['confidence']) {
  if (confidence === 'high') return 'prediction_confidence_high';
  if (confidence === 'medium') return 'prediction_confidence_medium';
  if (confidence === 'low') return 'prediction_confidence_low';
  return 'prediction_confidence_insufficient';
}
