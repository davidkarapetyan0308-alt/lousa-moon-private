import type { AuthService, ServiceResult, SessionInfo } from '../contracts';
import { getUserFacingErrorMessage } from '../errorMessages';
import { assertApiEnvironmentReady } from '../apiEnvironment';
import { AUTH_TOKEN_KEYS, secureStorage } from '../security/secureStorage';

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(code: string, message: string, recoverable = false, details?: Record<string, unknown>): ServiceResult<T> => ({
  ok: false,
  error: { code, message: getUserFacingErrorMessage({ code, message }, message), recoverable, details },
});

type NativeFirebaseAuth = any;
type PhoneConfirmation = { confirm(code: string): Promise<{ user?: { getIdToken(forceRefresh?: boolean): Promise<string> } }> };

const phoneConfirmations = new Map<string, PhoneConfirmation>();

const FIREBASE_AUTH_ACTION_URL = (process.env.EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL || '').trim();

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

async function request<T>(path: string, body: Record<string, unknown>): Promise<ServiceResult<T>> {
  try {
    const apiUrl = assertApiEnvironmentReady();
    const token = await secureStorage.get('accessToken');
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const code = payload?.error?.code || `HTTP_${response.status}`;
      const message = payload?.error?.message || 'Firebase session exchange failed.';
      return fail(code, message, response.status >= 500, payload?.error?.details);
    }
    return ok(payload as T);
  } catch (error) {
    const code = error instanceof Error ? (error as Error & { code?: string }).code || 'NETWORK_ERROR' : 'NETWORK_ERROR';
    return fail(code, error instanceof Error ? error.message : 'Request failed.', true);
  }
}

async function exchangeFirebaseIdToken(idToken: string, provider: string, profile: Record<string, unknown> = {}): Promise<ServiceResult<SessionInfo>> {
  const result = await request<{
    user: { id: string; email?: string; phone?: string; name?: string; avatarUri?: string | null };
    accessToken: string;
    refreshToken: string;
    demo?: boolean;
    isNewUser?: boolean;
  }>('/v1/auth/firebase/session', { idToken, provider, profile });
  if (!result.ok) return result;
  await secureStorage.set('accessToken', result.data.accessToken);
  await secureStorage.set('refreshToken', result.data.refreshToken);
  await secureStorage.set('sessionId', result.data.user.id);
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
  });
}

async function tokenFromCurrentUser(auth: NativeFirebaseAuth, forceRefresh = true) {
  const user = auth.currentUser;
  if (!user) throw new Error('Firebase user is missing after sign-in.');
  return user.getIdToken(forceRefresh);
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
      });
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
      return exchangeFirebaseIdToken(idToken, 'firebase-password');
    } catch (error) {
      return firebaseError(error, 'FIREBASE_EMAIL_SIGNIN_FAILED') as ServiceResult<SessionInfo>;
    }
  },

  async signInWithGoogle(idToken) {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<SessionInfo>;
    try {
      const authPackage = getNativeFirebaseAuthPackage();
      if (!authPackage?.GoogleAuthProvider) {
        return fail('FIREBASE_GOOGLE_PROVIDER_MISSING', 'Firebase Google provider недоступен в этой сборке.');
      }
      const credential = authPackage.GoogleAuthProvider.credential(idToken);
      await authOrError.signInWithCredential(credential);
      const firebaseIdToken = await tokenFromCurrentUser(authOrError, true);
      return exchangeFirebaseIdToken(firebaseIdToken, 'firebase-google');
    } catch (error) {
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
      const idToken = await tokenFromCurrentUser(authOrError, true);
      phoneConfirmations.delete(input.phone);
      return exchangeFirebaseIdToken(idToken, 'firebase-phone');
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
    await secureStorage.clear([...AUTH_TOKEN_KEYS]);
    return ok(undefined);
  },

  async signOutAll() {
    const auth = getNativeFirebaseAuth();
    await auth?.signOut?.().catch(() => null);
    await secureStorage.clear([...AUTH_TOKEN_KEYS]);
    return ok(undefined);
  },

  async refreshSession() {
    const authOrError = requireFirebaseAuth();
    if ('ok' in authOrError) return authOrError as ServiceResult<SessionInfo>;
    try {
      const idToken = await tokenFromCurrentUser(authOrError, true);
      return exchangeFirebaseIdToken(idToken, 'firebase-refresh');
    } catch (error) {
      return firebaseError(error, 'FIREBASE_REFRESH_FAILED') as ServiceResult<SessionInfo>;
    }
  },
};
