/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appRoot = path.join(root, 'app');
const routeFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.startsWith('_layout')) routeFiles.push(full);
  }
}
walk(appRoot);
const normalizedRoutes = new Set();
for (const file of routeFiles) {
  const rel = path.relative(appRoot, file).replace(/\\/g, '/').replace(/\.(tsx|ts)$/, '');
  normalizedRoutes.add('/' + rel);
  normalizedRoutes.add('/' + rel.replace(/^\([^/]+\)\//, ''));
}

const allowedDynamicPrefixes = ['/screens/legal?'];
const missing = [];
const forbidden = [];
for (const file of routeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  for (const match of source.matchAll(/(?:router\.(?:push|replace)|href=)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const target = match[1];
    if (!target.startsWith('/')) continue;
    if (/admin|ux-lab|screens\/privacy/.test(target)) forbidden.push(`${rel}: ${target}`);
    const clean = target.split('?')[0].replace(/\/$/, '') || '/';
    if (clean === '/' || clean === '/(tabs)' || clean.startsWith('/auth/')) continue;
    if (!normalizedRoutes.has(clean) && !allowedDynamicPrefixes.some((prefix) => target.startsWith(prefix))) missing.push(`${rel}: ${target}`);
  }
}
if (fs.existsSync(path.join(appRoot, 'screens/ux-lab.tsx'))) forbidden.push('app/screens/ux-lab.tsx is release-routable');
if (missing.length || forbidden.length) {
  console.error('verify:route-integrity FAIL');
  if (missing.length) console.error('Missing routes:\n' + missing.join('\n'));
  if (forbidden.length) console.error('Forbidden routes:\n' + forbidden.join('\n'));
  process.exit(1);
}
console.log(`verify:route-integrity PASS (${normalizedRoutes.size} routes)`);
