import { PeriodRecord } from '../domain/models';
import { createLegacyPeriodRecords } from './cyclePrediction';
import { fromLocalDateString, toLocalDateString } from '../utils/date';

export const DATA_SCHEMA_VERSION = 6;

export interface CycleMigrationInput {
  lastPeriodStart?: string | null;
  avgPeriodLength?: number;
  periodHistory?: string[];
  periodRecords?: unknown;
  migrationCompletedAt?: string | null;
}

export interface CycleMigrationResult {
  periodRecords: PeriodRecord[];
  needsReview: boolean;
  issues: string[];
  migratedAt: string;
}

function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = fromLocalDateString(value);
  return !Number.isNaN(parsed.getTime()) && toLocalDateString(parsed) === value;
}

function sanitizeRecord(raw: any, today = new Date()): PeriodRecord | null {
  if (!raw || !isValidLocalDate(raw.startDate)) return null;
  if (fromLocalDateString(raw.startDate) > today) return null;

  const now = new Date().toISOString();
  const source: PeriodRecord['source'] = ['user', 'imported', 'legacy', 'demo'].includes(raw.source)
    ? raw.source
    : 'legacy';
  const legacy = source === 'legacy';
  const endDate = isValidLocalDate(raw.endDate) && raw.endDate >= raw.startDate ? raw.endDate : null;
  const flowByDay = raw.flowByDay && typeof raw.flowByDay === 'object' ? raw.flowByDay : {};

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `migrated-${raw.startDate}`,
    startDate: raw.startDate,
    endDate,
    confirmed: legacy ? false : Boolean(raw.confirmed),
    source,
    needsReview: legacy ? true : Boolean(raw.needsReview),
    migrationNote: legacy
      ? raw.migrationNote || 'Imported from an older LOUSA version. Review before using for predictions.'
      : raw.migrationNote,
    flowByDay,
    painByDay: raw.painByDay && typeof raw.painByDay === 'object' ? raw.painByDay : undefined,
    productsUsedByDay: raw.productsUsedByDay && typeof raw.productsUsedByDay === 'object' ? raw.productsUsedByDay : undefined,
    nightLeakageByDay: raw.nightLeakageByDay && typeof raw.nightLeakageByDay === 'object' ? raw.nightLeakageByDay : undefined,
    symptomsByDay: raw.symptomsByDay && typeof raw.symptomsByDay === 'object' ? raw.symptomsByDay : undefined,
    notesByDay: raw.notesByDay && typeof raw.notesByDay === 'object' ? raw.notesByDay : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };
}

export function migrateCycleStateToV6(input: CycleMigrationInput, today = new Date()): CycleMigrationResult {
  const issues: string[] = [];
  let candidates: unknown[] = [];

  if (Array.isArray(input.periodRecords) && input.periodRecords.length) {
    candidates = input.periodRecords;
  } else {
    candidates = createLegacyPeriodRecords(
      Array.isArray(input.periodHistory) ? input.periodHistory.filter(isValidLocalDate) : [],
      isValidLocalDate(input.lastPeriodStart) ? input.lastPeriodStart : undefined,
      Number.isFinite(input.avgPeriodLength) ? Number(input.avgPeriodLength) : 5
    );
    if (candidates.length) issues.push('legacy_history_imported');
  }

  const byStart = new Map<string, PeriodRecord>();
  for (const candidate of candidates) {
    const record = sanitizeRecord(candidate, today);
    if (!record) {
      issues.push('invalid_record_removed');
      continue;
    }
    const existing = byStart.get(record.startDate);
    if (!existing) {
      byStart.set(record.startDate, record);
      continue;
    }
    issues.push('duplicate_record_merged');
    const preferred = existing.source === 'legacy' && record.source !== 'legacy' ? record : existing;
    byStart.set(record.startDate, {
      ...preferred,
      flowByDay: { ...existing.flowByDay, ...record.flowByDay },
      painByDay: { ...(existing.painByDay || {}), ...(record.painByDay || {}) },
      productsUsedByDay: { ...(existing.productsUsedByDay || {}), ...(record.productsUsedByDay || {}) },
      nightLeakageByDay: { ...(existing.nightLeakageByDay || {}), ...(record.nightLeakageByDay || {}) },
      notesByDay: { ...(existing.notesByDay || {}), ...(record.notesByDay || {}) },
      updatedAt: new Date().toISOString(),
    });
  }

  const periodRecords = Array.from(byStart.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const needsReview = periodRecords.some((record) => record.needsReview || (record.source === 'legacy' && !record.confirmed));

  return {
    periodRecords,
    needsReview,
    issues: Array.from(new Set(issues)),
    migratedAt: new Date().toISOString(),
  };
}

export function confirmLegacyRecord(record: PeriodRecord): PeriodRecord {
  return {
    ...record,
    confirmed: true,
    needsReview: false,
    migrationNote: undefined,
    updatedAt: new Date().toISOString(),
  };
}
