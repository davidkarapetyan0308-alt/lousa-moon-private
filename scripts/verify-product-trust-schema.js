const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8');
const failures = [];
const requireText = (file, text) => { if (!read(file).includes(text)) failures.push(`${file}: missing ${text}`); };
requireText('apps/api/prisma/schema.prisma', 'model CycleObservation');
requireText('apps/api/prisma/schema.prisma', 'deliveryIncludedInPlan Boolean @default(true)');
requireText('apps/api/prisma/schema.prisma', 'baseFeeMinor  Int      @default(0)');
requireText('.env.example', 'DELIVERY_ZONE_BASE_FEE_MINOR=0');
requireText('apps/api/prisma/migrations/202607130001_product_trust_rebuild/migration.sql', 'CREATE TABLE IF NOT EXISTS "CycleObservation"');
requireText('apps/api/src/server.ts', "if (addressMatch && method === 'PATCH')");
requireText('apps/api/src/server.ts', 'type: { not: type }');
requireText('apps/api/src/server.ts', "scope: 'delivery_only'");
const openapi = read('apps/api/openapi.yaml');
for (const route of ['/v1/delivery-addresses/{addressId}:', '/v1/cycle/observations:', '/v1/admin/delivery-map:']) {
  if (!openapi.includes(route)) failures.push(`apps/api/openapi.yaml: missing ${route.slice(0,-1)}`);
}
if (failures.length) { console.error('verify:product-trust-schema FAIL'); failures.forEach((x)=>console.error(`- ${x}`)); process.exit(1); }
console.log('verify:product-trust-schema PASS');
