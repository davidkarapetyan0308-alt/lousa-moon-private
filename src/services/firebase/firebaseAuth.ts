import type { AuthService, ServiceResult, SessionInfo } from '../contracts';
import Constants from 'expo-constants';
import { getUserFacingErrorMessage } from '../errorMessages';
import { assertApiEnvironmentReady } from '../apiEnvironment';
import { AUTH_TOKEN_KEYS, secureStorage } from '../security/secureStorage';
import { createAuthAttemptId, traceAuth } from '../../features/auth/diagnostics/authTrace';
import { delay, OperationTimeoutError, withTimeout } from '../../shared/network/withTimeout';
import {
  clearAllAuthSessionState,
  clearPendingFirebaseExchange,
  readPendingFirebaseExchange,
  savePendingFirebaseExchange,
  setStoredAuthSessionState,
} from '../../features/auth/session/sessionState';

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(code: string, message: string, recoverable = false, details?: Record<string, unknown>): ServiceResult<T> => ({
  ok: false,
  error: { code, message: getUserFacingErrorMessage({ code, message }, message), recoverable, details },
});

type NativeFirebaseAuth = any;
type NativeFirebaseUser = {
  uid?: string;
  email?: string | null;
  phoneNumber?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};
type PhoneConfirmation = { confirm(code: string): Promise<{ user?: { getIdToken(forceRefresh?: boolean): Promise<string> } }> };

const phoneConfirmations = new Map<string, PhoneConfirmation>();

const FIREBASE_AUTH_ACTION_URL = String(
  Constants.expoConfig?.extra?.firebaseAuthActionUrl || process.env.EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL || '',
).trim();

function getFirebaseActionCodeSettings() {
  if (!FIREBASE_AUTH_ACTION_URL) return undefined;
  return {
    url: FIREBASE_AUTH_ACTION_URL,
    handleCodeInApp: false,
  };
}

async function sendFirebaseEmailVerification(user: any) {
  const settings = getFirebaseActionCodeSettings();
  return settings ? user.sendEmailVerification(settings) : user.sendEmailVerification();
}

async function sendFirebasePasswordReset(auth: NativeFirebaseAuth, email: string) {
  const settings = getFirebaseActionCodeSettings();
  return settings ? auth.sendPasswordResetEmail(email, settings) : auth.sendPasswordResetEmail(email);
}

function firebasePhoneStartError(error: unknown): ServiceResult<never> {
  const rawCode = String((error as any)?.code || '').toLowerCase();
  if ([
    'auth/operation-not-allowed',
    'auth/app-not-authorized',
    'auth/invalid-app-credential',
    'auth/missing-client-identifier',
    'auth/unsupported-first-factor',
  ].includes(rawCode)) {
    return fail('FIREBASE_PHONE_UNAVAILABLE', 'Вход по номеру пока недоступен. Используйте email или попробуйте позже.', true);
  }
  if (rawCode === 'auth/quota-exceeded' || rawCode === 'auth/too-many-requests') {
    return fail('FIREBASE_PHONE_RATE_LIMITED', 'Слишком много запросов SMS. Попробуйте позже.', true);
  }
  if (rawCode === 'auth/invalid-phone-number' || rawCode === 'auth/missing-phone-number') {
    return fail('FIREBASE_PHONE_INVALID_NUMBER', 'Введите корректный номер в международном формате.', true);
  }
  return firebaseError(error, 'FIREBASE_PHONE_START_FAILED');
}

function getNativeFirebaseAuth(): NativeFirebaseAuth | null {
  try {
    // Dynamic require keeps demo/local tooling from crashing before npm install.
    // The package is still required for real APK builds.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const authPackage = require('@react-native-firebase/auth');
    const authFactory = authPackage.default || authPackage;
    if (typeof authFactory !== 'function') return null;
    return authFactory();
  } catch (error) {
    if (__DEV__) console.warn('[LOUSA Firebase] native auth unavailable', error);
    return null;
  }
}

function getNativeFirebaseAuthPackage(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-firebase/auth');
  } catch {
    return null;
  }
}

