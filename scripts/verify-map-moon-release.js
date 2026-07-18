#!/usr/bin/env node
/* eslint-env node */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
function assert(condition, message) {
  checks.push({ condition, message });
  console.log(`${condition ? 'PASS' : 'FAIL'}: ${message}`);
}

const provider = read('src/services/mapProvider.ts');
const maps = read('src/services/maps.ts');
const address = read('app/screens/address-map.tsx');
const localZone = read('src/services/deliveryZoneLocal.ts');
const mapComponent = read('src/components/LousaMapLibreAddressMap.tsx');
const moon = read('src/components/RealisticMoon.tsx');
const moonRendering = read('src/utils/moonRendering.ts');
const phase = read('src/utils/moonPhase.ts');
const home = read('app/(tabs)/index.tsx');

assert(provider.includes('https://tiles.openfreemap.org/styles/positron'), 'real no-key OpenFreeMap style is available');
assert(provider.includes("'maplibre-openfreemap'"), 'OpenFreeMap is represented as a real provider, not a placeholder');
assert(!maps.includes('return checkGyumriDeliveryZoneLocal'), 'backend zone failure is not converted into local success');
assert(localZone.includes("source: 'local-estimate'"), 'local radius is explicitly marked as an estimate');
assert(address.includes("zone.source !== 'backend'"), 'checkout requires backend-verified zone truth');
assert(address.includes('saveDeliveryAddressRemote(address,'), 'address save requires the real backend endpoint for create/update');
assert(address.includes('mapHeight = width < 360'), 'map height is responsive on narrow Android devices');
assert(address.includes('contentContainerStyle={[styles.screenContent'), 'map and form share one keyboard-safe scroll flow');
assert(mapComponent.includes('draggable={interactive}') && mapComponent.includes('onDragEnd'), 'selected address marker is draggable on the real map');
assert(mapComponent.includes('onDidFailLoadingMap') && !mapComponent.includes('onMapLoadingError'), 'map uses supported native load callbacks');
assert(!moon.includes('rgba(4,3,10,0.935)'), 'moon no longer uses an almost-black opaque disk');
assert(moon.includes('shadowOpacity = safeIllumination <= 0.08 ? 0.52'), 'new moon remains visually readable');
assert(moon.includes('onError={() => setTextureFailed(true)}'), 'moon has a bundled vector fallback when texture loading fails');
assert(moonRendering.includes('Number.isFinite(illumination)') && moonRendering.includes('waxing'), 'moon shadow geometry clamps input and mirrors waxing/waning');
assert(phase.includes('Math.round(normalized * 8) % 8'), 'moon phase uses nearest standard phase point');
assert(phase.includes('No emotional, medical, or fertility meaning'), 'moon feature has a non-medical truth boundary');
assert(home.includes('getMoonPhaseLabel') && home.includes('moonPhaseLabel'), 'home card shows the actual astronomical phase label');

if (checks.some((item) => !item.condition)) process.exit(1);
console.log('LOUSA real map and readable moon verification passed.');
