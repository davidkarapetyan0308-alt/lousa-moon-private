/* eslint-env node */
const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8');
const maps = read('src/services/maps.ts');
const local = read('src/services/deliveryZoneLocal.ts');
const screen = read('app/screens/address-map.tsx');
const server = read('apps/api/src/server.ts');
const failures = [];
if (maps.includes('return checkGyumriDeliveryZoneLocal')) failures.push('backend failure is converted to local success');
if (!maps.includes("'/v1/delivery/check-zone'")) failures.push('backend zone endpoint missing');
if (!local.includes("source: 'local-estimate'") || !local.includes('requiresManualReview: true')) failures.push('local estimate is not marked non-authoritative');
if (!/zone\.source\s*!==\s*["']backend["']/.test(screen)) failures.push('backend source gate missing');
if (!screen.includes('saveDeliveryAddressRemote(')) failures.push('remote address persistence missing');
if (!screen.includes('addressIdentityDirty')) failures.push('changed-address revalidation gate missing');
if (!server.includes('fieldOrigins')) failures.push('address field origin persistence missing');
if (failures.length) { console.error('smoke:real-address FAIL'); failures.forEach((x)=>console.error(`- ${x}`)); process.exit(1); }
console.log('smoke:real-address PASS');
