const PREFIX = 'lousa-secure-';
const SECURE_READ_TIMEOUT_MS = 5_000;
const SECURE_WRITE_TIMEOUT_MS = 8_000;
const VALID_KEY = /^[A-Za-z0-9._-]+$/;
const memoryFallback = new Map<string, string>();

type ExpoSecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: string;
};

let secureStoreModule: ExpoSecureStoreModule | null | undefined;

function getSecureStore(): ExpoSecureStoreModule | null {
  if (secureStoreModule !== undefined) return secureStoreModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    secureStoreModule = require('expo-secure-store') as ExpoSecureStoreModule;
  } catch {
    secureStoreModule = null;
  }
  return secureStoreModule;
}

function safeKey(key: string) {
  const raw = `${PREFIX}${key}`;
  const sanitized = raw.replace(/[^A-Za-z0-9._-]/g, '-');
  return VALID_KEY.test(sanitized) ? sanitized : `${PREFIX}fallback`;
}

export class SecureStorageError extends Error {
  constructor(public code: 'SECURE_STORAGE_TIMEOUT' | 'SECURE_STORAGE_WRITE_FAILED', message: string) {
    super(message);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new SecureStorageError('SECURE_STORAGE_TIMEOUT', `${operation} exceeded ${timeoutMs}ms`));
      }
    }, timeoutMs);
    promise.then((value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    }).catch((error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error instanceof Error ? error : new SecureStorageError('SECURE_STORAGE_WRITE_FAILED', `${operation} failed`));
      }
    });
  });
}

export interface SecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(keys: string[]): Promise<void>;
}

export const secureStorage: SecureStorage = {
  async get(key) {
    const k = safeKey(key);
    const store = getSecureStore();
    if (!store) return memoryFallback.get(k) ?? null;
    const value = await withTimeout(store.getItemAsync(k), SECURE_READ_TIMEOUT_MS, `SecureStore.get(${k})`);
    if (value != null) memoryFallback.set(k, value);
    return value;
  },
  async set(key, value) {
    const k = safeKey(key);
    const store = getSecureStore();
    if (!store) {
      memoryFallback.set(k, value);
      return;
    }
    await withTimeout(
      store.setItemAsync(k, value, {
        keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
      SECURE_WRITE_TIMEOUT_MS,
      `SecureStore.set(${k})`,
    );
    // Update the in-memory read-through cache only after durable native success.
    memoryFallback.set(k, value);
  },
  async remove(key) {
    const k = safeKey(key);
    const store = getSecureStore();
    if (store) {
      await withTimeout(store.deleteItemAsync(k), SECURE_WRITE_TIMEOUT_MS, `SecureStore.remove(${k})`);
    }
    memoryFallback.delete(k);
  },
  async clear(keys) {
    const results = await Promise.allSettled(keys.map((key) => this.remove(key)));
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected?.status === 'rejected') throw rejected.reason;
  },
};

export const AUTH_TOKEN_KEYS = ['accessToken', 'refreshToken', 'sessionId'] as const;
