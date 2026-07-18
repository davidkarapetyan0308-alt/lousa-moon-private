const fs = require('fs');
const path = require('path');

const root = process.cwd();
const forbidden = [
  path.join(root, 'apps', 'admin'),
];
for (const target of forbidden) {
  if (fs.existsSync(target)) {
    console.error(`verify:mobile-only-boundary FAILED: forbidden admin frontend exists: ${target}`);
    process.exit(1);
  }
}

const routeRoot = path.join(root, 'app');
const queue = [routeRoot];
while (queue.length) {
  const current = queue.pop();
  if (!fs.existsSync(current)) continue;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) queue.push(full);
    if (entry.isFile() && /admin/i.test(entry.name)) {
      console.error(`verify:mobile-only-boundary FAILED: admin route-like file exists: ${full}`);
      process.exit(1);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const [name, command] of Object.entries(packageJson.scripts || {})) {
  if (/apps\/admin|admin:build|admin:dev|test:admin|verify:admin-security/.test(String(command))) {
    console.error(`verify:mobile-only-boundary FAILED: admin frontend command remains in ${name}`);
    process.exit(1);
  }
}

console.log('verify:mobile-only-boundary PASS');
console.log('Admin frontend is not present in the mobile source tree or mobile route tree.');
console.log('Server-side sync/admin API contracts may remain because the separate admin program uses the shared backend.');
