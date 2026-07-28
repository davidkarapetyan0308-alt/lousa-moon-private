import fs from 'node:fs';
import path from 'node:path';

describe('secure storage timeout policy', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/services/security/secureStorage.ts'), 'utf8');

  test('does not silently convert a native timeout to missing credentials', () => {
    expect(source).toContain("reject(new SecureStorageError('SECURE_STORAGE_TIMEOUT'");
    expect(source).not.toContain('resolve(fallback)');
  });

  test('updates in-memory cache only after durable native write', () => {
    const write = source.indexOf('await withTimeout(\n      store.setItemAsync');
    const cache = source.indexOf('memoryFallback.set(k, value);', write);
    expect(write).toBeGreaterThan(-1);
    expect(cache).toBeGreaterThan(write);
  });
});
