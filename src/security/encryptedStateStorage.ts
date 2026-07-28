import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

/**
 * Encrypted, chunked storage for sensitive Zustand state.
 *
 * Expo SecureStore encrypts values using the platform key store. Large JSON is
 * split into small chunks so Android key-store backed preferences are not asked
 * to persist one multi-kilobyte value. A manifest is committed last, which means
 * interrupted writes keep the previous complete generation readable.
 *
 * In Jest/non-native environments SecureStore is unavailable; tests fall back to
 * AsyncStorage. Production verification rejects a missing native SecureStore.
 */

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: Record<string, unknown>) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: string;
};

type Manifest = { version: 1; generation: string; chunks: number; length: number };

const CHUNK_SIZE = 1600;
const PREFIX = 'lousa-encrypted-state-v1';
const SECURE_READ_TIMEOUT_MS = 4_000;
let cachedModule: SecureStoreModule | null | undefined;

function getSecureStore(): SecureStoreModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require('expo-secure-store') as SecureStoreModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}


function allowUnencryptedTestFallback() {
  return process.env.NODE_ENV === 'test' || Platform.OS === 'web';
}

function requireSecureStore(name: string) {
  const store = getSecureStore();
  if (!store && !allowUnencryptedTestFallback()) {
    throw new Error(`Encrypted native storage is unavailable for sensitive state: ${name}`);
  }
  return store;
}

function safePart(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80);
}

function manifestKey(name: string) {
  return `${PREFIX}.${safePart(name)}.manifest`;
}

function chunkKey(name: string, generation: string, index: number) {
  return `${PREFIX}.${safePart(name)}.${safePart(generation)}.${index}`;
}

function split(value: string) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += CHUNK_SIZE) chunks.push(value.slice(index, index + CHUNK_SIZE));
  return chunks.length ? chunks : [''];
}


async function readWithTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Secure storage read timeout: ${label}`)), SECURE_READ_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isValidPersistedJson(value: string | null) {
  if (value == null) return true;
  try {
    const parsed = JSON.parse(value);
    return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
  } catch {
    return false;
  }
}

async function secureSet(store: SecureStoreModule, key: string, value: string) {
  await store.setItemAsync(key, value, {
    keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function readManifest(store: SecureStoreModule, name: string): Promise<Manifest | null> {
  const raw = await readWithTimeout(store.getItemAsync(manifestKey(name)), `${name}:manifest`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Manifest;
    if (parsed.version !== 1 || !parsed.generation || !Number.isInteger(parsed.chunks) || parsed.chunks < 1 || parsed.chunks > 500) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function deleteGeneration(store: SecureStoreModule, name: string, manifest: Manifest | null) {
  if (!manifest) return;
  await Promise.all(Array.from({ length: manifest.chunks }, (_, index) => store.deleteItemAsync(chunkKey(name, manifest.generation, index)).catch(() => {})));
}

export function secureStateStorageAvailable() {
  return Boolean(getSecureStore());
}

export const encryptedStateStorage: StateStorage = {
  async getItem(name) {
    try {
      const store = requireSecureStore(name);
      if (!store) return AsyncStorage.getItem(name);

      const manifest = await readManifest(store, name);
      if (!manifest) {
        // One-time migration from the historical unencrypted store.
        const legacy = await AsyncStorage.getItem(name);
        if (legacy && isValidPersistedJson(legacy)) {
          await encryptedStateStorage.setItem(name, legacy);
          await AsyncStorage.removeItem(name).catch(() => {});
          return legacy;
        }
        return null;
      }

      const chunks = await Promise.all(Array.from(
        { length: manifest.chunks },
        (_, index) => readWithTimeout(
          store.getItemAsync(chunkKey(name, manifest.generation, index)),
          `${name}:chunk:${index}`,
        ),
      ));
      if (chunks.some((chunk) => chunk == null)) return null;
      const value = chunks.join('');
      if (value.length !== manifest.length || !isValidPersistedJson(value)) return null;
      return value;
    } catch (error) {
      // A locked/corrupted keystore must never trap the whole application on the
      // startup error card. Preserve encrypted data and boot with safe defaults.
      console.warn(`[BOOT] encrypted state unavailable for ${name}; preserved for a later retry`, error);
      const legacy = await AsyncStorage.getItem(name).catch(() => null);
      return legacy && isValidPersistedJson(legacy) ? legacy : null;
    }
  },

  async setItem(name, value) {
    if (!isValidPersistedJson(value)) throw new Error(`Refusing to persist malformed encrypted state: ${name}`);
    const store = requireSecureStore(name);
    if (!store) {
      await AsyncStorage.setItem(name, value);
      return;
    }

    const previous = await readManifest(store, name);
    const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chunks = split(value);
    await Promise.all(chunks.map((chunk, index) => secureSet(store, chunkKey(name, generation, index), chunk)));
    const manifest: Manifest = { version: 1, generation, chunks: chunks.length, length: value.length };
    await secureSet(store, manifestKey(name), JSON.stringify(manifest));
    await deleteGeneration(store, name, previous);
    await AsyncStorage.removeItem(name).catch(() => {});
  },

  async removeItem(name) {
    const store = requireSecureStore(name);
    if (store) {
      const manifest = await readManifest(store, name);
      await deleteGeneration(store, name, manifest);
      await store.deleteItemAsync(manifestKey(name)).catch(() => {});
    }
    await AsyncStorage.removeItem(name).catch(() => {});
  },
};

export const encryptedJsonStore = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await encryptedStateStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  async set<T>(key: string, value: T) {
    await encryptedStateStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string) {
    await encryptedStateStorage.removeItem(key);
  },
};

export async function clearEncryptedUserState() {
  await Promise.all([
    'lousa-user',
    'lousa-cycle',
    'lousa-wellness',
    'lousa-box',
    'lousa-cycle-sync-v2',
    'lousa-address-draft-v2',
  ].map((key) => encryptedStateStorage.removeItem(key)));
}
