export const SUBSCRIPTION_SCHEDULE_VERSION = '2026-07-v1';

export type SubscriptionScheduleInput = {
  now?: Date;
  preferredDeliveryDate?: string | null;
  preferredWeekday?: number | null;
  minimumLeadDays?: number;
  preparationLeadDays?: number;
  billingLeadDays?: number;
};

export type SubscriptionSchedule = {
  nextBillingDate: Date;
  nextPreparationDate: Date;
  nextDeliveryDate: Date;
  scheduleVersion: string;
  calculationReason: 'validated_preferred_date' | 'server_default_window';
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(startOfUtcDay(value).getTime() + days * DAY_MS);
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return parsed;
}

function normalizeWeekday(value: number | null | undefined): number | null {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6 ? Number(value) : null;
}

function nextWeekdayOnOrAfter(value: Date, weekday: number): Date {
  const day = startOfUtcDay(value);
  const offset = (weekday - day.getUTCDay() + 7) % 7;
  return addUtcDays(day, offset);
}

/**
 * Produces the authoritative subscription dates on the server.
 * The client may express a preferred delivery day, but cannot directly set
 * billing or preparation dates. Preferred dates are accepted only inside a
 * bounded server-controlled window.
 */
export function calculateSubscriptionSchedule(input: SubscriptionScheduleInput = {}): SubscriptionSchedule {
  const today = startOfUtcDay(input.now ?? new Date());
  const minimumLeadDays = Math.max(4, Math.min(21, input.minimumLeadDays ?? 7));
  const preparationLeadDays = Math.max(2, Math.min(minimumLeadDays - 1, input.preparationLeadDays ?? 4));
  const billingLeadDays = Math.max(preparationLeadDays + 1, Math.min(21, input.billingLeadDays ?? 7));
  const earliest = addUtcDays(today, minimumLeadDays);
  const latestPreferred = addUtcDays(today, 60);
  const preferred = parseDateOnly(input.preferredDeliveryDate);

  let nextDeliveryDate: Date;
  let calculationReason: SubscriptionSchedule['calculationReason'];

  if (preferred && preferred >= earliest && preferred <= latestPreferred) {
    nextDeliveryDate = preferred;
    calculationReason = 'validated_preferred_date';
  } else {
    const preferredWeekday = normalizeWeekday(input.preferredWeekday);
    nextDeliveryDate = preferredWeekday === null ? earliest : nextWeekdayOnOrAfter(earliest, preferredWeekday);
    calculationReason = 'server_default_window';
  }

  const nextPreparationDate = addUtcDays(nextDeliveryDate, -preparationLeadDays);
  const nextBillingDate = addUtcDays(nextDeliveryDate, -billingLeadDays);

  if (nextBillingDate < today || nextPreparationDate < today || nextBillingDate >= nextPreparationDate || nextPreparationDate >= nextDeliveryDate) {
    throw new Error('SUBSCRIPTION_SCHEDULE_INVARIANT_FAILED');
  }

  return {
    nextBillingDate,
    nextPreparationDate,
    nextDeliveryDate,
    scheduleVersion: SUBSCRIPTION_SCHEDULE_VERSION,
    calculationReason,
  };
}

export function advanceSubscriptionSchedule(
  currentDeliveryDate: Date,
  input: Omit<SubscriptionScheduleInput, 'preferredDeliveryDate'> = {},
): SubscriptionSchedule {
  const current = startOfUtcDay(currentDeliveryDate);
  const targetMonth = current.getUTCMonth() + 1;
  const tentative = new Date(Date.UTC(current.getUTCFullYear(), targetMonth, 1));
  const lastDay = new Date(Date.UTC(tentative.getUTCFullYear(), tentative.getUTCMonth() + 1, 0)).getUTCDate();
  const clamped = new Date(Date.UTC(tentative.getUTCFullYear(), tentative.getUTCMonth(), Math.min(current.getUTCDate(), lastDay)));
  const preferredDate = clamped.toISOString().slice(0, 10);
  return calculateSubscriptionSchedule({ ...input, now: input.now ?? new Date(), preferredDeliveryDate: preferredDate, minimumLeadDays: 4 });
}
