import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { traceAuth } from '../features/auth/diagnostics/authTrace';
import { withTimeout } from '../shared/network/withTimeout';

const GOOGLE_WEB_CLIENT_ID = String(
  Constants.expoConfig?.extra?.firebaseWebClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '',
).trim();

function isGoogleClientConfigured() {
  return Boolean(GOOGLE_WEB_CLIENT_ID && GOOGLE_WEB_CLIENT_ID.endsWith('.apps.googleusercontent.com'));
}

let configured = false;
let googleModule: any | null = null;

export type NativeGoogleSignInResult =
  | { ok: true; idToken: string }
  | {
      ok: false;
      code:
        | 'GOOGLE_CANCELLED'
        | 'GOOGLE_IN_PROGRESS'
        | 'GOOGLE_PLAY_SERVICES_UNAVAILABLE'
        | 'GOOGLE_DEVELOPER_ERROR'
        | 'GOOGLE_TOKEN_MISSING'
        | 'GOOGLE_UNSUPPORTED_PLATFORM'
        | 'GOOGLE_NATIVE_MODULE_UNAVAILABLE'
        | 'GOOGLE_AUTH_NOT_CONFIGURED'
        | 'GOOGLE_SIGN_IN_FAILED';
      technicalMessage?: string;
    };

function loadGoogleModule() {
  if (googleModule) return googleModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    googleModule = require('@react-native-google-signin/google-signin');
    return googleModule;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Google native module is unavailable.');
  }
}

function ensureConfigured(attemptId?: string) {
  const { GoogleSignin } = loadGoogleModule();
  if (configured) return;
  if (!isGoogleClientConfigured()) throw new Error('GOOGLE_AUTH_NOT_CONFIGURED');
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    scopes: ['email', 'profile'],
  });
  configured = true;
  if (attemptId) traceAuth(attemptId, 'GOOGLE_CONFIGURE_COMPLETED', { webClientConfigured: true });
}

export async function signInWithNativeGoogle(attemptId = 'google-auth'): Promise<NativeGoogleSignInResult> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return { ok: false, code: 'GOOGLE_UNSUPPORTED_PLATFORM' };
  }

  let module: any;
  try {
    module = loadGoogleModule();
    ensureConfigured(attemptId);
  } catch (error) {
    return {
      ok: false,
      code: error instanceof Error && error.message === 'GOOGLE_AUTH_NOT_CONFIGURED'
        ? 'GOOGLE_AUTH_NOT_CONFIGURED'
        : 'GOOGLE_NATIVE_MODULE_UNAVAILABLE',
      technicalMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const { GoogleSignin, isCancelledResponse, isErrorWithCode, isSuccessResponse, statusCodes } = module;

  try {
    traceAuth(attemptId, 'GOOGLE_SERVICES_CHECK_STARTED');
    await withTimeout(
      () => GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }),
      { timeoutMs: 10_000, stage: 'GOOGLE_PLAY_SERVICES_CHECK' },
    );
    traceAuth(attemptId, 'GOOGLE_SERVICES_AVAILABLE');

    // Do not sign out before every attempt. It destroys a valid provider session,
    // adds latency, and forces the user to repeat account selection after a backend retry.
    traceAuth(attemptId, 'GOOGLE_SIGN_IN_STARTED');
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return { ok: false, code: 'GOOGLE_CANCELLED' };
    if (!isSuccessResponse(response)) return { ok: false, code: 'GOOGLE_SIGN_IN_FAILED' };
    traceAuth(attemptId, 'GOOGLE_ACCOUNT_SELECTED');

    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await withTimeout<{ idToken?: string | null }>(
        () => GoogleSignin.getTokens(),
        { timeoutMs: 8_000, stage: 'GOOGLE_GET_TOKENS' },
      ).catch(() => null);
      idToken = tokens?.idToken || null;
    }
    if (!idToken) {
      traceAuth(attemptId, 'GOOGLE_ID_TOKEN_MISSING');
      return { ok: false, code: 'GOOGLE_TOKEN_MISSING' };
    }
    traceAuth(attemptId, 'GOOGLE_ID_TOKEN_RECEIVED', { tokenPresent: true, tokenLength: idToken.length });
    return { ok: true, idToken };
  } catch (error) {
    if (isErrorWithCode(error)) {
      const googleError = error as { code?: string; message?: string };
      const message = typeof googleError.message === 'string' ? googleError.message : 'Google sign-in failed.';
      if (googleError.code === statusCodes.IN_PROGRESS) return { ok: false, code: 'GOOGLE_IN_PROGRESS', technicalMessage: message };
      if (googleError.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        traceAuth(attemptId, 'GOOGLE_SERVICES_UNAVAILABLE');
        return { ok: false, code: 'GOOGLE_PLAY_SERVICES_UNAVAILABLE', technicalMessage: message };
      }
      if (String(googleError.code).includes('10') || /developer_error/i.test(message)) {
        return { ok: false, code: 'GOOGLE_DEVELOPER_ERROR', technicalMessage: message };
      }
      return { ok: false, code: 'GOOGLE_SIGN_IN_FAILED', technicalMessage: message };
    }
    return { ok: false, code: 'GOOGLE_SIGN_IN_FAILED', technicalMessage: error instanceof Error ? error.message : String(error) };
  }
}

export async function signOutNativeGoogle() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    const { GoogleSignin } = loadGoogleModule();
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // LOUSA session cleanup must still succeed even if provider cleanup fails.
  }
}
