#!/usr/bin/env node
const apiUrl = String(process.env.EXPO_PUBLIC_LOUSA_API_URL || process.env.PUBLIC_API_URL || '').replace(/\/+$/, '');

function fail(message, details = []) {
  console.error('smoke:online-firebase-runtime FAILED');
  console.error(`- ${message}`);
  details.forEach((detail) => console.error(`- ${detail}`));
  process.exit(1);
}

async function request(path, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiUrl}${path}`, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (!apiUrl) fail('EXPO_PUBLIC_LOUSA_API_URL or PUBLIC_API_URL is missing.');
  if (!apiUrl.startsWith('https://')) fail('Online APK must use an HTTPS backend.', [`API URL: ${apiUrl}`]);

  const health = await request('/health');
  if (!health.response.ok || health.payload?.status !== 'ok') {
    fail('Backend /health is not OK.', [`HTTP ${health.response.status}`, JSON.stringify(health.payload)]);
  }

  const ready = await request('/ready', {}, 30_000);
  if (!ready.response.ok || ready.payload?.status !== 'ready') {
    fail('Backend /ready is not ready for Firebase sessions.', [
      `HTTP ${ready.response.status}`,
      JSON.stringify(ready.payload),
    ]);
  }
  if (ready.payload?.checks?.database !== 'ok') fail('Backend database readiness failed.');
  if (ready.payload?.checks?.authSchema !== 'ok') fail('Backend auth schema is not migrated.');
  if (!['admin', 'rest'].includes(ready.payload?.checks?.firebaseAdmin)) fail('Firebase verifier is unavailable.');

  const auth = await request('/v1/auth/firebase/session', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const code = auth.payload?.error?.code;
  if (auth.response.status !== 401 || code !== 'FIREBASE_ID_TOKEN_REQUIRED') {
    fail('Firebase session endpoint is not returning the expected missing-token contract.', [
      `HTTP ${auth.response.status}`,
      JSON.stringify(auth.payload),
    ]);
  }

  console.log('smoke:online-firebase-runtime PASS');
  console.log(`API URL: ${apiUrl}`);
  console.log(`Firebase verifier: ${ready.payload.checks.firebaseAdmin}`);
  console.log(`Auth DB schema: ${ready.payload.checks.authSchema}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : 'Unknown smoke test error.'));