function requireFirebaseAuth(): NativeFirebaseAuth | ServiceResult<never> {
  const authPackage = getNativeFirebaseAuthPackage();
  if (!authPackage) {
    return fail('FIREBASE_NATIVE_SDK_MISSING', 'Native Firebase SDK не установлен в этой APK. Нужен dev/release build с @react-native-firebase/app и @react-native-firebase/auth.');
  }
  try {
    const authFactory = authPackage.default || authPackage;
    if (typeof authFactory !== 'function') {
      return fail('FIREBASE_NATIVE_SDK_MISSING', 'Native Firebase Auth module is unavailable in this APK.');
    }
    return authFactory();
  } catch (error) {
    return fail(
      'FIREBASE_AUTH_NOT_CONFIGURED',
      'Firebase default app не инициализирован. Проверьте android/app/google-services.json и Google Services Gradle plugin.',
      false,
      __DEV__ && error instanceof Error ? { message: error.message } : undefined,
    );
  }
}

const BACKEND_READY_TIMEOUT_MS = 5_000;
const BACKEND_SESSION_TIMEOUT_MS = 4_000;
const FIREBASE_ID_TOKEN_TIMEOUT_MS = 8_000;

function appRequestHeaders(attemptId: string) {
  return {
    'X-Auth-Attempt-ID': attemptId,
    'X-App-Version': String(Constants.expoConfig?.version || 'unknown'),
    'X-App-Build': String(Constants.expoConfig?.android?.versionCode || 'unknown'),
    'X-App-Package': String(Constants.expoConfig?.android?.package || 'unknown'),
  };
}

async function parseResponsePayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 500) }; }
}

async function checkBackendReadiness(apiUrl: string, attemptId: string): Promise<ServiceResult<void>> {
  traceAuth(attemptId, 'BACKEND_READINESS_STARTED');
  try {
    const response = await withTimeout(
      (signal) => fetch(`${apiUrl}/ready`, {
        method: 'GET',
        headers: { Accept: 'application/json', ...appRequestHeaders(attemptId) },
        signal,
      }),
      { timeoutMs: BACKEND_READY_TIMEOUT_MS, stage: 'BACKEND_READINESS' },
    );
    const payload = await parseResponsePayload(response);
    if (!response.ok || payload?.status !== 'ready') {
      traceAuth(attemptId, 'BACKEND_READINESS_FAILED', { httpStatus: response.status });
      return fail(
        response.status >= 500 ? `HTTP_${response.status}` : 'BACKEND_NOT_READY',
        payload?.error?.message || payload?.message || 'Сервер LOUSA пока не готов.',
        true,
        { httpStatus: response.status },
      );
    }
    traceAuth(attemptId, 'BACKEND_READINESS_SUCCEEDED', { httpStatus: response.status });
    return ok(undefined);
  } catch (error) {
    const timedOut = error instanceof OperationTimeoutError;
    traceAuth(attemptId, 'BACKEND_READINESS_FAILED', { reason: timedOut ? 'timeout' : 'network' });
    return fail(
      timedOut ? 'BACKEND_READY_TIMEOUT' : 'NETWORK_ERROR',
      timedOut ? 'Сервер LOUSA не подготовился за 5 секунд.' : 'Не удалось связаться с сервером LOUSA.',
      true,
    );
  }
}

