const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(file){ return fs.readFileSync(path.join(root,file),'utf8'); }
function must(condition, message){ if(!condition){ console.error(`FAIL: ${message}`); process.exitCode = 1; } else { console.log(`PASS: ${message}`); } }
const files = [
  'src/services/mapProvider.ts',
  'src/components/LousaMapLibreAddressMap.tsx',
  'src/services/apiEnvironment.ts',
  'src/services/deliveryZoneLocal.ts',
  'src/services/maps.ts',
  'src/services/api/index.ts',
  'src/components/DateCalendarPicker.tsx',
  'app/auth/onboarding.tsx',
  'app/screens/address-map.tsx',
  'src/components/MaterialSymbol.tsx',
  'apps/api/src/config/env.ts',
  'apps/api/src/server.ts',
  'README_LOUSA_V10_3_3_REAL_PRODUCT_TRUTH_QA_RU.md',
  'LOUSA_V10_3_3_DEVICE_QA_CHECKLIST_RU.md',
  'LOUSA_V10_3_3_HONEST_SCORE_RU.md',
];
files.forEach((file)=>must(fs.existsSync(path.join(root,file)), `${file} exists`));
const mapProvider = read('src/services/mapProvider.ts');
must(mapProvider.includes('manual-fallback'), 'map provider has manual fallback state');
must(mapProvider.includes('demo_forbidden'), 'demo map style is explicitly forbidden');
must(!mapProvider.includes("styleUrl: 'https://demotiles.maplibre.org/style.json'"), 'demotiles URL is not a provider fallback');
must(!mapProvider.includes('process.env.MAPTILER_API_KEY'), 'mobile map provider does not bundle backend-only MapTiler key');

const mapComponent = read('src/components/LousaMapLibreAddressMap.tsx');
must(mapComponent.includes('shouldRenderInteractiveMap'), 'map component uses provider readiness gate');
must(!mapComponent.includes('Demo tiles'), 'map component no longer displays Demo tiles pill');
const apiEnv = read('src/services/apiEnvironment.ts');
must(apiEnv.includes('localhost_forbidden'), 'Android localhost API is explicitly blocked');
const maps = read('src/services/maps.ts');
const apiIndex = read('src/services/api/index.ts');
must(maps.includes('assertApiEnvironmentReady'), 'maps API uses real API environment gate');
must(apiIndex.includes('assertApiEnvironmentReady') && !apiIndex.includes('http://localhost:4100'), 'main API service blocks localhost fallback');
must(apiIndex.includes('const errorCode = error instanceof Error'), 'main API service preserves provider/setup error codes instead of mapping everything to NETWORK_ERROR');
must(maps.includes('checkGyumriDeliveryZoneLocal'), 'delivery zone has local Gyumri fallback');
const calendar = read('src/components/DateCalendarPicker.tsx');
must(calendar.includes('dayCell') && calendar.includes('dayButton'), 'calendar has fixed cell/button geometry');
must(!calendar.includes('selected && styles.selectedCell'), 'selected date is not applied to whole grid cell');
const onboarding = read('app/auth/onboarding.tsx');
must(onboarding.includes('paddingBottom: 176 + insets.bottom'), 'onboarding scroll has footer-safe bottom spacer');
const icons = read('src/components/MaterialSymbol.tsx');
must(icons.includes('search:') && icons.includes('my_location:') && icons.includes('map_pin:'), 'critical SVG icons exist');
must(!icons.includes("|| '•'") && !icons.includes("|| '?'") && !icons.includes('unicodeFallbacks'), 'production icon fallback is not bullet/question mark');
const requiredProductionIcons = ['arrow_upward','health_and_safety','logout','map','person_search','photo_camera','priority_high','privacy_tip','shield','timelapse'];
for (const icon of requiredProductionIcons) {
  must(icons.includes(`${icon}:`), `production SVG icon exists: ${icon}`);
}
const addressMap = read('app/screens/address-map.tsx');
must(addressMap.includes('checkGyumriDeliveryZoneLocal(initialCoordinate)'), 'address screen initializes Gyumri local zone instead of null checking state');
must(addressMap.includes('const searchEnabled = realMapReady && apiEnvironment.isUsableOnDevice'), 'address search is hidden when map/API provider is not ready');
must(addressMap.includes('const effectiveZone = zone || checkGyumriDeliveryZoneLocal(coordinate)'), 'confirm address uses local Gyumri fallback when zone is missing');
must(addressMap.includes('if (apiEnvironment.isUsableOnDevice)'), 'address save does not call backend when API URL is not usable');
const env = read('apps/api/src/config/env.ts');
must(env.includes('EMAIL_PROVIDER=console is not allowed in production'), 'production console email is blocked');
must(!env.includes('111243260096'), 'Google OAuth client IDs are not hardcoded defaults');
must(env.includes('MESSAGEBIRD_API_KEY') && env.includes('SMS_PROVIDER must be twilio or messagebird in production'), 'production SMS provider validation covers real providers only');
const server = read('apps/api/src/server.ts');
must(server.includes('isAvailable: result.isAvailable'), 'backend delivery check returns isAvailable shape');
must(server.includes('sendWithTwilio') && !server.includes('twilio-dev-placeholder'), 'Twilio SMS sender is real HTTP provider path, not production placeholder');
must(server.includes('sendWithMessageBird'), 'MessageBird SMS sender exists or production config is not fake');
must(server.includes('function canExposeDevSmsOtp'), 'SMS dev OTP exposure is gated separately from email provider settings');
must(server.includes("raw.startsWith('0') && raw.length >= 8"), 'phone normalization supports local Armenia numbers like 091234567');
if(process.exitCode){ process.exit(1); }
