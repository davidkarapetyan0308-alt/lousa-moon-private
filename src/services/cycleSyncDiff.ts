import type { CycleDayObservation, PeriodRecord } from '../domain/models';
import type { CycleSyncOperation } from './cycleSync';

export interface CycleSyncSnapshot {
  periodRecords: PeriodRecord[];
  cycleObservations: CycleDayObservation[];
}

function entityChanged<T>(before: T | undefined, after: T) {
  return !before || JSON.stringify(before) !== JSON.stringify(after);
}

function meta(kind: string, id: string, createdAt: string, index: number) {
  return {
    operationId: `${kind}-${id}-${createdAt}-${index}`,
    localRevision: Date.parse(createdAt) + index,
    serverRevision: null,
    createdAt,
    retryCount: 0,
    lastError: null,
    status: 'pending' as const,
  };
}

/** Build the exact server diff required for edit/delete/Undo synchronization. */
export function buildCycleSyncDiff(
  before: CycleSyncSnapshot,
  after: CycleSyncSnapshot,
  createdAt = new Date().toISOString(),
): CycleSyncOperation[] {
  const operations: CycleSyncOperation[] = [];
  const beforePeriods = new Map(before.periodRecords.map((item) => [item.id, item]));
  const afterPeriods = new Map(after.periodRecords.map((item) => [item.id, item]));
  const beforeObservations = new Map(before.cycleObservations.map((item) => [item.id, item]));
  const afterObservations = new Map(after.cycleObservations.map((item) => [item.id, item]));
  let index = 0;

  for (const [id] of beforePeriods) {
    if (!afterPeriods.has(id)) operations.push({ ...meta('delete-period', id, createdAt, index++), kind: 'delete_period', payload: { id } });
  }
  for (const [id, item] of afterPeriods) {
    if (entityChanged(beforePeriods.get(id), item)) operations.push({ ...meta('upsert-period', id, createdAt, index++), kind: 'upsert_period', payload: item });
  }
  for (const [id] of beforeObservations) {
    if (!afterObservations.has(id)) operations.push({ ...meta('delete-observation', id, createdAt, index++), kind: 'delete_observation', payload: { id } });
  }
  for (const [id, item] of afterObservations) {
    if (entityChanged(beforeObservations.get(id), item)) operations.push({ ...meta('upsert-observation', id, createdAt, index++), kind: 'upsert_observation', payload: item });
  }

  return operations;
}
