import { SyncMetadata } from '../domain/models';
import { encryptedJsonStore } from '../security/encryptedStateStorage';

const QUEUE_KEY = 'lousa-sync-queue-v2';

export interface SyncOperation<T = unknown> {
  id: string;
  entity: 'period' | 'diary' | 'profile' | 'preferences' | 'subscription' | 'order';
  action: 'upsert' | 'delete';
  payload: T;
  localRevision: number;
  serverRevision: number | null;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
  status: 'pending' | 'syncing' | 'conflict' | 'failed';
}

export interface SyncTransport {
  push(operation: SyncOperation): Promise<{ serverRevision: number; conflict?: boolean }>;
}

export class OfflineSyncQueue {
  constructor(private readonly transport: SyncTransport) {}

  async list(): Promise<SyncOperation[]> {
    return (await encryptedJsonStore.get<SyncOperation[]>(QUEUE_KEY)) || [];
  }

  async enqueue(operation: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount' | 'lastError' | 'status' | 'serverRevision'> & { serverRevision?: number | null }) {
    const queue = await this.list();
    const item: SyncOperation = {
      ...operation,
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      lastError: null,
      status: 'pending',
      serverRevision: operation.serverRevision ?? null,
    };
    await encryptedJsonStore.set(QUEUE_KEY, [...queue, item]);
    return item;
  }

  async flush(): Promise<{ synced: number; failed: number; conflicts: number }> {
    const queue = await this.list();
    const remaining: SyncOperation[] = [];
    let synced = 0;
    let conflicts = 0;
    for (const item of queue) {
      try {
        const result = await this.transport.push({ ...item, status: 'syncing' });
        if (result.conflict) {
          conflicts += 1;
          remaining.push({ ...item, status: 'conflict', retryCount: item.retryCount + 1, lastError: 'REVISION_CONFLICT' });
        } else {
          synced += 1;
        }
      } catch (error) {
        remaining.push({
          ...item,
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastError: error instanceof Error ? error.message.slice(0, 160) : 'SYNC_FAILED',
        });
      }
    }
    await encryptedJsonStore.set(QUEUE_KEY, remaining);
    return { synced, failed: remaining.length - conflicts, conflicts };
  }

  async clear() {
    await encryptedJsonStore.remove(QUEUE_KEY);
  }
}

export const initialSyncMetadata: SyncMetadata = {
  localRevision: 0,
  serverRevision: null,
  syncStatus: 'synced',
  lastSyncedAt: null,
  lastError: null,
};

export class MockSyncTransport implements SyncTransport {
  private revision = 0;
  async push(operation: SyncOperation) {
    if (operation.serverRevision != null && operation.serverRevision !== this.revision) {
      return { serverRevision: this.revision, conflict: true };
    }
    this.revision += 1;
    return { serverRevision: this.revision };
  }
}
