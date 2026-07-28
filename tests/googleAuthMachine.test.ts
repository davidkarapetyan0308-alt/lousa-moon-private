jest.mock('../src/services/nativeGoogleSignIn', () => ({
  signInWithNativeGoogle: jest.fn(),
}));
jest.mock('../src/features/auth/diagnostics/authTrace', () => ({
  createAuthAttemptId: () => 'attempt-1',
  finishAuthTrace: jest.fn(),
  traceAuth: jest.fn(),
}));

import { runGoogleAuthMachine } from '../src/features/auth/google/googleAuthMachine';
import { signInWithNativeGoogle } from '../src/services/nativeGoogleSignIn';
import type { AuthService } from '../src/services/contracts';

const nativeGoogleMock = signInWithNativeGoogle as jest.MockedFunction<typeof signInWithNativeGoogle>;

function authService(signInWithGoogle: AuthService['signInWithGoogle']): AuthService {
  return {
    signInWithGoogle,
    signIn: jest.fn(),
    signOut: jest.fn(),
  } as AuthService;
}

describe('Google auth state machine', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts local limited mode without reopening Google', async () => {
    nativeGoogleMock.mockResolvedValue({ ok: true, idToken: 'google-id-token' });
    const signInWithGoogle = jest.fn().mockResolvedValue({
      ok: true,
      data: {
        userId: 'firebase-user',
        sessionId: 'firebase:firebase-user',
        demo: false,
        sessionState: 'local_limited_mode',
        backendSessionReady: false,
      },
    });

    await expect(runGoogleAuthMachine(authService(signInWithGoogle))).resolves.toMatchObject({
      state: 'LIMITED_MODE',
      result: { ok: true },
    });
    expect(nativeGoogleMock).toHaveBeenCalledTimes(1);
    expect(signInWithGoogle).toHaveBeenCalledWith('google-id-token', { attemptId: 'attempt-1' });
  });

  it('blocks a parallel second attempt', async () => {
    let release!: () => void;
    nativeGoogleMock.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ ok: false, code: 'GOOGLE_CANCELLED' });
    }));
    const auth = authService(jest.fn());
    const first = runGoogleAuthMachine(auth);
    await Promise.resolve();
    await expect(runGoogleAuthMachine(auth)).resolves.toMatchObject({ state: 'FAILED', nativeErrorCode: 'GOOGLE_IN_PROGRESS' });
    release();
    await first;
  });
});
