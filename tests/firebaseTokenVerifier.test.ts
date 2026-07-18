import { verifyFirebaseIdToken } from '../apps/api/src/auth/firebaseAdmin';
import type { ApiEnv } from '../apps/api/src/config/env';

const env = {
  appEnv: 'development',
  firebaseProjectId: 'lousa-moon',
  firebaseWebApiKey: 'public-test-key',
  firebaseApplicationCredentials: null,
  firebaseServiceAccountJson: null,
  firebaseClientEmail: null,
  firebasePrivateKey: null,
} as ApiEnv;

describe('Firebase token verifier', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the Firebase account lookup endpoint for local QA without Admin credentials', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [{
          localId: 'firebase-user-1',
          email: 'user@example.com',
          emailVerified: true,
          displayName: 'LOUSA User',
          providerUserInfo: [{ providerId: 'google.com' }],
        }],
      }),
    } as Response);

    await expect(verifyFirebaseIdToken(env, 'valid-id-token')).resolves.toMatchObject({
      uid: 'firebase-user-1',
      email: 'user@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=public-test-key',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects an invalid Firebase token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'INVALID_ID_TOKEN' } }),
    } as Response);

    await expect(verifyFirebaseIdToken(env, 'invalid-id-token')).rejects.toMatchObject({
      code: 'FIREBASE_ID_TOKEN_INVALID',
    });
  });
});
