import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { ApiEnv } from '../config/env';

type FirebaseDecodedToken = {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
  picture?: string;
  firebase?: { sign_in_provider?: string };
};

export class FirebaseAdminNotConfiguredError extends Error {
  code = 'FIREBASE_ADMIN_NOT_CONFIGURED';
}

let cachedAuth: any | null = null;

export function hasFirebaseAdminCredentials(env: ApiEnv) {
  return Boolean(
    env.firebaseApplicationCredentials ||
      env.firebaseServiceAccountJson ||
      (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey),
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function verifyFirebaseIdTokenViaRest(
  env: ApiEnv,
  idToken: string,
): Promise<FirebaseDecodedToken> {
  if (!env.firebaseWebApiKey || !env.firebaseProjectId) {
    throw new FirebaseAdminNotConfiguredError(
      'Firebase REST token verification requires FIREBASE_WEB_API_KEY and FIREBASE_PROJECT_ID.',
    );
  }

  const response = await fetchWithTimeout(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.firebaseWebApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
    8_000,
  );
  const payload = (await response.json().catch(() => null)) as any;
  const user = payload?.users?.[0];
  if (!response.ok || !user?.localId) {
    const error = new Error(payload?.error?.message || 'Firebase REST token verification failed.');
    (error as Error & { code?: string }).code = 'FIREBASE_ID_TOKEN_INVALID';
    throw error;
  }

  const provider = user.providerUserInfo?.[0]?.providerId || 'password';
  return {
    uid: String(user.localId),
    email: user.email || undefined,
    email_verified: Boolean(user.emailVerified),
    phone_number: user.phoneNumber || undefined,
    name: user.displayName || undefined,
    picture: user.photoUrl || undefined,
    firebase: { sign_in_provider: provider },
  };
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n');
}

function serviceAccountFromEnv(env: ApiEnv) {
  if (env.firebaseServiceAccountJson) {
    try {
      // Render secrets are sometimes pasted as a JSON-encoded string, which
      // produces one extra quoting layer. Accept both raw JSON and that form.
      const decoded = JSON.parse(env.firebaseServiceAccountJson);
      const parsed = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
      return {
        projectId: parsed.project_id || parsed.projectId || env.firebaseProjectId || undefined,
        clientEmail: parsed.client_email || parsed.clientEmail,
        privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey || ''),
      };
    } catch {
      throw new FirebaseAdminNotConfiguredError('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }
  if (!env.firebaseProjectId || !env.firebaseClientEmail || !env.firebasePrivateKey) {
    throw new FirebaseAdminNotConfiguredError('Firebase Admin credentials are missing.');
  }
  return {
    projectId: env.firebaseProjectId,
    clientEmail: env.firebaseClientEmail,
    privateKey: normalizePrivateKey(env.firebasePrivateKey),
  };
}

function getFirebaseAuth(env: ApiEnv) {
  if (cachedAuth) return cachedAuth;
  if (!hasFirebaseAdminCredentials(env)) {
    throw new FirebaseAdminNotConfiguredError('Firebase Admin credentials are missing.');
  }
  const existing = getApps()[0];
  // Prefer the explicit Render secret over GOOGLE_APPLICATION_CREDENTIALS.
  // A stale file path in the latter must not shadow a valid service account
  // JSON configured for this service.
  const credential = env.firebaseServiceAccountJson || (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey)
    ? cert(serviceAccountFromEnv(env) as any)
    : applicationDefault();
  const app = existing || initializeApp({ credential, projectId: env.firebaseProjectId || undefined });
  cachedAuth = getAuth(app);
  return cachedAuth;
}

export async function checkFirebaseVerifierReady(env: ApiEnv) {
  if (hasFirebaseAdminCredentials(env)) {
    getFirebaseAuth(env);
    return { mode: 'admin' as const, projectId: env.firebaseProjectId };
  }
  if (env.allowFirebaseRestFallback && env.firebaseWebApiKey && env.firebaseProjectId) {
    return { mode: 'rest' as const, projectId: env.firebaseProjectId };
  }
  throw new FirebaseAdminNotConfiguredError('Firebase Admin credentials are required for this environment.');
}

export async function verifyFirebaseIdToken(env: ApiEnv, idToken: string): Promise<FirebaseDecodedToken> {
  if (!idToken) throw new FirebaseAdminNotConfiguredError('Firebase ID token is required.');
  if (!hasFirebaseAdminCredentials(env)) {
    if (env.allowFirebaseRestFallback) return verifyFirebaseIdTokenViaRest(env, idToken);
    throw new FirebaseAdminNotConfiguredError('Firebase Admin credentials are required.');
  }
  try {
    // Signature/audience/expiry validation. Revocation checks are intentionally
    // omitted from the login hot path to avoid an additional network lookup.
    return getFirebaseAuth(env).verifyIdToken(idToken, false) as Promise<FirebaseDecodedToken>;
  } catch (error) {
    if (env.allowFirebaseRestFallback && env.firebaseWebApiKey && env.firebaseProjectId) {
      console.warn('[firebase-auth] Admin verification failed; using explicitly enabled REST fallback.');
      return verifyFirebaseIdTokenViaRest(env, idToken);
    }
    throw error;
  }
}
