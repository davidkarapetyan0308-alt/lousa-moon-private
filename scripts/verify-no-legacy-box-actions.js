#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const store = fs.readFileSync(path.join(root, 'src/store/index.ts'), 'utf8');
const prohibitedStoreActions = [
  /\n\s*subscribe:\s*\(/,
  /\n\s*cancel:\s*\(/,
  /\n\s*togglePause:\s*\(/,
  /\n\s*pause:\s*\(/,
  /\n\s*resume:\s*\(/,
  /\n\s*createRecommendedOrder:\s*\(/,
];
const failures = prohibitedStoreActions.filter((pattern) => pattern.test(store)).map(String);
if (!store.includes('seedDemoSubscription') || !store.includes("DEMO_SUBSCRIPTION_SEED_FORBIDDEN")) {
  failures.push('missing explicit demo-only subscription seed boundary');
}
if (failures.length) {
  console.error('verify:no-legacy-box-actions FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('verify:no-legacy-box-actions PASS — production Box state has no local subscription/order lifecycle actions');
