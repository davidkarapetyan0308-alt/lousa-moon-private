import fs from 'node:fs';
import path from 'node:path';
const yaml: { load(source: string): unknown } = require('js-yaml');

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('LOUSA product trust backend contracts', () => {
  test('database migration persists free delivery and private cycle observations', () => {
    const schema = read('apps/api/prisma/schema.prisma');
    const migration = read('apps/api/prisma/migrations/202607130001_product_trust_rebuild/migration.sql');
    expect(schema).toContain('model CycleObservation');
    expect(schema).toContain('deliveryIncludedInPlan Boolean @default(true)');
    expect(schema).toContain('baseFeeMinor  Int      @default(0)');
    expect(schema).toContain('syncStatus        String   @default("synced")');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "CycleObservation"');
    expect(migration).toContain('SET "deliveryFeeMinor" = 0');
  });

  test('API supports address update, private cycle records and delivery-only admin views', () => {
    const server = read('apps/api/src/server.ts');
    expect(server).toContain("if (addressMatch && method === 'PATCH')");
    expect(server).toContain("pathname === '/v1/cycle/observations'");
    expect(server).toContain('type: { not: type }');
    expect(server).toContain("pathname === '/v1/admin/delivery-map'");
    expect(server).toContain('cycleDataIncluded: false');
    expect(server).toContain("scope: 'delivery_only'");
  });

  test('OpenAPI documents the new trust boundaries', () => {
    const source = read('apps/api/openapi.yaml');
    const document = yaml.load(source) as { paths?: Record<string, unknown> };
    expect(document.paths).toHaveProperty('/v1/delivery-addresses/{addressId}');
    expect(document.paths).toHaveProperty('/v1/cycle/observations');
    expect(document.paths).toHaveProperty('/v1/admin/delivery-map');
    expect(source).toContain('private health data excluded');
  });
});
