const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const failures = [];
const requireText = (file, text) => { if (!read(file).includes(text)) failures.push(`${file}: missing ${text}`); };
const forbid = (file, pattern, label) => { if (pattern.test(read(file))) failures.push(`${file}: forbidden ${label}`); };
requireText('app/screens/address-map-picker.tsx', 'selectionMode="crosshair"');
requireText('app/screens/address-map-picker.tsx', 'onCameraIdle={resolve}');
forbid('app/screens/address-map-picker.tsx', /height=\{9999\}/, 'fake fullscreen height');

requireText('app/screens/address-map-picker.tsx', 'geocodeRequestId.current += 1');
requireText('app/screens/address-map-picker.tsx', 'disabled={!canConfirm}');
requireText('src/services/cyclePrediction.ts', "reasons.push('expected_window_passed')");
forbid('src/services/cyclePrediction.ts', /while \(predicted < today\)/, 'invented unrecorded cycles');
requireText('src/utils/cycleEngine.ts', 'isCyclePositionKnown');
forbid('src/utils/cycleEngine.ts', /diffDays % cycleLength/, 'modulo-based invented current cycle');
requireText('src/services/cycleSyncDiff.ts', 'buildCycleSyncDiff');
requireText('app/(tabs)/cycle.tsx', 'buildCycleSyncDiff');
requireText('src/services/boxQuote.ts', 'const deliveryFeeAmd = 0');
requireText('src/services/deliveryZone.ts', 'deliveryFeeMinor: 0');
requireText('apps/api/src/server.ts', 'where = { courierId: courier.id }');
requireText('apps/api/src/server.ts', 'DELIVERY_TASK_FORBIDDEN');
requireText('src/services/deliveryZoneLocal.ts', 'includedInPlan');
requireText('apps/api/src/server.ts', "pathname === '/v1/admin/delivery-map'");
requireText('app/(tabs)/cycle.tsx', 'factVsForecast');
requireText('src/store/index.ts', 'applyCycleDayObservation');
requireText('src/store/index.ts', 'undoLastCycleEdit');
requireText('src/services/cycleSync.ts', 'lousa-private-cycle-sync-queue-v1');
requireText('app/(tabs)/cycle.tsx', 'flushCycleSyncQueue');
requireText('app/screens/address-map.tsx', 'loadDeliveryAddressDraft<DeliveryAddress>');
requireText('src/services/maps.ts', "method: updateExisting ? 'PATCH' : 'POST'");
requireText('app/(tabs)/for-you.tsx', 'Почему LOUSA это показывает');
forbid('app/(tabs)/_layout.tsx', /translateY/, 'active tab vertical shift');
const mapComponent = read('src/components/LousaMapLibreAddressMap.tsx');
if (!mapComponent.includes('onRegionIsChanging={handleMoving}')) failures.push('map: missing MapLibre camera movement callback');
if (!mapComponent.includes('onRegionDidChange={handleIdle}')) failures.push('map: missing MapLibre camera idle callback');
if (mapComponent.includes('onCameraChanged={handleMoving}')) failures.push('map: unsupported duplicate camera callback');
if (mapComponent.includes('onMapIdle={handleIdle}')) failures.push('map: unsupported duplicate idle callback');
if (!mapComponent.includes('if (movingRef.current) return')) failures.push('map: missing frame-safe movement guard');

if (failures.length) {
  console.error('verify:product-trust FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('verify:product-trust PASS');
