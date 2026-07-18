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

function hasAdminCredentials(env: ApiEnv) {
  return Boolean(
    env.firebaseApplicationCredentials ||
      env.firebaseServiceAccountJson ||
      (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey),
  );
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

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.firebaseWebApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
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
      const parsed = JSON.parse(env.firebaseServiceAccountJson);
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

export async function verifyFirebaseIdToken(env: ApiEnv, idToken: string): Promise<FirebaseDecodedToken> {
  if (!idToken) throw new FirebaseAdminNotConfiguredError('Firebase ID token is required.');
  if (!hasAdminCredentials(env)) {
    if (env.appEnv === 'production') {
      throw new FirebaseAdminNotConfiguredError('Firebase Admin credentials are missing.');
    }
    return verifyFirebaseIdTokenViaRest(env, idToken);
  }
  if (!cachedAuth) {
    const existing = getApps()[0];
    const credential = env.firebaseApplicationCredentials
      ? applicationDefault()
      : cert(serviceAccountFromEnv(env) as any);
    const app = existing || initializeApp({ credential, projectId: env.firebaseProjectId || undefined });
    cachedAuth = getAuth(app);
  }
  return cachedAuth.verifyIdToken(idToken, true) as Promise<FirebaseDecodedToken>;
}
