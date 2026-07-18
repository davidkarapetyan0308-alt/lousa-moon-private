import { Platform } from 'react-native';
import Constants from 'expo-constants';

const GOOGLE_WEB_CLIENT_ID = String(
  Constants.expoConfig?.extra?.firebaseWebClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '',
);

function isGoogleClientConfigured() {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
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
    // Lazy-load this native module only after the user presses the Google button.
    // If the APK was built with a stale native project or without the module, a
    // top-level import can crash during startup and leave Android on the splash.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    googleModule = require('@react-native-google-signin/google-signin');
    return googleModule;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Google native module is unavailable.');
  }
}

function ensureConfigured() {
  const { GoogleSignin } = loadGoogleModule();
  if (configured) return;
  if (!isGoogleClientConfigured()) {
    throw new Error('GOOGLE_AUTH_NOT_CONFIGURED');
  }
  GoogleSignin.configure({
    // Firebase requires the OAuth client with client_type=3 (Web client), not
    // the Android client ID. app.config.js reads it from google-services.json.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    scopes: ['email', 'profile'],
  });
  configured = true;
}

export async function signInWithNativeGoogle(): Promise<NativeGoogleSignInResult> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return { ok: false, code: 'GOOGLE_UNSUPPORTED_PLATFORM' };
  }

  let module: any;
  try {
    module = loadGoogleModule();
    ensureConfigured();
  } catch (error) {
    return {
      ok: false,
      code: error instanceof Error && error.message === 'GOOGLE_AUTH_NOT_CONFIGURED' ? 'GOOGLE_AUTH_NOT_CONFIGURED' : 'GOOGLE_NATIVE_MODULE_UNAVAILABLE',
      technicalMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const {
    GoogleSignin,
    isCancelledResponse,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
  } = module;

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Always detach the previously selected Google account before an explicit
    // button press. This makes Android show the real account chooser instead
    // of silently reusing the last account.
    await GoogleSignin.signOut().catch(() => null);

    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) {
      return { ok: false, code: 'GOOGLE_CANCELLED' };
    }
    if (!isSuccessResponse(response)) {
      return { ok: false, code: 'GOOGLE_SIGN_IN_FAILED' };
    }

    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens().catch(() => null);
      idToken = tokens?.idToken || null;
    }

    if (!idToken) {
      return { ok: false, code: 'GOOGLE_TOKEN_MISSING' };
    }

    return { ok: true, idToken };
  } catch (error) {
    if (isErrorWithCode(error)) {
      const googleError = error as { code?: string; message?: string };
      const message = typeof googleError.message === 'string' ? googleError.message : 'Google sign-in failed.';
      if (googleError.code === statusCodes.IN_PROGRESS) {
        return { ok: false, code: 'GOOGLE_IN_PROGRESS', technicalMessage: message };
      }
      if (googleError.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          ok: false,
          code: 'GOOGLE_PLAY_SERVICES_UNAVAILABLE',
          technicalMessage: message,
        };
      }
      return { ok: false, code: 'GOOGLE_SIGN_IN_FAILED', technicalMessage: message };
    }
    return {
      ok: false,
      code: 'GOOGLE_SIGN_IN_FAILED',
      technicalMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function signOutNativeGoogle() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    const { GoogleSignin } = loadGoogleModule();
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // LOUSA session cleanup must still succeed even if Google provider cleanup fails.
  }
}
