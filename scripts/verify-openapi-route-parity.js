const fs = require('node:fs');
const path = require('node:path');

const serverPath = path.resolve(process.cwd(), 'apps/api/src/server.ts');
const openapiPath = path.resolve(process.cwd(), 'apps/api/openapi.yaml');
const source = fs.readFileSync(serverPath, 'utf8');
const yaml = fs.readFileSync(openapiPath, 'utf8');

const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const routes = new Set();

function normalizePath(value) {
  return value
    .replace(/\\\//g, '/')
    .replace(/\(\[\^\/\]\+\)/g, '{param}')
    .replace(/\(\.\+\)/g, '{param}')
    .replace(/\{[^}]+\}/g, '{param}')
    .replace(/\/+$/, '') || '/';
}

// Exact comparisons in either order.
for (const match of source.matchAll(/method\s*===\s*'([A-Z]+)'\s*&&\s*pathname\s*===\s*'([^']+)'/g)) {
  if (methods.has(match[1])) routes.add(`${match[1]} ${normalizePath(match[2])}`);
}
for (const match of source.matchAll(/pathname\s*===\s*'([^']+)'\s*&&\s*method\s*===\s*'([A-Z]+)'/g)) {
  if (methods.has(match[2])) routes.add(`${match[2]} ${normalizePath(match[1])}`);
}


// OR-combined method comparisons, e.g. (PUT || POST) for the same path.
for (const match of source.matchAll(/\(method\s*===\s*'([A-Z]+)'\s*\|\|\s*method\s*===\s*'([A-Z]+)'\)\s*&&\s*pathname\s*===\s*'([^']+)'/g)) {
  for (const method of [match[1], match[2]]) if (methods.has(method)) routes.add(`${method} ${normalizePath(match[3])}`);
}

// Named regular-expression matches. One matcher can support more than one method.
for (const match of source.matchAll(/const\s+(\w+)\s*=\s*pathname\.match\(\/\^(.+?)\$?\/\);/g)) {
  const [, variable, rawPattern] = match;
  const nextMatcherIndex = source.indexOf('pathname.match(', match.index + match[0].length);
  const tailEnd = nextMatcherIndex === -1 ? Math.min(source.length, match.index + 5000) : nextMatcherIndex;
  const tail = source.slice(match.index, tailEnd);
  const methodRegex = new RegExp(`${variable}\\s*&&\\s*method\\s*===\\s*'([A-Z]+)'`, 'g');
  const matchedMethods = new Set();
  for (const methodMatch of tail.matchAll(methodRegex)) matchedMethods.add(methodMatch[1]);
  if (!matchedMethods.size) continue;

  const optionalSetDefault = rawPattern.includes('(?:\\/(set-default))?');
  let base = rawPattern
    .replace(/\$$/, '')
    .replace(/\(\?:\\\/\(set-default\)\)\?/g, '')
    .replace(/\(\[\^\/\]\+\)/g, '{param}')
    .replace(/\\\//g, '/');
  base = normalizePath(base);
  for (const method of matchedMethods) {
    if (!methods.has(method)) continue;
    routes.add(`${method} ${base}`);
    if (optionalSetDefault) routes.add(`${method} ${base}/set-default`);
  }
}

// Map proxy routes are dispatched through a dedicated handler.
for (const route of [
  'GET /v1/maps/autocomplete',
  'GET /v1/maps/place-details',
  'GET /v1/maps/reverse-geocode',
]) routes.add(route);

const openapiRoutes = new Set();
let currentPath = null;
for (const line of yaml.split(/\r?\n/)) {
  const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
  if (pathMatch) {
    currentPath = normalizePath(pathMatch[1]);
    continue;
  }
  const methodMatch = line.match(/^    (get|post|put|patch|delete):\s*$/i);
  if (currentPath && methodMatch) openapiRoutes.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
}

const missing = [...routes].filter((route) => !openapiRoutes.has(route)).sort();
const extra = [...openapiRoutes].filter((route) => !routes.has(route)).sort();
if (missing.length || extra.length) {
  console.error('verify:openapi-route-parity FAIL');
  if (missing.length) {
    console.error(`Missing from OpenAPI (${missing.length}):`);
    missing.forEach((route) => console.error(`- ${route}`));
  }
  if (extra.length) {
    console.error(`Not found in server route tree (${extra.length}):`);
    extra.forEach((route) => console.error(`- ${route}`));
  }
  process.exit(1);
}
console.log(`verify:openapi-route-parity PASS — ${routes.size} method/path pairs`);
