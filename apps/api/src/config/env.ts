export type AppEnv = 'development' | 'test' | 'staging' | 'production';

export interface ApiEnv {
  appEnv: AppEnv;
  port: number;
  apiHost: string;
  databaseUrl: string;
  redisUrl: string | null;
  requireRedis: boolean;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  corsOrigins: string[];
  emailProvider: string;
  emailFrom: string;
  smsProvider: string;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioFrom: string | null;
  messagebirdApiKey: string | null;
  messagebirdOriginator: string | null;
  googleWebClientId: string;
  googleAndroidClientId: string;
  googleMapsServerApiKey: string;
  mapTilerApiKey: string;
  authProvider: string;
  firebaseProjectId: string | null;
  firebaseWebApiKey: string | null;
  firebaseClientEmail: string | null;
  firebasePrivateKey: string | null;
  firebaseServiceAccountJson: string | null;
  firebaseApplicationCredentials: string | null;
  allowFirebaseRestFallback: boolean;
  paymentProvider: string;
  paymentSecretKey: string | null;
  paymentWebhookSecret: string | null;
  publicApiUrl: string | null;
  verificationCodeTtlMinutes: number;
  deliveryZoneRadiusKm: number;
  deliveryZoneBaseFeeMinor: number;
}

function raw(name: string) {
  return process.env[name]?.trim() || '';
}

function requireVar(name: string, env: AppEnv) {
  const value = raw(name);
  if (!value && env === 'production') throw new Error(`Missing required production env var: ${name}`);
  return value;
}

