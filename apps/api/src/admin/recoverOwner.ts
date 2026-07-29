import { timingSafeEqual } from 'node:crypto';

export const OWNER_RECOVERY_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext('lousa_admin_owner_recovery'))";

export type OwnerRecoveryPayload = {
  // A blank email is allowed only for the protected emergency flow. The
  // transaction still requires exactly one OWNER before any state can change.
  email: string | null;
  password: string;
};

export class OwnerRecoveryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function isOwnerRecoveryEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.ADMIN_OWNER_RECOVERY_ENABLED === 'true' && Boolean(environment.ADMIN_OWNER_RECOVERY_SECRET?.trim());
}

export function recoverySecretMatches(provided: unknown, expected: string) {
  if (typeof provided !== 'string' || !provided || !expected) return false;
  const actualBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function parseOwnerRecoveryPayload(input: unknown): OwnerRecoveryPayload {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new OwnerRecoveryError('OWNER_RECOVERY_PAYLOAD_INVALID', 'Request body must be an object.');
  }

  const record = input as Record<string, unknown>;
  const allowed = ['email', 'password'];
  if (Object.keys(record).length !== allowed.length || Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new OwnerRecoveryError('OWNER_RECOVERY_PAYLOAD_INVALID', 'Only email and password are accepted.');
  }

  const emailInput = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const password = typeof record.password === 'string' ? record.password : '';
  if (emailInput && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput) || emailInput.length > 254)) {
    throw new OwnerRecoveryError('OWNER_RECOVERY_EMAIL_INVALID', 'Email is invalid.');
  }
  if (password.length < 14 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new OwnerRecoveryError('OWNER_RECOVERY_PASSWORD_WEAK', 'Password does not meet the security requirements.');
  }
  return { email: emailInput || null, password };
}

export async function recoverOwnerPassword(
  prismaClient: any,
  payload: OwnerRecoveryPayload,
  hashPassword: (password: string) => Promise<string>,
) {
  return prismaClient.$transaction(async (transaction: any) => {
    // This lock makes the permanent one-time check safe under concurrent requests.
    await transaction.$executeRawUnsafe(OWNER_RECOVERY_LOCK_SQL);
    const owners = await transaction.adminUser.findMany({ where: { role: 'OWNER' }, select: { id: true, email: true, role: true } });
    if (owners.length !== 1 || (payload.email && owners[0].email !== payload.email)) {
      throw new OwnerRecoveryError('OWNER_RECOVERY_NOT_ALLOWED', 'Owner recovery is not available.');
    }
    const owner = owners[0];
    const previousRecovery = await transaction.auditLog.findFirst({
      where: { action: 'ADMIN_OWNER_PASSWORD_RECOVERED', entityType: 'AdminUser', entityId: owner.id },
      select: { id: true },
    });
    if (previousRecovery) {
      throw new OwnerRecoveryError('OWNER_RECOVERY_ALREADY_USED', 'Owner recovery was already used.');
    }

    await transaction.adminUser.update({
      where: { id: owner.id },
      data: { passwordHash: await hashPassword(payload.password), isActive: true },
    });
    await transaction.adminSession.updateMany({
      where: { adminUserId: owner.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await transaction.auditLog.create({
      data: {
        actorId: owner.id,
        actorRole: 'OWNER',
        action: 'ADMIN_OWNER_PASSWORD_RECOVERED',
        entityType: 'AdminUser',
        entityId: owner.id,
        metadata: { source: 'protected_one_time_recovery' },
      },
    });
    return { email: owner.email, role: 'OWNER' as const };
  });
}
