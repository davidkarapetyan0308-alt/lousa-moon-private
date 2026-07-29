import {
  OwnerRecoveryError,
  isOwnerRecoveryEnabled,
  parseOwnerRecoveryPayload,
  recoverOwnerPassword,
  recoverySecretMatches,
} from '../apps/api/src/admin/recoverOwner';

const validPayload = { email: 'admin@lousa.app', password: 'LousaOwner#2026' };

function recoveryStore(options: { ownerEmail?: string; ownerCount?: number; recovered?: boolean } = {}) {
  const audit: any[] = [];
  const sessions: any[] = [];
  const changes: any[] = [];
  const ownerCount = options.ownerCount ?? 1;
  const transaction = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    adminUser: {
      findMany: jest.fn().mockResolvedValue(Array.from({ length: ownerCount }, (_, index) => ({ id: `owner-${index}`, email: options.ownerEmail ?? 'admin@lousa.app', role: 'OWNER' }))),
      update: jest.fn(async ({ data }: any) => changes.push(data)),
    },
    adminSession: { updateMany: jest.fn(async ({ data }: any) => sessions.push(data)) },
    auditLog: {
      findFirst: jest.fn().mockResolvedValue(options.recovered ? { id: 'audit-1' } : null),
      create: jest.fn(async ({ data }: any) => audit.push(data)),
    },
  };
  return { $transaction: async (callback: (tx: any) => Promise<any>) => callback(transaction), transaction, audit, sessions, changes };
}

describe('admin owner recovery', () => {
  test('is invisible unless both explicit recovery variables are present', () => {
    expect(isOwnerRecoveryEnabled({})).toBe(false);
    expect(isOwnerRecoveryEnabled({ ADMIN_OWNER_RECOVERY_ENABLED: 'true' })).toBe(false);
    expect(isOwnerRecoveryEnabled({ ADMIN_OWNER_RECOVERY_SECRET: 'secret' })).toBe(false);
    expect(isOwnerRecoveryEnabled({ ADMIN_OWNER_RECOVERY_ENABLED: 'true', ADMIN_OWNER_RECOVERY_SECRET: 'secret' })).toBe(true);
  });

  test('uses constant-time comparison and validates exact secure payload', () => {
    expect(recoverySecretMatches('secret', 'secret')).toBe(true);
    expect(recoverySecretMatches('wrong', 'secret')).toBe(false);
    expect(parseOwnerRecoveryPayload(validPayload)).toEqual(validPayload);
    expect(parseOwnerRecoveryPayload({ ...validPayload, email: '' })).toEqual({ ...validPayload, email: null });
    expect(() => parseOwnerRecoveryPayload({ ...validPayload, role: 'OWNER' })).toThrow('Only email');
    expect(() => parseOwnerRecoveryPayload({ ...validPayload, password: 'weak' })).toThrow('security requirements');
  });

  test('changes only the sole matching owner, revokes sessions, and does not audit secrets', async () => {
    const store = recoveryStore();
    const result = await recoverOwnerPassword(store, validPayload, async () => 'salt:hash');
    expect(result).toEqual({ email: validPayload.email, role: 'OWNER' });
    expect(store.changes[0]).toMatchObject({ passwordHash: 'salt:hash', isActive: true });
    expect(store.sessions).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ action: 'ADMIN_OWNER_PASSWORD_RECOVERED', metadata: { source: 'protected_one_time_recovery' } });
    expect(JSON.stringify(store.audit[0])).not.toContain(validPayload.password);
    expect(JSON.stringify(store.audit[0])).not.toContain(validPayload.email);
  });

  test('allows a blank email only when there is exactly one owner', async () => {
    const payload = { ...validPayload, email: null };
    await expect(recoverOwnerPassword(recoveryStore({ ownerEmail: 'unknown@lousa.app' }), payload, async () => 'hash'))
      .resolves.toEqual({ email: 'unknown@lousa.app', role: 'OWNER' });
    await expect(recoverOwnerPassword(recoveryStore({ ownerCount: 2 }), payload, async () => 'hash'))
      .rejects.toMatchObject<Partial<OwnerRecoveryError>>({ code: 'OWNER_RECOVERY_NOT_ALLOWED' });
  });

  test('refuses a non-matching owner, multiple owners, and a repeated recovery', async () => {
    await expect(recoverOwnerPassword(recoveryStore({ ownerEmail: 'other@lousa.app' }), validPayload, async () => 'hash'))
      .rejects.toMatchObject<Partial<OwnerRecoveryError>>({ code: 'OWNER_RECOVERY_NOT_ALLOWED' });
    await expect(recoverOwnerPassword(recoveryStore({ ownerCount: 2 }), validPayload, async () => 'hash'))
      .rejects.toMatchObject<Partial<OwnerRecoveryError>>({ code: 'OWNER_RECOVERY_NOT_ALLOWED' });
    await expect(recoverOwnerPassword(recoveryStore({ recovered: true }), validPayload, async () => 'hash'))
      .rejects.toMatchObject<Partial<OwnerRecoveryError>>({ code: 'OWNER_RECOVERY_ALREADY_USED' });
  });
});
