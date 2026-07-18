const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
};

const server = read('apps/api/src/server.ts');
const schema = read('apps/api/prisma/schema.prisma');
const settings = read('app/screens/settings.tsx');
const supportPath = path.join(root, 'app/screens/support.tsx');
const supportScreenExists = fs.existsSync(supportPath);
const adminFrontendExists = fs.existsSync(path.join(root, 'apps/admin'));

assert(server.includes('/v1/support/tickets'), 'mobile support ticket API exists');
assert(server.includes('/v1/admin/support/tickets'), 'separate admin program support API exists');
assert(server.includes('/v1/app/orders/') && server.includes('/courier-contact'), 'courier contact API exists');
assert(server.includes('/courier-message'), 'courier message relay API exists');
assert(server.includes('redactSupportText'), 'support messages are redacted before storage/DTO');
assert(server.includes('createSafeNotification'), 'safe notification creation helper exists');
assert(schema.includes('model SupportMessage'), 'SupportMessage database model exists');
assert(schema.includes('contactChannel'), 'SupportTicket has contact channel');
assert(!adminFrontendExists, 'admin frontend is not embedded in the mobile source tree');
assert(supportScreenExists, 'mobile support screen exists');
assert(settings.includes("router.push('/screens/support')"), 'settings links to support screen');
if (supportScreenExists) {
  const support = read('app/screens/support.tsx');
  assert(support.includes('Курьер видит только') || support.includes('privacyNote'), 'support screen explains courier privacy boundary');
}

if (process.exitCode) process.exit(1);
console.log('verify:v10-2-safety-support-courier PASS (mobile-only boundary)');