async function requestFirebaseSession<T>(
  idToken: string,
  provider: string,
  profile: Record<string, unknown>,
  attemptId: string,
): Promise<ServiceResult<T>> {
  const apiUrl = assertApiEnvironmentReady();
  const ready = await checkBackendReadiness(apiUrl, attemptId);
  if (!ready.ok) return ready as ServiceResult<T>;

  const backoffs = [0, 750];
  let lastFailure: ServiceResult<T> | null = null;
  for (let index = 0; index < backoffs.length; index += 1) {
    if (backoffs[index]) {
      traceAuth(attemptId, 'BACKEND_SESSION_RETRY', { attempt: index + 1, delayMs: backoffs[index] });
      await delay(backoffs[index]);
    }
    traceAuth(attemptId, 'BACKEND_SESSION_STARTED', { attempt: index + 1 });
    try {
      const response = await withTimeout(
        (signal) => fetch(`${apiUrl}/v1/auth/firebase/session`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
            ...appRequestHeaders(attemptId),
          },
          body: JSON.stringify({ provider, profile }),
          signal,
        }),
        { timeoutMs: BACKEND_SESSION_TIMEOUT_MS, stage: 'BACKEND_SESSION_EXCHANGE' },
      );
      const payload = await parseResponsePayload(response);
      if (response.ok) {
        traceAuth(attemptId, 'BACKEND_SESSION_SUCCEEDED', { httpStatus: response.status, attempt: index + 1 });
        return ok(payload as T);
      }
      const code = payload?.error?.code || `HTTP_${response.status}`;
      const message = payload?.error?.message || 'Firebase session exchange failed.';
      const recoverable = response.status >= 500 || response.status === 429;
      traceAuth(attemptId, 'BACKEND_SESSION_REJECTED', { code, httpStatus: response.status, recoverable });
      lastFailure = fail(code, message, recoverable, payload?.error?.details);
      if (!recoverable) return lastFailure;
    } catch (error) {
      const timedOut = error instanceof OperationTimeoutError;
      traceAuth(attemptId, timedOut ? 'BACKEND_SESSION_TIMEOUT' : 'BACKEND_SESSION_NETWORK_ERROR', { attempt: index + 1 });
      lastFailure = fail(
        timedOut ? 'BACKEND_SESSION_TIMEOUT' : 'NETWORK_ERROR',
        timedOut ? 'Сервер LOUSA не ответил за 4 секунды.' : 'Соединение с сервером LOUSA прервано.',
        true,
      );
    }
    if (index === backoffs.length - 1) break;
  }
  return lastFailure || fail('BACKEND_SESSION_FAILED', 'LOUSA не смогла создать серверную сессию.', true);
}

async function persistBackendSessionAtomically(input: { accessToken: string; refreshToken: string; sessionId: string }, attemptId: string) {
  traceAuth(attemptId, 'LOCAL_SESSION_SAVE_STARTED');
  const previous = await Promise.all(AUTH_TOKEN_KEYS.map((key) => secureStorage.get(key)));
  try {
    await Promise.all([
      secureStorage.set('accessToken', input.accessToken),
      secureStorage.set('refreshToken', input.refreshToken),
      secureStorage.set('sessionId', input.sessionId),
    ]);
    const saved = await Promise.all(AUTH_TOKEN_KEYS.map((key) => secureStorage.get(key)));
    if (saved[0] !== input.accessToken || saved[1] !== input.refreshToken || saved[2] !== input.sessionId) {
      throw new Error('Secure session verification failed.');
    }
    traceAuth(attemptId, 'LOCAL_SESSION_SAVE_SUCCEEDED');
  } catch (error) {
    await Promise.all(AUTH_TOKEN_KEYS.map((key, index) => previous[index] == null ? secureStorage.remove(key) : secureStorage.set(key, previous[index]!)));
    traceAuth(attemptId, 'LOCAL_SESSION_SAVE_FAILED');
    throw error;
  }
}

function isTransientSessionExchangeError(code: string) {
  return (
    code === 'SERVER_ERROR' ||
    code === 'AUTH_DATABASE_UNAVAILABLE' ||
    code === 'FIREBASE_AUTH_BACKEND_UNAVAILABLE' ||
    code === 'NETWORK_ERROR' ||
    code === 'BACKEND_READY_TIMEOUT' ||
    code === 'BACKEND_NOT_READY' ||
    code === 'BACKEND_SESSION_TIMEOUT' ||
    code.startsWith('HTTP_5')
  );
}

