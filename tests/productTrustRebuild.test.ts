import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('LOUSA product trust rebuild guards', () => {
  test('map camera is uncontrolled after initial setup and fullscreen picker uses a crosshair', () => {
    const map = read('src/components/LousaMapLibreAddressMap.tsx');
    const picker = read('app/screens/address-map-picker.tsx');
    expect(map).toContain('defaultSettings');
    expect(map).not.toContain('centerCoordinate={[longitude, latitude]}');
    expect(picker).toContain('selectionMode="crosshair"');
    expect(picker).toContain('onCameraIdle={resolve}');
    expect(picker).not.toContain('height={9999}');
    expect(picker).toContain('geocodeRequestId.current += 1');
    expect(picker).toContain('disabled={!canConfirm}');
    expect(picker).toContain('Math.max(\n    240,');
  });

  test('delivery is included in the plan and backend remains the source of truth', () => {
    const zone = read('src/services/deliveryZoneLocal.ts');
    const server = read('apps/api/src/server.ts');
    expect(zone).toContain('includedInPlan');
    expect(server).toContain('deliveryIncludedInPlan: true');
    expect(server).toContain('deliveryFeeMinor: 0');
    expect(server).toContain("'/v1/admin/delivery-map'");
    expect(read('src/services/boxQuote.ts')).toContain('const deliveryFeeAmd = 0');
    expect(read('src/services/deliveryZone.ts')).toContain('deliveryFeeMinor: 0');
  });

  test('cycle facts, no-bleeding observations and forecasts are separate', () => {
    const models = read('src/domain/models.ts');
    const prediction = read('src/services/cyclePrediction.ts');
    const calendar = read('app/(tabs)/cycle.tsx');
    expect(models).toContain('CycleDayObservation');
    expect(models).toContain("'no_bleeding'");
    expect(prediction).toContain('negativeBleedingDates');
    expect(prediction).toContain("reasons.push('expected_window_passed')");
    expect(prediction).not.toContain('while (predicted < today)');
    const engine = read('src/utils/cycleEngine.ts');
    expect(engine).toContain('isCyclePositionKnown');
    expect(engine).not.toContain('diffDays % cycleLength');
    expect(calendar).toContain('factVsForecast');
    expect(calendar).toContain("applyCycleObservation('no_bleeding')");
  });

  test('active bottom tab does not change icon size or use a vertical transform', () => {
    const tabs = read('app/(tabs)/_layout.tsx');
    expect(tabs).toContain('size={22}');
    expect(tabs).not.toContain('focused ? 23 : 22');
    expect(tabs).not.toMatch(/translateY/);
  });

  test('mobile source contains no admin frontend and delivery DTO excludes private health data', () => {
    expect(fs.existsSync(path.join(root, 'apps/admin'))).toBe(false);
    const server = read('apps/api/src/server.ts');
    expect(server).toContain('cycleDataIncluded: false');
    expect(server).toContain("scope: 'delivery_only'");
    expect(server).toContain('safeDelivery');
  });
  test('cycle edits are atomic and undo restores both facts and period records', () => {
    const store = read('src/store/index.ts');
    const calendar = read('app/(tabs)/cycle.tsx');
    expect(store).toContain('applyCycleDayObservation');
    expect(store).toContain('removeCycleDayEntry');
    expect(store).toContain('undoLastCycleEdit');
    expect(store).toContain('cycleEditHistory');
    expect(calendar).toContain('cycleStore.applyCycleDayObservation');
    expect(calendar).toContain('cycleStore.removeCycleDayEntry');
    expect(calendar).toContain('buildCycleSyncDiff');
  });

  test('unsaved delivery drafts recover and existing addresses update instead of duplicating', () => {
    const screen = read('app/screens/address-map.tsx');
    const maps = read('src/services/maps.ts');
    const server = read('apps/api/src/server.ts');
    expect(screen).toContain('loadDeliveryAddressDraft<DeliveryAddress>');
    expect(screen).toContain('checkRealDeliveryZone(draft.latitude, draft.longitude)');
    expect(maps).toContain("method: updateExisting ? 'PATCH' : 'POST'");
    expect(server).toContain("if (addressMatch && method === 'PATCH')");
    expect(server).toContain("throw new ApiError(404, 'ADDRESS_NOT_FOUND'");
  });

  test('private cycle facts use an offline queue and never depend on admin delivery DTOs', () => {
    const sync = read('src/services/cycleSync.ts');
    const calendar = read('app/(tabs)/cycle.tsx');
    expect(sync).toContain('lousa-cycle-sync-v2');
    expect(sync).toContain('upsert_observation');
    expect(sync).toContain('delete_period');
    expect(calendar).toContain('flushCycleSyncQueue');
    expect(calendar).toContain('syncPending');
    expect(read('src/services/cycleSyncDiff.ts')).toContain('delete_observation');
  });


  test('delivery address form collects the backend-required recipient contact fields', () => {
    const address = read('app/screens/address-map.tsx');
    expect(address).toContain('const [recipientName, setRecipientName]');
    expect(address).toContain('const [deliveryPhone, setDeliveryPhone]');
    expect(address).toContain('setError(copy.contactRequired)');
    expect(address).toContain('recipientName: recipientName.trim()');
    expect(address).toContain('phone: deliveryPhone.trim()');
    expect(address).not.toContain("recipientName: existing?.recipientName || userName || 'LOUSA user'");
  });

  test('bottom tabs reserve an exact content slot instead of overflowing their padding box', () => {
    const tabs = read('app/(tabs)/_layout.tsx');
    expect(tabs).toContain('const TAB_CONTENT_HEIGHT = 60');
    expect(tabs).toContain('height: tabBarHeight');
    expect(tabs).toContain('paddingBottom: TAB_VERTICAL_PADDING + safeBottom');
    expect(tabs).toContain("tabBarItem: { height: TAB_CONTENT_HEIGHT");
    expect(tabs).not.toContain("tabBarItem: { height: '100%'");
    expect(tabs).not.toContain('translateY');
  });

  test('map uses only callbacks supported by the installed MapLibre version', () => {
    const map = read('src/components/LousaMapLibreAddressMap.tsx');
    expect(map).toContain('onRegionIsChanging={handleMoving}');
    expect(map).toContain('onRegionDidChange={handleIdle}');
    expect(map).not.toContain('onCameraChanged={handleMoving}');
    expect(map).not.toContain('onMapIdle={handleIdle}');
    expect(map).toContain('if (movingRef.current) return');
  });

  test('courier task routes are scoped to the assigned courier', () => {
    const server = read('apps/api/src/server.ts');
    expect(server).toContain('where = { courierId: courier.id }');
    expect(server.match(/currentTask\.courierId !== courier\.id/g)).toHaveLength(2);
  });
});
