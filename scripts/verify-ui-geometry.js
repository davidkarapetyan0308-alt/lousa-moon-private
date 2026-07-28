#!/usr/bin/env node
/* eslint-env node */

const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const files = {
  layout: read('src/components/layout.tsx'),
  authShell: read('src/features/auth/components/PremiumAuthShell.tsx'),
  login: read('app/auth/login.tsx'),
  onboarding: read('app/auth/onboarding.tsx'),
  logState: read('app/screens/wellness-log.tsx'),
  cycle: read('app/(tabs)/cycle.tsx'),
  chat: read('app/screens/help-assistant.tsx'),
  address: read('app/screens/address-map.tsx'),
  design: read('src/theme/designSystem.ts'),
  sharedUi: read('src/components/ui/index.tsx'),
};

const required = [
  [files.layout, 'scroll: { flex: 1 }', 'shared ScrollView must fill the screen'],
  [files.layout, 'scrollContent: { flexGrow: 1', 'shared scroll content must grow on short screens'],
  [files.authShell, "edges={['top', 'bottom']}", 'auth must protect both safe areas'],
  [files.authShell, 'const bottomPadding = Math.max(32, insets.bottom + 24)', 'auth bottom padding must follow the safe area'],
  [files.authShell, "form: {\n    flexGrow: 0", 'auth form content must use natural height instead of filling the viewport'],
  [files.login, 'authFlowForm: { paddingBottom: 0 }', 'auth header and card must remain in one natural vertical flow'],
  [files.login, 'formSheet: { marginTop: 14 }', 'auth form must start close to the header'],
  [files.login, 'minWidth: 32', 'OTP cells must shrink on 320 dp screens'],
  [files.onboarding, 'scroll: { flexGrow: 1', 'onboarding content must remain scrollable'],
  [files.chat, /behavior=\{Platform\.OS === [\"']ios[\"'] \? [\"']padding[\"'] : [\"']height[\"']\}/, 'chat must react to the Android keyboard'],
  [files.address, /behavior=\{Platform\.OS === [\"']ios[\"'] \? [\"']padding[\"'] : [\"']height[\"']\}/, 'address form must react to the Android keyboard'],
  [files.design, 'touchTarget: 48', 'shared touch target token must be 48 dp'],
  [files.login, 'width: 44,\n    height: 44,\n    borderRadius: 22', 'auth back button must meet the 44 dp target'],
  [files.login, 'minHeight: 48,\n    justifyContent: "center"', 'auth text actions must meet the 48 dp target'],
  [files.onboarding, 'headerButton: { width: 48, height: 48', 'onboarding header action must meet the 48 dp target'],
  [files.logState, 'choice: { minHeight: 48', 'journal choices must meet the 48 dp target'],
  [files.sharedUi, 'minHeight: LousaLayout.buttonHeight', 'primary action must use the shared button height'],
];

const forbidden = [
  [files.login, 'formBottomPadding', 'manual auth bottom padding'],
  [files.login, 'signupBottomPadding', 'manual signup bottom padding'],
  [files.login, 'scrollContentAuthFixed', 'fixed auth scroll geometry'],
  [files.login, '<Animated.View', 'layout-transform animation on auth containers'],
  [files.authShell, "form: {\n    flexGrow: 1", 'full-height form content that can recreate a giant blank gap'],
  [files.onboarding, "footer: { position: 'absolute'", 'absolute onboarding footer'],
  [files.onboarding, 'paddingBottom: 176', 'manual onboarding footer compensation'],
  [files.logState, "stickyFooter: { position: 'absolute'", 'absolute journal footer'],
  [files.cycle, "stickySave: { position: 'absolute'", 'absolute calendar save button'],
];

const failures = [];
for (const [source, fragment, reason] of required) {
  const present = fragment instanceof RegExp ? fragment.test(source) : source.includes(fragment);
  if (!present) failures.push(`Missing: ${reason}`);
}
for (const [source, fragment, reason] of forbidden) {
  if (source.includes(fragment)) failures.push(`Forbidden: ${reason}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('PASS: shared screen geometry, auth flow, safe areas, scrolling, and Android keyboard guards are present.');
