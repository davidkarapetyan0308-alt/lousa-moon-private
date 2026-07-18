import { CyclePrediction, DeliveryPlan } from '../domain/models';
import {
  addLocalDays,
  differenceInLocalDays,
  fromLocalDateString,
  toLocalDateString,
} from '../utils/date';

export interface DeliveryPlanningInput {
  prediction: CyclePrediction | null;
  preparationDays?: number;
  deliveryDays?: number;
  safetyBufferDays?: number;
  today?: Date;
  paused?: boolean;
  skipNext?: boolean;
  deliveryZoneAvailable?: boolean;
  availableSlots?: string[];
  excludeWeekends?: boolean;
}

function moveToPreviousBusinessDay(date: Date) {
  const result = new Date(date);
  while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() - 1);
  return result;
}

function strategyFromMode(mode: DeliveryPlan['mode']): NonNullable<DeliveryPlan['strategy']> {
  if (mode === 'standard') return 'normal';
  if (mode === 'urgent') return 'express';
  if (mode === 'next_cycle') return 'next_cycle';
  if (mode === 'manual_selection') return 'manual_selection';
  return 'insufficient_prediction';
}

export function planBoxDelivery(input: DeliveryPlanningInput): DeliveryPlan {
  const today = input.today ?? new Date();
  const preparationDays = Math.max(0, input.preparationDays ?? 2);
  const deliveryDays = Math.max(1, input.deliveryDays ?? 1);
  const safetyBufferDays = Math.max(0, input.safetyBufferDays ?? 2);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (input.deliveryZoneAvailable === false) {
    return {
      targetDate: null,
      recommendedDate: null,
      earliestDate: null,
      latestDate: null,
      rangeStart: null,
      rangeEnd: null,
      customizationDeadline: null,
      preparationDeadline: null,
      canArriveBeforePeriod: false,
      mode: 'manual_selection',
      strategy: 'manual_selection',
      reasons: ['delivery_zone_unavailable'],
      warnings: ['choose_another_address_or_contact_support'],
    };
  }

  if (input.paused || input.skipNext) {
    return {
      targetDate: null,
      recommendedDate: null,
      earliestDate: null,
      latestDate: null,
      rangeStart: null,
      rangeEnd: null,
      customizationDeadline: null,
      preparationDeadline: null,
      canArriveBeforePeriod: false,
      mode: 'next_cycle',
      strategy: 'next_cycle',
      reasons: [input.paused ? 'subscription_paused' : 'next_box_skipped'],
      warnings,
    };
  }

  const prediction = input.prediction;
  if (!prediction?.earliestStart || !prediction.mostLikelyStart || prediction.confidence === 'insufficient') {
    return {
      targetDate: null,
      recommendedDate: null,
      earliestDate: null,
      latestDate: null,
      rangeStart: null,
      rangeEnd: null,
      customizationDeadline: null,
      preparationDeadline: null,
      canArriveBeforePeriod: false,
      mode: 'insufficient_data',
      strategy: 'insufficient_prediction',
      reasons: ['insufficient_cycle_data'],
      warnings: ['manual_delivery_date_required'],
    };
  }

  const earliestPeriod = fromLocalDateString(prediction.earliestStart);
  let targetDate = addLocalDays(earliestPeriod, -safetyBufferDays);
  if (input.excludeWeekends !== false) targetDate = moveToPreviousBusinessDay(targetDate);

  let preparationDeadline = addLocalDays(targetDate, -(preparationDays + deliveryDays));
  let customizationDeadline = addLocalDays(preparationDeadline, -1);
  if (input.excludeWeekends !== false) {
    preparationDeadline = moveToPreviousBusinessDay(preparationDeadline);
    customizationDeadline = moveToPreviousBusinessDay(customizationDeadline);
  }

  const daysUntilTarget = differenceInLocalDays(targetDate, today);
  const daysUntilEarliestPeriod = differenceInLocalDays(earliestPeriod, today);
  const canArriveBeforePeriod = daysUntilEarliestPeriod > deliveryDays;

  let mode: DeliveryPlan['mode'] = 'standard';
  if (daysUntilTarget < preparationDays + deliveryDays) {
    mode = canArriveBeforePeriod ? 'urgent' : 'next_cycle';
    reasons.push(canArriveBeforePeriod ? 'standard_deadline_missed' : 'cannot_arrive_before_period');
  }
  if (prediction.confidence === 'low') {
    reasons.push('wide_prediction_window');
    warnings.push('delivery_date_based_on_low_confidence_prediction');
  }
  if (prediction.confidence === 'medium') warnings.push('delivery_date_may_shift_with_new_cycle_data');
  if (!input.availableSlots?.length) warnings.push('delivery_slot_not_confirmed');

  let actualTarget = targetDate;
  if (mode === 'urgent') {
    actualTarget = addLocalDays(today, Math.max(1, deliveryDays));
  } else if (mode === 'next_cycle') {
    const nextCycleLength = Math.max(21, Math.round(prediction.medianCycleLength ?? prediction.weightedCycleLength ?? 28));
    actualTarget = addLocalDays(prediction.mostLikelyStart, nextCycleLength - safetyBufferDays);
    if (input.excludeWeekends !== false) actualTarget = moveToPreviousBusinessDay(actualTarget);
    warnings.push('current_cycle_deadline_missed');
  }

  const earliestDate = addLocalDays(actualTarget, mode === 'standard' ? -1 : 0);
  const latestDate = addLocalDays(actualTarget, mode === 'standard' ? 1 : 2);

  return {
    targetDate: toLocalDateString(actualTarget),
    recommendedDate: toLocalDateString(actualTarget),
    earliestDate: toLocalDateString(earliestDate),
    latestDate: toLocalDateString(latestDate),
    rangeStart: toLocalDateString(earliestDate),
    rangeEnd: toLocalDateString(latestDate),
    customizationDeadline: toLocalDateString(mode === 'standard' ? customizationDeadline : today),
    preparationDeadline: toLocalDateString(mode === 'standard' ? preparationDeadline : today),
    canArriveBeforePeriod: mode !== 'next_cycle',
    mode,
    strategy: strategyFromMode(mode),
    reasons,
    warnings,
  };
}
