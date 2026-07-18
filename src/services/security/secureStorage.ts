const PREFIX = 'lousa-secure-';
const SECURE_TIMEOUT_MS = 900;
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
    // Lazy-load SecureStore so native-module issues can never block app startup.
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

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, SECURE_TIMEOUT_MS);
    promise.then((value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    }).catch(() => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
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
    const value = await withTimeout(store.getItemAsync(k), null);
    return value ?? memoryFallback.get(k) ?? null;
  },
  async set(key, value) {
    const k = safeKey(key);
    memoryFallback.set(k, value);
    const store = getSecureStore();
    if (!store) return;
    await withTimeout(
      store.setItemAsync(k, value, {
        keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }).then(() => true),
      false,
    );
  },
  async remove(key) {
    const k = safeKey(key);
    memoryFallback.delete(k);
    const store = getSecureStore();
    if (!store) return;
    await withTimeout(store.deleteItemAsync(k).then(() => true), false);
  },
  async clear(keys) {
    await Promise.all(keys.map((key) => this.remove(key)));
  },
};

export const AUTH_TOKEN_KEYS = ['accessToken', 'refreshToken', 'sessionId'] as const;
