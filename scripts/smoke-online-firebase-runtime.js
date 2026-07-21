#!/usr/bin/env node
const apiUrl = String(
  process.env.EXPO_PUBLIC_LOUSA_API_URL ||
    process.env.PUBLIC_API_URL ||
    '',
).replace(/\/+$/, '');

function fail(message, details = []) {
  console.error('smoke:online-firebase-runtime FAILED');
  console.error(`- ${message}`);
  details.forEach((detail) => console.error(`- ${detail}`));
  process.exit(1);
}

function warn(message, details = []) {
  console.warn('smoke:online-firebase-runtime WARNING');
  console.warn(`- ${message}`);
  details.forEach((detail) => console.warn(`- ${detail}`));
}

async function main() {
  if (!apiUrl) fail('EXPO_PUBLIC_LOUSA_API_URL or PUBLIC_API_URL is missing.');
  if (!apiUrl.startsWith('https://')) fail('Online APK must use an HTTPS backend.', [`API URL: ${apiUrl}`]);

  const healthResponse = await fetch(`${apiUrl}/health`, { headers: { Accept: 'application/json' } });
  const health = await healthResponse.json().catch(() => null);
  if (!healthResponse.ok || !health?.ok) {
    fail('Backend /health is not OK.', [`HTTP ${healthResponse.status}`, JSON.stringify(health)]);
  }
  if (!health.databaseConfigured) fail('Backend has no database configured.');
  if (health.databaseAuthSchemaConfigured !== true) {
    warn('Backend auth database schema is not migrated; APK will use Firebase fallback session until Render deploys the fixed API.', [
      'Expected /health.databaseAuthSchemaConfigured to be true for full LOUSA backend sessions.',
      JSON.stringify(health),
    ]);
  }
  if (!health.firebaseProjectConfigured) fail('Backend has no Firebase project configured.');
  if (!health.firebaseAdminConfigured && !health.firebaseRestConfigured) {
    fail('Backend cannot verify Firebase tokens.', [
      'Expected firebaseAdminConfigured or firebaseRestConfigured to be true.',
      JSON.stringify(health),
    ]);
  }

  const authResponse = await fetch(`${apiUrl}/v1/auth/firebase/session`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const authPayload = await authResponse.json().catch(() => null);
  const code = authPayload?.error?.code;
  if (authResponse.status !== 400 || code !== 'FIREBASE_ID_TOKEN_REQUIRED') {
    fail('Firebase session endpoint is not returning the expected contract for missing token.', [
      `HTTP ${authResponse.status}`,
      JSON.stringify(authPayload),
    ]);
  }

  console.log('smoke:online-firebase-runtime PASS');
  console.log(`API URL: ${apiUrl}`);
  console.log(`Firebase Admin: ${Boolean(health.firebaseAdminConfigured)}`);
  console.log(`Firebase REST: ${Boolean(health.firebaseRestConfigured)}`);
  console.log(`Auth DB schema: ${Boolean(health.databaseAuthSchemaConfigured)}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Unknown smoke test error.');
});
