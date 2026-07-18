import type { CycleDayObservation, PeriodRecord } from '../domain/models';
import { encryptedJsonStore } from '../security/encryptedStateStorage';
import { apiCycleSyncTransport } from './api';
import { useCycleStore } from '../store';

const QUEUE_KEY = 'lousa-cycle-sync-v2';

type SyncMeta = {
  operationId: string;
  localRevision: number;
  serverRevision: number | null;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
  status: 'pending' | 'failed' | 'conflict';
};

export type CycleSyncOperation =
  | (SyncMeta & { kind: 'upsert_period'; payload: PeriodRecord })
  | (SyncMeta & { kind: 'delete_period'; payload: { id: string } })
  | (SyncMeta & { kind: 'upsert_observation'; payload: CycleDayObservation })
  | (SyncMeta & { kind: 'delete_observation'; payload: { id: string } });

function entityKey(operation: CycleSyncOperation) {
  return `${operation.kind.includes('period') ? 'period' : 'observation'}:${operation.payload.id}`;
}

async function readQueue(): Promise<CycleSyncOperation[]> {
  return (await encryptedJsonStore.get<CycleSyncOperation[]>(QUEUE_KEY)) || [];
}

function normalizeOperation(operation: Partial<CycleSyncOperation> & Pick<CycleSyncOperation, 'kind' | 'payload'>): CycleSyncOperation {
  const createdAt = operation.createdAt || new Date().toISOString();
  return {
    ...operation,
    operationId: operation.operationId || `cycle-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    localRevision: operation.localRevision ?? Date.now(),
    serverRevision: operation.serverRevision ?? ('serverRevision' in operation.payload ? operation.payload.serverRevision ?? null : null),
    createdAt,
    retryCount: operation.retryCount ?? 0,
    lastError: operation.lastError ?? null,
    status: operation.status ?? 'pending',
  } as CycleSyncOperation;
}

export async function enqueueCycleSync(operations: Array<Partial<CycleSyncOperation> & Pick<CycleSyncOperation, 'kind' | 'payload'>>) {
  if (!operations.length) return;
  const existing = await readQueue();
  const compacted = new Map<string, CycleSyncOperation>();
  for (const operation of [...existing, ...operations.map(normalizeOperation)]) compacted.set(entityKey(operation), operation);
  await encryptedJsonStore.set(QUEUE_KEY, [...compacted.values()]);
}

async function pushOperation(operation: CycleSyncOperation) {
  const meta = {
    operationId: operation.operationId,
    localRevision: operation.localRevision,
    expectedServerRevision: operation.serverRevision,
  };
  if (operation.kind === 'upsert_period') return apiCycleSyncTransport.savePeriod(operation.payload, meta);
  if (operation.kind === 'delete_period') return apiCycleSyncTransport.deletePeriod(operation.payload.id, meta);
  if (operation.kind === 'upsert_observation') return apiCycleSyncTransport.saveObservation(operation.payload, meta);
  return apiCycleSyncTransport.deleteObservation(operation.payload.id, meta);
}

function applyServerRevision(operation: CycleSyncOperation, data: unknown) {
  if (!data || typeof data !== 'object') return;
  if (operation.kind === 'upsert_period') {
    const record = data as PeriodRecord;
    useCycleStore.setState((state) => ({
      periodRecords: state.periodRecords.map((item) => item.id === record.id ? { ...item, serverRevision: record.serverRevision, updatedAt: record.updatedAt } : item),
    }));
  } else if (operation.kind === 'upsert_observation') {
    const observation = data as CycleDayObservation;
    useCycleStore.setState((state) => ({
      cycleObservations: state.cycleObservations.map((item) => item.id === observation.id ? { ...item, serverRevision: observation.serverRevision, updatedAt: observation.updatedAt } : item),
    }));
  }
}

export async function flushCycleSyncQueue() {
  const queue = await readQueue();
  if (!queue.length) return { synced: 0, failed: 0, conflicts: 0 };
  const failed: CycleSyncOperation[] = [];
  let synced = 0;
  let conflicts = 0;
  for (const operation of queue) {
    try {
      const result = await pushOperation(operation);
      if (!result.ok) {
        const conflict = result.error?.code === 'REVISION_CONFLICT';
        if (conflict) conflicts += 1;
        failed.push({
          ...operation,
          retryCount: operation.retryCount + 1,
          lastError: result.error?.code || 'SYNC_FAILED',
          status: conflict ? 'conflict' : 'failed',
        });
      } else {
        applyServerRevision(operation, result.data);
        synced += 1;
      }
    } catch (error) {
      failed.push({
        ...operation,
        retryCount: operation.retryCount + 1,
        lastError: error instanceof Error ? error.message.slice(0, 160) : 'SYNC_FAILED',
        status: 'failed',
      });
    }
  }
  await encryptedJsonStore.set(QUEUE_KEY, failed);
  return { synced, failed: failed.length - conflicts, conflicts };
}

export async function clearCycleSyncQueue() {
  await encryptedJsonStore.remove(QUEUE_KEY);
}
