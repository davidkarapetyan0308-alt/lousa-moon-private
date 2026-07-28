const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const nativeGoogle = read('src/services/nativeGoogleSignIn.ts');
const firebase = read('src/services/firebase/firebaseAuth.ts');
const login = read('app/auth/login.tsx');
const session = read('src/features/auth/session/sessionState.ts');
const server = read('apps/api/src/server.ts');
const firebaseAdmin = read('apps/api/src/auth/firebaseAdmin.ts');
const render = read('render.yaml');
const openapi = read('apps/api/openapi.yaml');
const machine = read('src/features/auth/google/googleAuthMachine.ts');

if (nativeGoogle.includes('await GoogleSignin.signOut().catch')) errors.push('Google sign-out before sign-in is still present.');
if (!nativeGoogle.includes('GoogleSignin.hasPlayServices')) errors.push('Google Play Services check missing.');
if (!nativeGoogle.includes("code: 'GOOGLE_DEVELOPER_ERROR'")) errors.push('Google configuration error is not explicit.');
if (!machine.includes('attemptInProgress')) errors.push('Parallel Google attempts are not blocked.');
if (!firebase.includes('BACKEND_READY_TIMEOUT_MS')) errors.push('Backend readiness timeout missing.');
if (!firebase.includes('BACKEND_SESSION_TIMEOUT_MS')) errors.push('Backend session timeout missing.');
if (!firebase.includes('AbortController') && !read('src/shared/network/withTimeout.ts').includes('AbortController')) errors.push('AbortController timeout missing.');
if (!firebase.includes('Authorization: `Bearer ${idToken}`')) errors.push('Firebase ID token is not sent as Bearer token.');
if (!firebase.includes('createFirebaseLimitedSession')) errors.push('Firebase limited mode fallback missing.');
if (!login.includes("state === 'local_limited_mode'")) errors.push('Login UI does not accept local limited mode.');
if (session.includes('secureStorage.set(AUTH_SESSION_STORAGE_KEYS.pendingFirebaseIdToken')) errors.push('Firebase ID token is still persisted manually.');
if (!server.includes("pathname === '/ready'")) errors.push('/ready endpoint missing.');
if (!server.includes("getBearer(req) || body.idToken")) errors.push('Backend does not accept Bearer Firebase token.');
if (!firebaseAdmin.includes('Firebase Admin credentials are required')) errors.push('Firebase Admin requirement missing.');
if (!/- key: APP_ENV\s+value: staging/.test(render)) errors.push('Render QA deployment is not staging.');
if (!/- key: REQUIRE_REDIS\s+value: \"false\"/.test(render)) errors.push('Render QA incorrectly requires Redis.');
if (!openapi.includes('  /ready:')) errors.push('/ready missing from OpenAPI.');
const gradle = read('android/app/build.gradle');
const qaBuild = read('scripts/build-qa-apk.sh');
if (!gradle.includes('LOUSA_QA_KEYSTORE_PATH')) errors.push('Stable QA signing keystore is not required by Gradle.');
if (qaBuild.includes('ensure-standard-debug-keystore.sh')) errors.push('QA build still generates a new signing key per machine.');
if (!read('src/shared/network/withTimeout.ts').includes('Promise.race')) errors.push('Timeout helper does not enforce timeout for native SDK promises.');
if (!server.includes('AUTH_ACCOUNT_LINK_REQUIRED')) errors.push('Backend can still silently merge legacy accounts by email/phone.');

if (errors.length) {
  console.error('verify:google-auth-build128 FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('verify:google-auth-build128 PASS — staged Google/Firebase/backend session contract');
