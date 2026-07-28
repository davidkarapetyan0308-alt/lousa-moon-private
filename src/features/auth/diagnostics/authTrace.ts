export type AuthTraceEvent =
  | 'GOOGLE_BUTTON_PRESSED'
  | 'GOOGLE_SERVICES_CHECK_STARTED'
  | 'GOOGLE_SERVICES_AVAILABLE'
  | 'GOOGLE_SERVICES_UNAVAILABLE'
  | 'GOOGLE_CONFIGURE_COMPLETED'
  | 'GOOGLE_SIGN_IN_STARTED'
  | 'GOOGLE_ACCOUNT_SELECTED'
  | 'GOOGLE_SIGN_IN_CANCELLED'
  | 'GOOGLE_SIGN_IN_FAILED'
  | 'GOOGLE_ID_TOKEN_RECEIVED'
  | 'GOOGLE_ID_TOKEN_MISSING'
  | 'FIREBASE_CREDENTIAL_STARTED'
  | 'FIREBASE_CREDENTIAL_SUCCEEDED'
  | 'FIREBASE_CREDENTIAL_FAILED'
  | 'FIREBASE_ID_TOKEN_STARTED'
  | 'FIREBASE_ID_TOKEN_RECEIVED'
  | 'FIREBASE_ID_TOKEN_FAILED'
  | 'BACKEND_READINESS_STARTED'
  | 'BACKEND_READINESS_SUCCEEDED'
  | 'BACKEND_READINESS_FAILED'
  | 'BACKEND_SESSION_STARTED'
  | 'BACKEND_SESSION_RETRY'
  | 'BACKEND_SESSION_SUCCEEDED'
  | 'BACKEND_SESSION_TIMEOUT'
  | 'BACKEND_SESSION_REJECTED'
  | 'BACKEND_SESSION_NETWORK_ERROR'
  | 'LOCAL_LIMITED_MODE_ENTERED'
  | 'LOCAL_SESSION_SAVE_STARTED'
  | 'LOCAL_SESSION_SAVE_SUCCEEDED'
  | 'LOCAL_SESSION_SAVE_FAILED'
  | 'AUTH_NAVIGATION_STARTED'
  | 'AUTH_NAVIGATION_SUCCEEDED'
  | 'AUTH_COMPLETED'
  | 'AUTH_FAILED';

export type AuthTraceRecord = {
  attemptId: string;
  event: AuthTraceEvent;
  elapsedMs: number;
  at: string;
  details?: Record<string, unknown>;
};

const startTimes = new Map<string, number>();
const records: AuthTraceRecord[] = [];

function nowMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

export function createAuthAttemptId() {
  return `auth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitize(details?: Record<string, unknown>) {
  if (!details) return undefined;
  const forbidden = /token|password|secret|authorization|credential/i;
  return Object.fromEntries(
    Object.entries(details)
      .filter(([key]) => !forbidden.test(key))
      .map(([key, value]) => [key, typeof value === 'string' && value.length > 240 ? `${value.slice(0, 240)}…` : value]),
  );
}

export function traceAuth(
  attemptId: string,
  event: AuthTraceEvent,
  details?: Record<string, unknown>,
) {
  if (!startTimes.has(attemptId)) startTimes.set(attemptId, nowMs());
  const elapsedMs = Math.max(0, nowMs() - (startTimes.get(attemptId) || nowMs()));
  const record: AuthTraceRecord = {
    attemptId,
    event,
    elapsedMs: Math.round(elapsedMs * 10) / 10,
    at: new Date().toISOString(),
    details: sanitize(details),
  };
  records.push(record);
  if (records.length > 250) records.shift();
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.info(`[AUTH attempt=${attemptId} +${record.elapsedMs}ms] ${event}`, record.details || '');
  return record;
}

export function getAuthTrace(attemptId?: string) {
  return records.filter((record) => !attemptId || record.attemptId === attemptId);
}

export function finishAuthTrace(attemptId: string) {
  startTimes.delete(attemptId);
}
