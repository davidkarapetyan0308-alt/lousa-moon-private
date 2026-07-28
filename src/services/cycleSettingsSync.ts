import type { CycleSettingsPayload } from './contracts';
import { encryptedJsonStore } from '../security/encryptedStateStorage';
import { apiCycleSettingsService } from './api';
import { getStoredAuthSessionState } from '../features/auth/session/sessionState';

const KEY = 'lousa-cycle-settings-sync-v1';

type PendingCycleSettings = {
  operationId: string;
  payload: CycleSettingsPayload;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
};

export async function enqueueCycleSettingsSync(payload: CycleSettingsPayload) {
  if ((await getStoredAuthSessionState()) === 'guest') return;
  const pending: PendingCycleSettings = {
    operationId: `cycle-settings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
  };
  await encryptedJsonStore.set(KEY, pending);
}

export async function flushCycleSettingsSync() {
  if ((await getStoredAuthSessionState()) === 'guest') return { synced: false, pending: false, guest: true };
  const pending = await encryptedJsonStore.get<PendingCycleSettings>(KEY);
  if (!pending) return { synced: true, pending: false };
  const result = await apiCycleSettingsService.saveSettings(pending.payload);
  if (result.ok) {
    await encryptedJsonStore.remove(KEY);
    return { synced: true, pending: false };
  }
  await encryptedJsonStore.set(KEY, {
    ...pending,
    retryCount: pending.retryCount + 1,
    lastError: result.error.code,
  });
  return { synced: false, pending: true, error: result.error };
}

export async function clearCycleSettingsSync() {
  await encryptedJsonStore.remove(KEY);
}
