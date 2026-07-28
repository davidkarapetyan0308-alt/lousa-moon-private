import { AUTH_SESSION_STORAGE_KEYS } from '../src/features/auth/session/sessionState';
import fs from 'node:fs';
import path from 'node:path';

describe('Firebase/backend session boundary', () => {
  test('keeps the legacy pending token key only for cleanup', () => {
    expect(AUTH_SESSION_STORAGE_KEYS.pendingFirebaseIdToken).not.toBe('accessToken');
  });

  test('never writes Firebase id token to backend accessToken in fallback path', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/services/firebase/firebaseAuth.ts'), 'utf8');
    expect(source).not.toContain("secureStorage.set('accessToken', idToken)");
    expect(source).not.toContain('pendingFirebaseIdToken, input.idToken');
    expect(source).toContain('createFirebaseLimitedSession');
    expect(source).toContain("backendSessionReady: false");
  });

  test('protected API calls reject limited session locally', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/services/api/index.ts'), 'utf8');
    expect(source).toContain("code: 'BACKEND_SESSION_PENDING'");
    expect(source).toContain("sessionState === 'local_limited_mode'");
  });
});
