import type { AuthService, ServiceResult, SessionInfo } from '../../../services/contracts';
import { signInWithNativeGoogle } from '../../../services/nativeGoogleSignIn';
import { createAuthAttemptId, finishAuthTrace, traceAuth } from '../diagnostics/authTrace';

export type GoogleAuthMachineState =
  | 'IDLE'
  | 'CHECKING_PLAY_SERVICES'
  | 'OPENING_GOOGLE'
  | 'GOOGLE_AUTHENTICATED'
  | 'FIREBASE_AUTHENTICATING'
  | 'CREATING_SERVER_SESSION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'LIMITED_MODE'
  | 'FAILED';

export type GoogleAuthMachineResult = {
  attemptId: string;
  state: GoogleAuthMachineState;
  result?: ServiceResult<SessionInfo>;
  nativeErrorCode?: string;
  technicalMessage?: string;
};

let attemptInProgress = false;

export async function runGoogleAuthMachine(auth: AuthService): Promise<GoogleAuthMachineResult> {
  const attemptId = createAuthAttemptId();
  if (attemptInProgress) {
    return { attemptId, state: 'FAILED', nativeErrorCode: 'GOOGLE_IN_PROGRESS' };
  }
  attemptInProgress = true;
  traceAuth(attemptId, 'GOOGLE_BUTTON_PRESSED');

  try {
    const nativeResult = await signInWithNativeGoogle(attemptId);
    if (!nativeResult.ok) {
      const cancelled = nativeResult.code === 'GOOGLE_CANCELLED';
      traceAuth(attemptId, cancelled ? 'GOOGLE_SIGN_IN_CANCELLED' : 'GOOGLE_SIGN_IN_FAILED', {
        code: nativeResult.code,
      });
      return {
        attemptId,
        state: cancelled ? 'CANCELLED' : 'FAILED',
        nativeErrorCode: nativeResult.code,
        technicalMessage: nativeResult.technicalMessage,
      };
    }

    traceAuth(attemptId, 'FIREBASE_CREDENTIAL_STARTED');
    const result = await auth.signInWithGoogle?.(nativeResult.idToken, { attemptId });
    if (!result) return { attemptId, state: 'FAILED', nativeErrorCode: 'GOOGLE_AUTH_SERVICE_MISSING' };
    if (!result.ok) {
      traceAuth(attemptId, 'AUTH_FAILED', { code: result.error.code });
      return { attemptId, state: 'FAILED', result };
    }
    const limited = result.data.sessionState === 'local_limited_mode' || result.data.backendSessionReady === false;
    traceAuth(attemptId, limited ? 'LOCAL_LIMITED_MODE_ENTERED' : 'AUTH_COMPLETED');
    return { attemptId, state: limited ? 'LIMITED_MODE' : 'COMPLETED', result };
  } finally {
    attemptInProgress = false;
    finishAuthTrace(attemptId);
  }
}