function parseOrigins(value: string) {
  if (!value) return ['*'];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function resolvePublicApiUrl(explicitUrl: string, renderHostname: string) {
  return explicitUrl || (renderHostname ? `https://${renderHostname}` : null);
}

function assertNotPlaceholder(name: string, value: string, env: AppEnv) {
  if (env !== 'production') return;
  if (!value || /CHANGE_ME|placeholder|demo|test_secret|localhost/i.test(value)) {
    throw new Error(`Unsafe production env var: ${name}`);
  }
}

export function loadApiEnv(): ApiEnv {
  const appEnv = (raw('APP_ENV') || raw('NODE_ENV') || 'development') as AppEnv;
  if (!['development', 'test', 'staging', 'production'].includes(appEnv)) {
    throw new Error(`Invalid APP_ENV: ${appEnv}`);
  }

  const apiHost = raw('API_HOST') || '0.0.0.0';
  const databaseUrl = requireVar('DATABASE_URL', appEnv) || 'postgresql://lousa:lousa@localhost:5432/lousa_moon?schema=public';
  const redisUrl = raw('REDIS_URL') || null;
  const requireRedis = appEnv === 'production' || raw('REQUIRE_REDIS') === 'true';
  if (requireRedis && !redisUrl) throw new Error('REDIS_URL is required when APP_ENV=production or REQUIRE_REDIS=true.');

  const jwtAccessSecret = requireVar('JWT_ACCESS_SECRET', appEnv) || 'dev_access_secret_change_me';
  const jwtRefreshSecret = requireVar('JWT_REFRESH_SECRET', appEnv) || 'dev_refresh_secret_change_me';
  const emailProvider = raw('EMAIL_PROVIDER') || 'console';
  const emailFrom = requireVar('EMAIL_FROM', appEnv) || 'LOUSA MOON <onboarding@resend.dev>';
  const smsProvider = raw('SMS_PROVIDER') || 'console';
  const twilioAccountSid = raw('TWILIO_ACCOUNT_SID') || null;
  const twilioAuthToken = raw('TWILIO_AUTH_TOKEN') || null;
  const twilioFrom = raw('TWILIO_FROM') || null;
  const messagebirdApiKey = raw('MESSAGEBIRD_API_KEY') || null;
  const messagebirdOriginator = raw('MESSAGEBIRD_ORIGINATOR') || null;
  const googleWebClientId = raw('GOOGLE_WEB_CLIENT_ID') || raw('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  const googleAndroidClientId = raw('GOOGLE_ANDROID_CLIENT_ID') || raw('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
  const googleMapsServerApiKey = raw('GOOGLE_MAPS_SERVER_API_KEY') || raw('GOOGLE_PLACES_SERVER_API_KEY') || raw('GOOGLE_GEOCODING_SERVER_API_KEY');
  const authProvider = raw('AUTH_PROVIDER') || raw('EXPO_PUBLIC_AUTH_PROVIDER') || 'firebase';
  const firebaseProjectId = raw('FIREBASE_PROJECT_ID') || raw('EXPO_PUBLIC_FIREBASE_PROJECT_ID') || null;
  const firebaseWebApiKey = raw('FIREBASE_WEB_API_KEY') || raw('EXPO_PUBLIC_FIREBASE_API_KEY') || null;
  const firebaseClientEmail = raw('FIREBASE_CLIENT_EMAIL') || null;
  const firebasePrivateKey = raw('FIREBASE_PRIVATE_KEY') || null;
  const firebaseServiceAccountJson = raw('FIREBASE_SERVICE_ACCOUNT_JSON') || null;
  const firebaseApplicationCredentials = raw('GOOGLE_APPLICATION_CREDENTIALS') || null;
  // QA/staging must remain usable while Admin credentials are being rotated;
  // production still requires the Admin SDK and never enables this fallback.
  const allowFirebaseRestFallback = Boolean(
    raw('ALLOW_FIREBASE_REST_FALLBACK') === 'true' && (appEnv === 'development' || appEnv === 'test') ||
    appEnv === 'staging' && raw('FIREBASE_WEB_API_KEY'),
  );
  const mapTilerApiKey = raw('MAPTILER_API_KEY') || raw('EXPO_PUBLIC_MAPTILER_API_KEY');
  const paymentProvider = raw('PAYMENT_PROVIDER') || 'sandbox';
  const paymentSecretKey = raw('PAYMENT_SECRET_KEY') || null;
  const paymentWebhookSecret = raw('PAYMENT_WEBHOOK_SECRET') || null;
  const publicApiUrl = resolvePublicApiUrl(raw('PUBLIC_API_URL'), raw('RENDER_EXTERNAL_HOSTNAME'));

  assertNotPlaceholder('JWT_ACCESS_SECRET', jwtAccessSecret, appEnv);
  assertNotPlaceholder('JWT_REFRESH_SECRET', jwtRefreshSecret, appEnv);
  assertNotPlaceholder('DATABASE_URL', databaseUrl, appEnv);
  if (appEnv === 'staging' || appEnv === 'production') {
    if (!raw('DATABASE_URL')) throw new Error('DATABASE_URL is required in staging/production.');
    if (!raw('JWT_ACCESS_SECRET')) throw new Error('JWT_ACCESS_SECRET is required in staging/production.');
    if (!raw('JWT_REFRESH_SECRET')) throw new Error('JWT_REFRESH_SECRET is required in staging/production.');
    if (!publicApiUrl) throw new Error('PUBLIC_API_URL is required in staging/production.');
    if (authProvider === 'firebase') {
      if (!firebaseProjectId) throw new Error('FIREBASE_PROJECT_ID is required when AUTH_PROVIDER=firebase.');
      if (!firebaseServiceAccountJson && !firebaseApplicationCredentials && !(firebaseClientEmail && firebasePrivateKey)) {
        throw new Error('Firebase Admin credentials are required in staging/production.');
      }
    }
  }
  if (appEnv === 'production') {
    if (!publicApiUrl) throw new Error('PUBLIC_API_URL is required in production.');
    if (paymentProvider === 'sandbox') throw new Error('PAYMENT_PROVIDER=sandbox is forbidden in production. Configure a real provider adapter.');
    if (!paymentSecretKey) throw new Error('PAYMENT_SECRET_KEY is required for production payments.');
    if (!paymentWebhookSecret) throw new Error('PAYMENT_WEBHOOK_SECRET is required for production payments.');
    if (authProvider === 'firebase') {
      if (!firebaseProjectId) throw new Error('FIREBASE_PROJECT_ID is required when AUTH_PROVIDER=firebase.');
      if (
        !firebaseWebApiKey &&
        !firebaseServiceAccountJson &&
        !firebaseApplicationCredentials &&
        !(firebaseClientEmail && firebasePrivateKey)
      ) {
        throw new Error('FIREBASE_WEB_API_KEY or Firebase Admin credentials are required when AUTH_PROVIDER=firebase.');
      }
    } else {
      throw new Error('AUTH_PROVIDER=legacy is forbidden in production. Use Firebase Auth.');
    }
  }

  return {
    appEnv,
    port: Number(raw('PORT') || 4100),
    apiHost,
    databaseUrl,
    redisUrl,
    requireRedis,
    jwtAccessSecret,
    jwtRefreshSecret,
    corsOrigins: parseOrigins(raw('CORS_ORIGINS')),
    emailProvider,
    emailFrom,
    smsProvider,
    twilioAccountSid,
    twilioAuthToken,
    twilioFrom,
    messagebirdApiKey,
    messagebirdOriginator,
    googleWebClientId,
    googleAndroidClientId,
    googleMapsServerApiKey,
    mapTilerApiKey,
    authProvider,
    firebaseProjectId,
    firebaseWebApiKey,
    firebaseClientEmail,
    firebasePrivateKey,
    firebaseServiceAccountJson,
    firebaseApplicationCredentials,
    allowFirebaseRestFallback,
    paymentProvider,
    paymentSecretKey,
    paymentWebhookSecret,
    publicApiUrl,
    verificationCodeTtlMinutes: Number(raw('VERIFICATION_CODE_TTL_MINUTES') || 10),
    deliveryZoneRadiusKm: Number(raw('DELIVERY_ZONE_RADIUS_KM') || 15),
    deliveryZoneBaseFeeMinor: Number(raw('DELIVERY_ZONE_BASE_FEE_MINOR') || 0),
  };
}