async function createFirebaseLimitedSession(
  provider: string,
  profile: Record<string, unknown>,
  user?: NativeFirebaseUser | null,
  limitedReason = 'BACKEND_SESSION_PENDING',
): Promise<ServiceResult<SessionInfo>> {
  const userId = String(user?.uid || '').trim();
  if (!userId) {
    return fail('FIREBASE_LIMITED_USER_MISSING', 'Firebase подтвердил вход, но профиль пользователя не найден. Повторите вход.', true);
  }

  // Firebase SDK owns the short-lived ID token. Persist only retry metadata;
  // retryBackendSession obtains a fresh token without reopening Google chooser.
  await savePendingFirebaseExchange({ provider, profile, userId });

  return ok({
    userId,
    sessionId: `firebase:${userId}`,
    demo: false,
    email: user?.email || undefined,
    phone: user?.phoneNumber || undefined,
    name: user?.displayName || undefined,
    avatarUri: user?.photoURL ?? null,
    isNewUser: false,
    sessionState: 'local_limited_mode',
    backendSessionReady: false,
    limitedReason,
  });
}

async function exchangeFirebaseIdToken(
  idToken: string,
  provider: string,
  profile: Record<string, unknown> = {},
  fallbackUser?: NativeFirebaseUser | null,
  attemptId = createAuthAttemptId(),
): Promise<ServiceResult<SessionInfo>> {
  const result = await requestFirebaseSession<{
    user: { id: string; email?: string; phone?: string; name?: string; avatarUri?: string | null };
    accessToken: string;
    refreshToken: string;
    demo?: boolean;
    isNewUser?: boolean;
  }>(idToken, provider, profile, attemptId);
  if (!result.ok) {
    if (isTransientSessionExchangeError(result.error.code)) {
      if (__DEV__) console.warn('[LOUSA Firebase] backend session exchange failed; using Firebase fallback session', result.error.code);
      return createFirebaseLimitedSession(provider, profile, fallbackUser);
    }
    return result;
  }
  await persistBackendSessionAtomically({
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
    sessionId: result.data.user.id,
  }, attemptId);
  await clearPendingFirebaseExchange();
  await setStoredAuthSessionState('authenticated');
  return ok({
    userId: result.data.user.id,
    sessionId: result.data.user.id,
    accessToken: result.data.accessToken,
    refreshToken: result.data.refreshToken,
    demo: Boolean(result.data.demo),
    email: result.data.user.email,
    phone: result.data.user.phone,
    name: result.data.user.name,
    avatarUri: result.data.user.avatarUri ?? null,
    isNewUser: Boolean(result.data.isNewUser),
    sessionState: 'authenticated',
    backendSessionReady: true,
  });
}

async function tokenFromCurrentUser(auth: NativeFirebaseAuth, forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) throw new Error('Firebase user is missing after sign-in.');
  return withTimeout<string>(
    () => user.getIdToken(forceRefresh),
    { timeoutMs: FIREBASE_ID_TOKEN_TIMEOUT_MS, stage: 'FIREBASE_ID_TOKEN' },
  );
}

function firebaseError(error: unknown, fallbackCode = 'FIREBASE_AUTH_FAILED'): ServiceResult<never> {
  const rawCode = String((error as any)?.code || fallbackCode).replace('auth/', '').toUpperCase().replace(/[-/]/g, '_');
  const code = rawCode.startsWith('FIREBASE_') ? rawCode : `FIREBASE_${rawCode}`;
  const message = (error as any)?.message || 'Firebase authentication failed.';
  return fail(code, message, true, __DEV__ ? { rawCode: (error as any)?.code, message } : undefined);
}

