import type { FlowLevel, PeriodRecord } from './models';
import { differenceInLocalDays, fromLocalDateString, toLocalDateString } from '../utils/date';

export type CycleValidationCode =
  | 'INVALID_DATE'
  | 'FUTURE_DATE'
  | 'DATE_TOO_OLD'
  | 'END_BEFORE_START'
  | 'PERIOD_TOO_LONG'
  | 'DUPLICATE_START'
  | 'OVERLAPPING_PERIOD'
  | 'INVALID_SOURCE'
  | 'INVALID_FLOW_DATE';

export class CycleValidationError extends Error {
  constructor(
    public readonly code: CycleValidationCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CycleValidationError';
  }
}

export interface PeriodRecordInput {
  id?: string;
  startDate: string;
  endDate?: string | null;
  confirmed?: boolean;
  source?: PeriodRecord['source'];
  needsReview?: boolean;
  migrationNote?: string;
  flowByDay?: Record<string, FlowLevel>;
  painByDay?: Record<string, number>;
  productsUsedByDay?: Record<string, number>;
  nightLeakageByDay?: Record<string, boolean>;
  symptomsByDay?: Record<string, string[]>;
  notesByDay?: Record<string, string>;
  notes?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_SOURCES: PeriodRecord['source'][] = ['user', 'imported', 'legacy', 'demo'];
const MAX_HISTORY_DAYS = 3650;
const MAX_PERIOD_DAYS = 14;

function assertLocalDate(value: string, field: string) {
  if (!DATE_RE.test(value)) {
    throw new CycleValidationError('INVALID_DATE', `${field} must use YYYY-MM-DD.`, { field, value });
  }
  const date = fromLocalDateString(value);
  if (toLocalDateString(date) !== value) {
    throw new CycleValidationError('INVALID_DATE', `${field} is not a real calendar date.`, { field, value });
  }
  return date;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}


export function validateCycleObservationDate(value: string, options: { today?: Date } = {}) {
  const today = options.today ?? new Date();
  const date = assertLocalDate(String(value || ''), 'date');
  const normalized = toLocalDateString(date);
  const todayString = toLocalDateString(today);
  if (normalized > todayString) {
    throw new CycleValidationError('FUTURE_DATE', 'A cycle observation cannot be in the future.', { date: normalized, today: todayString });
  }
  if (differenceInLocalDays(today, date) > MAX_HISTORY_DAYS) {
    throw new CycleValidationError('DATE_TOO_OLD', 'The date is outside the supported history window.', { date: normalized });
  }
  return normalized;
}

export function validateAndNormalizePeriodRecord(
  input: PeriodRecordInput,
  existing: PeriodRecord[] = [],
  options: { today?: Date; ignoreId?: string; allowDemoFuture?: boolean } = {},
): PeriodRecordInput {
  const today = options.today ?? new Date();
  const todayString = toLocalDateString(today);
  const start = assertLocalDate(String(input.startDate || ''), 'startDate');
  const startDate = toLocalDateString(start);
  const endDate = input.endDate ? toLocalDateString(assertLocalDate(String(input.endDate), 'endDate')) : null;
  const source = input.source ?? 'user';

  if (!ALLOWED_SOURCES.includes(source)) {
    throw new CycleValidationError('INVALID_SOURCE', 'Unknown period record source.', { source });
  }
  if (!options.allowDemoFuture && startDate > todayString) {
    throw new CycleValidationError('FUTURE_DATE', 'A confirmed period cannot start in the future.', { startDate, today: todayString });
  }
  if (differenceInLocalDays(today, start) > MAX_HISTORY_DAYS) {
    throw new CycleValidationError('DATE_TOO_OLD', 'The date is outside the supported history window.', { startDate });
  }
  if (endDate) {
    if (endDate < startDate) {
      throw new CycleValidationError('END_BEFORE_START', 'Period end cannot be before its start.', { startDate, endDate });
    }
    if (!options.allowDemoFuture && endDate > todayString) {
      throw new CycleValidationError('FUTURE_DATE', 'A confirmed period cannot end in the future.', { endDate, today: todayString });
    }
    const duration = differenceInLocalDays(fromLocalDateString(endDate), start) + 1;
    if (duration > MAX_PERIOD_DAYS) {
      throw new CycleValidationError('PERIOD_TOO_LONG', `A single period cannot exceed ${MAX_PERIOD_DAYS} days without review.`, { duration });
    }
  }

  const normalizedFlow = Object.fromEntries(
    Object.entries(input.flowByDay || {}).map(([date, flow]) => {
      const normalizedDate = toLocalDateString(assertLocalDate(date, 'flowByDay'));
      const effectiveEnd = endDate || startDate;
      if (normalizedDate < startDate || normalizedDate > effectiveEnd) {
        throw new CycleValidationError('INVALID_FLOW_DATE', 'Flow details must belong to the selected period.', {
          date: normalizedDate,
          startDate,
          endDate: effectiveEnd,
        });
      }
      return [normalizedDate, flow];
    }),
  );

  const activeExisting = existing.filter((record) =>
    record.id !== options.ignoreId
    && !record.deletedAt
    && record.confirmed
    && !record.needsReview,
  );
  if (activeExisting.some((record) => record.startDate === startDate)) {
    throw new CycleValidationError('DUPLICATE_START', 'A confirmed period already starts on this date.', { startDate });
  }
  if (input.confirmed !== false && !input.needsReview) {
    const candidateEnd = endDate || startDate;
    const overlap = activeExisting.find((record) => rangesOverlap(
      startDate,
      candidateEnd,
      record.startDate,
      record.endDate || record.startDate,
    ));
    if (overlap) {
      throw new CycleValidationError('OVERLAPPING_PERIOD', 'This period overlaps another confirmed period.', {
        recordId: overlap.id,
        startDate,
        endDate: candidateEnd,
      });
    }
  }

  return {
    ...input,
    startDate,
    endDate,
    source,
    confirmed: input.confirmed ?? true,
    flowByDay: normalizedFlow,
  };
}

export function validatePeriodRecordSet(records: PeriodRecord[], options: { today?: Date } = {}) {
  const normalized: PeriodRecord[] = [];
  for (const record of [...records].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const checked = validateAndNormalizePeriodRecord(record, normalized, {
      today: options.today,
      ignoreId: record.id,
      allowDemoFuture: record.source === 'demo',
    });
    normalized.push({ ...record, ...checked } as PeriodRecord);
  }
  return normalized;
}
