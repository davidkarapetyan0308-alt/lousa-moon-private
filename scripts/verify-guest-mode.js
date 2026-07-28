const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

const contracts = read('src/services/contracts/index.ts');
const session = read('src/features/auth/session/sessionState.ts');
const store = read('src/store/index.ts');
const guest = read('src/features/auth/guest/guestSession.ts');
const login = read('app/auth/login.tsx');
const shell = read('src/bootstrap/AppShell.tsx');
const api = read('src/services/api/index.ts');
const cycle = read('app/(tabs)/cycle.tsx');
const onboarding = read('app/auth/onboarding.tsx');
const box = read('app/(tabs)/box.tsx');
const profile = read('app/screens/profile.tsx');
const subscription = read('app/screens/subscription.tsx');
const address = read('app/screens/address-map.tsx');
const support = read('app/screens/support.tsx');
const feedback = read('app/screens/box-feedback.tsx');
const cycleSync = read('src/services/cycleSync.ts');
const settingsSync = read('src/services/cycleSettingsSync.ts');

expect(contracts.includes("| 'guest'"), 'AuthSessionState contract must include guest.');
expect(session.includes("'guest',"), 'Stored session allowlist must include guest.');
expect(store.includes('isGuestMode: boolean'), 'User store must persist isGuestMode.');
expect(store.includes('guestAuthFlowActive: boolean'), 'User store must persist guest auth flow state.');
expect(store.includes('version: 10'), 'User store migration version must be 10.');
expect(guest.includes("setStoredAuthSessionState('guest')"), 'Guest entry must persist the guest session state.');
expect(guest.includes('clearBackendSessionTokens()'), 'Guest entry must clear backend tokens.');
expect(guest.includes('useBoxStore.setState'), 'Guest entry must clear account-scoped Box data.');
expect(guest.includes('useNotificationStore.setState'), 'Guest entry must clear account-scoped notification inbox data.');
expect(guest.includes('queueGuestCycleDataForNewAccount'), 'New-account upgrade must support local cycle sync.');
expect(login.includes('Продолжить как гость'), 'Russian guest entry copy is missing.');
expect(login.includes('Continue as guest'), 'English guest entry copy is missing.');
expect(login.includes('Շարունակել որպես հյուր'), 'Armenian guest entry copy is missing.');
expect(login.includes('handleGuestAccess'), 'Auth screen must expose the guest action.');
expect(login.includes('guestAccessNote'), 'Auth screen must explain guest limitations.');
expect(shell.includes("setSessionState('guest')"), 'Startup session restore must recognize guest mode.');
expect(shell.includes('guestMayUseAuth'), 'Guest-to-account upgrade must be allowed through auth routes.');
expect(api.includes("sessionState === 'guest'"), 'API must block protected calls in guest mode.');
expect(api.includes('GUEST_ACCOUNT_REQUIRED'), 'Guest API rejection must use a dedicated error code.');
expect(cycle.includes("if (isGuestMode || getServiceMode() !== 'api'"), 'Cycle changes must remain local in guest mode.');
expect(onboarding.includes("if (!isGuestMode && getServiceMode() === 'api')"), 'Guest onboarding must not call backend sync.');
expect(box.includes('guestChoose'), 'Box must offer an account upgrade instead of checkout for guests.');
expect(profile.includes('guestNotice'), 'Profile must explain the guest state.');
expect(profile.includes('beginGuestAccountUpgrade'), 'Profile must allow account upgrade without deleting local data.');
expect(subscription.includes('GuestAccountGate'), 'Subscription screen must gate guest checkout.');
expect(address.includes('GuestAccountGate'), 'Address screen must gate guest delivery details.');
expect(support.includes('GuestAccountGate'), 'Support screen must gate server tickets for guests.');
expect(feedback.includes('GuestAccountGate'), 'Box feedback must gate order-specific server actions.');
expect(cycleSync.includes("(await getStoredAuthSessionState()) === 'guest'"), 'Cycle sync queue must not run in guest mode.');
expect(settingsSync.includes("(await getStoredAuthSessionState()) === 'guest'"), 'Cycle settings sync must not run in guest mode.');
expect(!profile.includes('person_off') && !profile.includes('person_add'), 'Guest profile must use supported icon names.');
expect(!box.includes('person_add'), 'Guest Box CTA must use a supported icon name.');

if (errors.length) {
  console.error('verify:guest-mode FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('verify:guest-mode PASS');
