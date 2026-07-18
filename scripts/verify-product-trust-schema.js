const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const requireText = (file, text) => {
  if (!read(file).includes(text)) failures.push(`${file}: missing ${text}`);
};
requireText('apps/api/prisma/schema.prisma', 'model CycleObservation');
requireText('apps/api/prisma/schema.prisma', 'deliveryIncludedInPlan Boolean @default(true)');
requireText('apps/api/prisma/schema.prisma', 'baseFeeMinor  Int      @default(0)');
requireText('.env.example', 'DELIVERY_ZONE_BASE_FEE_MINOR=0');
requireText('apps/api/prisma/migrations/202607130001_product_trust_rebuild/migration.sql', 'CREATE TABLE IF NOT EXISTS "CycleObservation"');
requireText('apps/api/src/server.ts', "if (addressMatch && method === 'PATCH')");
requireText('apps/api/src/server.ts', 'type: { not: type }');
requireText('apps/api/src/server.ts', "scope: 'delivery_only'");
try {
  const openapi = yaml.load(read('apps/api/openapi.yaml'));
  const paths = openapi && openapi.paths ? openapi.paths : {};
  for (const route of ['/v1/delivery-addresses/{addressId}', '/v1/cycle/observations', '/v1/admin/delivery-map']) {
    if (!paths[route]) failures.push(`apps/api/openapi.yaml: missing ${route}`);
  }
} catch (error) {
  failures.push(`apps/api/openapi.yaml: ${error.message}`);
}
if (failures.length) {
  console.error('verify:product-trust-schema FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('verify:product-trust-schema PASS');
