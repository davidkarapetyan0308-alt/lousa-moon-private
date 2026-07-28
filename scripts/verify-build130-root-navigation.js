const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const errors = [];
const expect = (condition, message) => { if (!condition) errors.push(message); };

const pkg = JSON.parse(read('package.json'));
const appJson = JSON.parse(read('app.json'));
const layout = read('app/_layout.tsx');
const shell = read('src/bootstrap/AppShell.tsx');
const startupRoute = read('app/index.tsx');

expect(pkg.version === '1.18.22', 'package version must be 1.18.22');
expect(appJson.expo.version === '1.18.22', 'Expo version must be 1.18.22');
expect(appJson.expo.android.versionCode === 133, 'Android versionCode must be 133');
expect(layout.includes('<AppShell />'), 'RootLayout must render AppShell');
expect(shell.includes('useRootNavigationState'), 'root navigation readiness hook missing');
expect(shell.includes('const navigationReady = Boolean(rootNavigationState?.key)'), 'navigation readiness guard missing');
expect(shell.includes('<Stack.Screen name="index"'), 'lightweight startup route missing from root Stack');
expect(shell.indexOf('<Stack') < shell.indexOf('<NavigationCoordinator onStartupRouteReady='), 'Stack must be rendered before the navigation coordinator');
expect(!shell.includes('function NavigationWrapper'), 'conditional NavigationWrapper must be removed');
expect(!shell.includes('if (!effectiveRouteStable) return null'), 'root navigator must never be replaced with null');
expect(!shell.includes('setRouteRecoveryBypass(true)'), 'route-stability bypass must be removed');
expect(shell.includes('if (!navigationReady || !hydrated || !sessionChecked) return;'), 'redirect effect is not gated by mounted root navigator');
expect(shell.includes('router.replace(desiredDestination as never)'), 'guarded destination redirect missing');
expect(startupRoute.includes('Lightweight first route'), 'startup route contract missing');
expect(startupRoute.includes("backgroundColor: '#FFF8F5'"), 'startup route background must match native splash');

if (errors.length) {
  console.error('BUILD131 ROOT NAVIGATION VERIFY: FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('BUILD131 ROOT NAVIGATION VERIFY: PASS');
