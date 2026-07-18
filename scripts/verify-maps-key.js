const keys = [
  'GOOGLE_MAPS_ANDROID_API_KEY',
  'GOOGLE_MAPS_API_KEY_ANDROID',
  'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID',
];
const value = keys.map((k) => process.env[k]).find(Boolean);
if (!value) {
  console.error('[verify-maps-key] Missing Android Google Maps key. Accepted names:');
  for (const key of keys) console.error(`- ${key}`);
  process.exit(1);
}
console.log('[verify-maps-key] ok');
