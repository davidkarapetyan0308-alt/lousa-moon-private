#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function assert(condition, message) {
  if (!condition) { console.error(`FAIL: ${message}`); process.exitCode = 1; }
  else console.log(`PASS: ${message}`);
}

const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));
const appConfig = read('app.config.js');
const address = read('app/screens/address-map.tsx');
const mapComponent = read('src/components/LousaMapLibreAddressMap.tsx');
const provider = read('src/services/mapProvider.ts');
const mapsService = read('src/services/maps.ts');
const server = read('apps/api/src/server.ts');
const env = read('apps/api/src/config/env.ts');
const envExample = read('.env.example');

assert(/^(1\.13\.(7|8|9)|1\.14\.(0|1|2|3)|1\.15\.0)$/.test(pkg.version), 'package version is compatible with MapLibre branch');
assert(/^(1\.13\.(7|8|9)|1\.14\.(0|1|2|3)|1\.15\.0)$/.test(app.expo.version), 'Expo version is compatible with MapLibre branch');
assert(app.expo.android.versionCode >= 95, 'Android versionCode is >= 95');
assert(appConfig.includes("version: '1.15.0'") && appConfig.includes('versionCode: 102'), 'app.config.js version and code are updated');
assert(pkg.dependencies['@maplibre/maplibre-react-native'] === '10.2.1', 'MapLibre React Native v10.2.1 dependency is added for Expo SDK 52 / RN 0.76 compatibility');
assert(app.expo.plugins.includes('@maplibre/maplibre-react-native'), 'MapLibre Expo config plugin is enabled');
assert(exists('src/components/LousaMapLibreAddressMap.tsx'), 'LOUSA MapLibre address map component exists');
assert(exists('src/services/mapProvider.ts'), 'LOUSA map provider configuration exists');
assert(address.includes('LousaMapLibreAddressMap'), 'address picker uses LOUSA MapLibre component');
assert(!address.includes('PROVIDER_GOOGLE') && !address.includes('react-native-maps'), 'address picker is not bound to Google MapView');
assert(mapComponent.includes('maplibre') && mapComponent.includes('MapTiler') && mapComponent.includes('OpenStreetMap'), 'MapLibre component exposes MapTiler/OSM attribution and provider fallback/readiness gate');
assert(mapComponent.includes('makeDeliveryZoneCircleGeoJson'), 'delivery zone overlay is available on LOUSA map');
assert(provider.includes('EXPO_PUBLIC_MAPTILER_API_KEY') && provider.includes('EXPO_PUBLIC_LOUSA_MAP_STYLE_URL'), 'mobile supports MapTiler key or custom style URL');
assert(env.includes('mapTilerApiKey') && envExample.includes('MAPTILER_API_KEY'), 'backend supports MAPTILER_API_KEY');
assert(server.includes('handleMapTilerProxy') && server.includes('api.maptiler.com/geocoding'), 'backend maps proxy supports MapTiler geocoding');
assert(server.includes('handleGoogleMapsProxy'), 'Google maps proxy remains as backend fallback, not mobile dependency');
assert(mapsService.includes("provider: 'google' | 'maptiler' | 'device'"), 'mobile geocoded address provider accepts maptiler');
assert(exists('LOUSA_MOBILE_V10_2_6_MAPLIBRE_DELIVERY_MAP_RU.md'), 'MapLibre implementation document exists');
assert(exists('LOUSA_MOBILE_V10_2_6_TEST_REPORT_RU.md'), 'MapLibre test report exists');

if (process.exitCode) process.exit(process.exitCode);
console.log('LOUSA V10.2.6 MapLibre delivery map verification passed.');
