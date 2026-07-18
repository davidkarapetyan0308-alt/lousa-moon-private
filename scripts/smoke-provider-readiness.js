/* eslint-env node */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(file){ return fs.readFileSync(path.join(root,file),'utf8'); }
function pass(message){ console.log(`PASS: ${message}`); }
function fail(message){ console.error(`FAIL: ${message}`); process.exit(1); }
const name = path.basename(__filename);

if (name.includes('registration')) {
  const email = read('apps/api/src/emailService.ts');
  const server = read('apps/api/src/server.ts');
  if (!email.includes("APP_ENV !== 'production' && EMAIL_PROVIDER === 'console'")) fail('console email is not restricted to non-production');
  if (!email.includes("throw new Error('EMAIL_PROVIDER is not configured for real email delivery.')")) fail('real email provider blocker missing');
  if (!server.includes("pathname === '/v1/auth/register'") || !server.includes("pathname === '/v1/auth/verify-email'")) fail('email registration endpoints missing');
  pass('real registration provider gates are present');
} else if (name.includes('map')) {
  const mapProvider = read('src/services/mapProvider.ts');
  const mapComponent = read('src/components/LousaMapLibreAddressMap.tsx');
  if (mapProvider.includes("styleUrl: 'https://demotiles.maplibre.org/style.json'")) fail('demo tiles fallback still present');
  if (!mapProvider.includes('https://tiles.openfreemap.org/styles/positron')) fail('real public map style missing');
  if (!mapComponent.includes('onDidFailLoadingMap') || !mapComponent.includes('draggable={interactive}')) fail('interactive map loading/drag contract missing');
  pass('real MapLibre map, public style, errors, tap and draggable marker are present');
} else if (name.includes('address')) {
  const maps = read('src/services/maps.ts');
  const local = read('src/services/deliveryZoneLocal.ts');
  const screen = read('app/screens/address-map.tsx');
  if (maps.includes('return checkGyumriDeliveryZoneLocal')) fail('backend failure is still converted to local success');
  if (!maps.includes("'/v1/delivery/check-zone'")) fail('real backend delivery-zone endpoint missing');
  if (!local.includes("source: 'local-estimate'") || !local.includes('requiresManualReview: true')) fail('local visual estimate is not explicitly non-authoritative');
  if (!screen.includes("zone.source !== 'backend'") || !screen.includes('saveDeliveryAddressRemote(address)')) fail('backend truth/save gates missing');
  pass('address selection requires backend zone truth and real server persistence');
} else if (name.includes('layout')) {
  const onboarding = read('app/auth/onboarding.tsx');
  const address = read('app/screens/address-map.tsx');
  const layout = read('src/components/layout.tsx');
  if (!onboarding.includes('footerCompact') || onboarding.includes('paddingBottom: 176')) fail('onboarding still uses fixed footer compensation');
  if (!address.includes('KeyboardAvoidingView') || !address.includes('paddingBottom: Math.max(28, insets.bottom + 20)')) fail('address keyboard/safe-area flow missing');
  if (!layout.includes('useAppContentInsets') || !layout.includes('paddingBottom: bottomSpace')) fail('shared bottom-safe layout missing');
  pass('responsive scroll, keyboard and bottom safe-area layout guards exist');
} else {
  const example = read('.env.example');
  if (!example.includes('EXPO_PUBLIC_OPENFREEMAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron')) fail('public map fallback guidance missing');
  if (!example.includes('MAPTILER_API_KEY=') || !example.includes('EXPO_PUBLIC_DISABLE_PUBLIC_MAP_FALLBACK=false')) fail('map provider readiness variables missing');
  pass('provider readiness guidance and map environment variables exist');
}
