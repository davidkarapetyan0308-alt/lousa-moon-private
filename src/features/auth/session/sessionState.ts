import { AUTH_TOKEN_KEYS, secureStorage } from '../../../services/security/secureStorage';

export type AuthSessionState =
  | 'unauthenticated'
  | 'firebase_authenticated'
  | 'backend_session_pending'
  | 'authenticated'
  | 'guest'
  | 'local_limited_mode'
  | 'session_expired'
  | 'session_error';

export const AUTH_SESSION_STORAGE_KEYS = {
  state: 'authSessionState',
  pendingFirebaseIdToken: 'pendingFirebaseIdToken', // legacy key; cleared but never written in v2
  pendingFirebaseProvider: 'pendingFirebaseProvider',
  pendingFirebaseProfile: 'pendingFirebaseProfile',
  pendingFirebaseUserId: 'pendingFirebaseUserId',
} as const;

export async function setStoredAuthSessionState(state: AuthSessionState) {
  await secureStorage.set(AUTH_SESSION_STORAGE_KEYS.state, state);
}

export async function getStoredAuthSessionState(): Promise<AuthSessionState> {
  const value = await secureStorage.get(AUTH_SESSION_STORAGE_KEYS.state);
  const allowed: AuthSessionState[] = [
    'unauthenticated',
    'firebase_authenticated',
    'backend_session_pending',
    'authenticated',
    'guest',
    'local_limited_mode',
    'session_expired',
    'session_error',
  ];
  return allowed.includes(value as AuthSessionState) ? (value as AuthSessionState) : 'unauthenticated';
}

export async function clearBackendSessionTokens() {
  await secureStorage.clear([...AUTH_TOKEN_KEYS]);
}

export async function savePendingFirebaseExchange(input: {
  provider: string;
  profile?: Record<string, unknown>;
  userId: string;
}) {
  // Preserve an existing working LOUSA session until a replacement session is committed.
  // Firebase ID tokens are short-lived credentials managed by Firebase SDK and are not persisted manually.
  await Promise.all([
    secureStorage.set(AUTH_SESSION_STORAGE_KEYS.pendingFirebaseProvider, input.provider),
    secureStorage.set(AUTH_SESSION_STORAGE_KEYS.pendingFirebaseProfile, JSON.stringify(input.profile || {})),
    secureStorage.set(AUTH_SESSION_STORAGE_KEYS.pendingFirebaseUserId, input.userId),
    setStoredAuthSessionState('local_limited_mode'),
  ]);
}

export async function readPendingFirebaseExchange() {
  const [provider, profileRaw, userId] = await Promise.all([
    secureStorage.get(AUTH_SESSION_STORAGE_KEYS.pendingFirebaseProvider),
    secureStorage.get(AUTH_SESSION_STORAGE_KEYS.pendingFirebaseProfile),
    secureStorage.get(AUTH_SESSION_STORAGE_KEYS.pendingFirebaseUserId),
  ]);
  if (!provider || !userId) return null;
  let profile: Record<string, unknown> = {};
  try { profile = profileRaw ? JSON.parse(profileRaw) : {}; } catch { profile = {}; }
  return { provider, profile, userId };
}

export async function clearPendingFirebaseExchange() {
  await secureStorage.clear([
    AUTH_SESSION_STORAGE_KEYS.pendingFirebaseIdToken,
    AUTH_SESSION_STORAGE_KEYS.pendingFirebaseProvider,
    AUTH_SESSION_STORAGE_KEYS.pendingFirebaseProfile,
    AUTH_SESSION_STORAGE_KEYS.pendingFirebaseUserId,
  ]);
}

export async function clearAllAuthSessionState() {
  await clearBackendSessionTokens();
  await clearPendingFirebaseExchange();
  await setStoredAuthSessionState('unauthenticated');
}
