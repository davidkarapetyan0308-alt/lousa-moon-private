import {
  FixedWindowRateLimiter,
  OwnerBootstrapError,
  bootstrapSecretMatches,
  createInitialOwner,
  isOwnerBootstrapEnabled,
  parseOwnerBootstrapPayload,
} from '../apps/api/src/admin/bootstrapOwner';

const validPayload = {
  email: 'owner@lousa.app',
  name: 'LOUSA Owner',
  password: 'LousaOwner#2026',
};

function ownerStore(options: { owner?: boolean; emailTaken?: boolean } = {}) {
  const created: any[] = [];
  const audit: any[] = [];
  const transaction = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    adminUser: {
      findFirst: jest.fn().mockResolvedValue(options.owner ? { id: 'owner-1' } : null),
      findUnique: jest.fn().mockResolvedValue(options.emailTaken ? { id: 'admin-1' } : null),
      create: jest.fn(async ({ data }: any) => {
        created.push(data);
        return { id: 'owner-1', email: data.email, role: data.role };
      }),
    },
    auditLog: { create: jest.fn(async ({ data }: any) => audit.push(data)) },
  };
  return {
    $transaction: async (callback: (tx: any) => Promise<any>) => callback(transaction),
    created,
    audit,
    transaction,
  };
}

describe('admin owner bootstrap', () => {
  test('is invisible unless both explicit bootstrap variables are present', () => {
    expect(isOwnerBootstrapEnabled({})).toBe(false);
    expect(isOwnerBootstrapEnabled({ ADMIN_BOOTSTRAP_ENABLED: 'true' })).toBe(false);
    expect(isOwnerBootstrapEnabled({ ADMIN_BOOTSTRAP_SECRET: 'secret' })).toBe(false);
    expect(isOwnerBootstrapEnabled({ ADMIN_BOOTSTRAP_ENABLED: 'true', ADMIN_BOOTSTRAP_SECRET: 'secret' })).toBe(true);
  });

  test('uses constant-time comparison and rejects a wrong secret', () => {
    expect(bootstrapSecretMatches('secret', 'secret')).toBe(true);
    expect(bootstrapSecretMatches('wrong', 'secret')).toBe(false);
    expect(bootstrapSecretMatches(undefined, 'secret')).toBe(false);
  });

  test('enforces the exact payload and password policy', () => {
    expect(parseOwnerBootstrapPayload(validPayload)).toEqual(validPayload);
    expect(() => parseOwnerBootstrapPayload({ ...validPayload, role: 'OWNER' })).toThrow('Only email');
    expect(() => parseOwnerBootstrapPayload({ ...validPayload, password: 'short' })).toThrow('security requirements');
  });

  test('allows only three attempts per fifteen minute window', () => {
    const limiter = new FixedWindowRateLimiter(3, 15 * 60_000);
    expect(limiter.consume('127.0.0.1', 1)).toBe(true);
    expect(limiter.consume('127.0.0.1', 2)).toBe(true);
    expect(limiter.consume('127.0.0.1', 3)).toBe(true);
    expect(limiter.consume('127.0.0.1', 4)).toBe(false);
    expect(limiter.consume('127.0.0.1', 15 * 60_000 + 2)).toBe(true);
  });

  test('creates one owner with a hash and an audit event without sensitive metadata', async () => {
    const store = ownerStore();
    const result = await createInitialOwner(store, validPayload, async () => 'salt:hash');
    expect(result).toEqual({ email: validPayload.email, role: 'OWNER' });
    expect(store.created[0]).toMatchObject({ role: 'OWNER', passwordHash: 'salt:hash' });
    expect(store.audit[0]).toMatchObject({ action: 'ADMIN_OWNER_BOOTSTRAPPED', metadata: { source: 'protected_bootstrap' } });
    expect(JSON.stringify(store.audit[0])).not.toContain(validPayload.password);
    expect(JSON.stringify(store.audit[0])).not.toContain(validPayload.email);
  });

  test('refuses a second owner and an existing administrator email', async () => {
    await expect(createInitialOwner(ownerStore({ owner: true }), validPayload, async () => 'hash'))
      .rejects.toMatchObject<Partial<OwnerBootstrapError>>({ code: 'OWNER_ALREADY_EXISTS' });
    await expect(createInitialOwner(ownerStore({ emailTaken: true }), validPayload, async () => 'hash'))
      .rejects.toMatchObject<Partial<OwnerBootstrapError>>({ code: 'ADMIN_EMAIL_ALREADY_EXISTS' });
  });
});
