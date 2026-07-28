const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(process.cwd(), 'app');
const forbidden = [/(^|\/)log-state\.(tsx?|jsx?)$/i, /(^|\/)diagnostics?\.(tsx?|jsx?)$/i, /(^|\/)ux-lab\.(tsx?|jsx?)$/i, /(^|\/)developer-tools?\.(tsx?|jsx?)$/i];
const violations = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const relative = path.relative(process.cwd(), full).replace(/\\/g, '/');
      if (forbidden.some((pattern) => pattern.test(relative))) violations.push(relative);
    }
  }
}
walk(appRoot);
const routeText = fs.readFileSync(path.resolve(process.cwd(), 'src/bootstrap/AppShell.tsx'), 'utf8');
for (const token of ['screens/log-state', 'screens/diagnostics', 'screens/ux-lab', 'screens/developer-tools']) {
  if (routeText.includes(token)) violations.push(`AppShell route: ${token}`);
}
if (violations.length) {
  console.error('verify:production-route-boundary FAIL');
  violations.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log('verify:production-route-boundary PASS');