export const firebaseAuthService: AuthService = {
  async register(input) {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<any>;
    try {
      const auth = authOrError;
      const credential = await auth.createUserWithEmailAndPassword(input.email.trim(), input.password);
      if (input.name && credential.user?.updateProfile) {
        await credential.user.updateProfile({ displayName: input.name.trim() }).catch(() => null);
      }
      if (credential.user?.sendEmailVerification) {
        await sendFirebaseEmailVerification(credential.user);
      }
      return ok({
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        resendAfterSeconds: 60,
        firebaseSessionReady: false,
        firebaseEmailVerificationSent: true,
        emailDelivery: { provider: 'firebase-auth', configured: true, devMode: false },
      } as any);
    } catch (error) {
      return firebaseError(error, 'FIREBASE_EMAIL_SIGNUP_FAILED') as ServiceResult<any>;
    }
  },

  async verifyRegistration() {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<SessionInfo>;
    try {
      const user = authOrError.currentUser;
      if (!user) return fail('FIREBASE_USER_MISSING', 'Войдите снова и повторите подтверждение.') as ServiceResult<SessionInfo>;
      await user.reload();
      if (!authOrError.currentUser?.emailVerified) {
        return fail('FIREBASE_EMAIL_NOT_VERIFIED', 'Email ещё не подтверждён. Откройте письмо Firebase и нажмите ссылку.') as ServiceResult<SessionInfo>;
      }
      const idToken = await tokenFromCurrentUser(authOrError, true);
      return exchangeFirebaseIdToken(idToken, 'firebase-password', {
        name: authOrError.currentUser?.displayName || undefined,
      }, authOrError.currentUser);
    } catch (error) {
      return firebaseError(error, 'FIREBASE_EMAIL_VERIFY_FAILED') as ServiceResult<SessionInfo>;
    }
  },

  async resendRegistrationVerification() {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<{ resendAfterSeconds?: number }>;
    try {
      const user = authOrError.currentUser;
      if (!user) return fail('FIREBASE_USER_MISSING', 'Войдите снова, чтобы отправить письмо подтверждения.') as ServiceResult<{ resendAfterSeconds?: number }>;
      if (user.emailVerified) return ok({ resendAfterSeconds: 0 });
      await sendFirebaseEmailVerification(user);
      return ok({ resendAfterSeconds: 60 });
    } catch (error) {
      return firebaseError(error, 'FIREBASE_EMAIL_VERIFICATION_SEND_FAILED') as ServiceResult<{ resendAfterSeconds?: number }>;
    }
  },

  async signIn(email, password) {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<SessionInfo>;
    try {
      const credential = await authOrError.signInWithEmailAndPassword(email.trim(), password);
      await credential.user?.reload?.();
      if (!authOrError.currentUser?.emailVerified) {
        return fail('FIREBASE_EMAIL_NOT_VERIFIED', 'Сначала подтвердите email по ссылке из письма.') as ServiceResult<SessionInfo>;
      }
      const idToken = await tokenFromCurrentUser(authOrError, true);
      return exchangeFirebaseIdToken(idToken, 'firebase-password', {}, authOrError.currentUser);
    } catch (error) {
      return firebaseError(error, 'FIREBASE_EMAIL_SIGNIN_FAILED') as ServiceResult<SessionInfo>;
    }
  },

  async signInWithGoogle(idToken, context) {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<SessionInfo>;
    const attemptId = context?.attemptId || createAuthAttemptId();
    let firebaseCredentialSucceeded = false;
    try {
      const authPackage = getNativeFirebaseAuthPackage();
      if (!authPackage?.GoogleAuthProvider) {
        return fail('FIREBASE_GOOGLE_PROVIDER_MISSING', 'Firebase Google provider недоступен в этой сборке.');
      }
      const credential = authPackage.GoogleAuthProvider.credential(idToken);
      await withTimeout(() => authOrError.signInWithCredential(credential), { timeoutMs: 10_000, stage: 'FIREBASE_CREDENTIAL' });
      firebaseCredentialSucceeded = true;
      traceAuth(attemptId, 'FIREBASE_CREDENTIAL_SUCCEEDED');
      traceAuth(attemptId, 'FIREBASE_ID_TOKEN_STARTED');
      const firebaseIdToken = await tokenFromCurrentUser(authOrError);
      traceAuth(attemptId, 'FIREBASE_ID_TOKEN_RECEIVED', { tokenPresent: true, tokenLength: firebaseIdToken.length });
      return exchangeFirebaseIdToken(firebaseIdToken, 'firebase-google', {}, authOrError.currentUser, attemptId);
    } catch (error) {
      if (firebaseCredentialSucceeded && authOrError.currentUser && error instanceof OperationTimeoutError) {
        traceAuth(attemptId, 'FIREBASE_ID_TOKEN_FAILED', { reason: 'timeout_after_credential' });
        return createFirebaseLimitedSession('firebase-google', {}, authOrError.currentUser, 'FIREBASE_ID_TOKEN_PENDING');
      }
      traceAuth(attemptId, 'FIREBASE_CREDENTIAL_FAILED', { code: String((error as any)?.code || 'unknown') });
      return firebaseError(error, 'FIREBASE_GOOGLE_SIGNIN_FAILED') as ServiceResult<SessionInfo>;
    }
  },

  async startPhoneAuth(input) {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<any>;
    try {
      const confirmation = await authOrError.signInWithPhoneNumber(input.phone);
      phoneConfirmations.set(input.phone, confirmation);
      return ok({
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        resendAfterSeconds: 60,
        smsDelivery: { provider: 'firebase-auth', configured: true, devMode: false },
      });
    } catch (error) {
      return firebasePhoneStartError(error) as ServiceResult<any>;
    }
  },

  async verifyPhoneAuth(input) {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<SessionInfo>;
    const confirmation = phoneConfirmations.get(input.phone);
    if (!confirmation) return fail('FIREBASE_PHONE_CONFIRMATION_MISSING', 'Сначала запросите SMS-код ещё раз.');
    try {
      await confirmation.confirm(input.code);
      const idToken = await tokenFromCurrentUser(authOrError);
      phoneConfirmations.delete(input.phone);
      return exchangeFirebaseIdToken(idToken, 'firebase-phone', {}, authOrError.currentUser);
    } catch (error) {
      return firebaseError(error, 'FIREBASE_PHONE_VERIFY_FAILED') as ServiceResult<SessionInfo>;
    }
  },

  async requestPasswordReset(email) {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<void>;
    try {
      await sendFirebasePasswordReset(authOrError, email.trim());
      return ok(undefined);
    } catch (error) {
      return firebaseError(error, 'FIREBASE_PASSWORD_RESET_FAILED') as ServiceResult<void>;
    }
  },

  async resetPassword() {
    return fail('FIREBASE_PASSWORD_RESET_LINK_REQUIRED', 'В Firebase пароль меняется через ссылку из письма восстановления.');
  },

  async signOut() {
    const auth = getNativeFirebaseAuth();
    await auth?.signOut?.().catch(() => null);
    await clearAllAuthSessionState();
    return ok(undefined);
  },

  async signOutAll() {
    const auth = getNativeFirebaseAuth();
    await auth?.signOut?.().catch(() => null);
    await clearAllAuthSessionState();
    return ok(undefined);
  },

  async refreshSession() {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<SessionInfo>;
    try {
      const pending = await readPendingFirebaseExchange();
      const idToken = await tokenFromCurrentUser(authOrError);
      return exchangeFirebaseIdToken(
        idToken,
        pending?.provider || 'firebase-refresh',
        pending?.profile || {},
        authOrError.currentUser,
      );
    } catch (error) {
      await setStoredAuthSessionState('session_error');
      return firebaseError(error, 'FIREBASE_REFRESH_FAILED') as ServiceResult<SessionInfo>;
    }
  },

  async retryBackendSession() {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<SessionInfo>;
    try {
      const pending = await readPendingFirebaseExchange();
      const idToken = await tokenFromCurrentUser(authOrError);
      return exchangeFirebaseIdToken(
        idToken,
        pending?.provider || 'firebase-retry',
        pending?.profile || {},
        authOrError.currentUser,
      );
    } catch (error) {
      // A temporary retry failure must not destroy a valid Firebase identity or
      // force the user through Google chooser again. Keep local mode unless the
      // Firebase user itself disappeared.
      if (authOrError.currentUser) await setStoredAuthSessionState('local_limited_mode');
      else await setStoredAuthSessionState('session_expired');
      return firebaseError(error, 'BACKEND_SESSION_RETRY_FAILED') as ServiceResult<SessionInfo>;
    }
  },
};
