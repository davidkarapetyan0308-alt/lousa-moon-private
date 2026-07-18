const fs = require('fs');
const address = fs.readFileSync('app/screens/address-map.tsx', 'utf8');
const map = fs.readFileSync('src/components/LousaMapLibreAddressMap.tsx', 'utf8');
const required = ['LousaMapLibreAddressMap', 'MapLibre', 'deliveryZone', 'Комментарий'];
const missing = required.filter((item) => !address.includes(item) && !map.includes(item));
if (!map.includes('ManualFallback')) missing.push('MapLibre manual fallback component');
if (missing.length) {
  console.error('Address smoke failed:', missing.join(', '));
  process.exit(1);
}
console.log('Address smoke PASS');
