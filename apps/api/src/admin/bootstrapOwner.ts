import { timingSafeEqual } from 'node:crypto';

export const OWNER_BOOTSTRAP_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtext('lousa_admin_owner_bootstrap'))";

export type OwnerBootstrapPayload = {
  email: string;
  name: string;
  password: string;
};

export class OwnerBootstrapError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function isOwnerBootstrapEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.ADMIN_BOOTSTRAP_ENABLED === 'true' && Boolean(environment.ADMIN_BOOTSTRAP_SECRET?.trim());
}

export function bootstrapSecretMatches(provided: unknown, expected: string) {
  if (typeof provided !== 'string' || !provided || !expected) return false;
  const actualBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function parseOwnerBootstrapPayload(input: unknown): OwnerBootstrapPayload {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new OwnerBootstrapError('BOOTSTRAP_PAYLOAD_INVALID', 'Request body must be an object.');
  }

  const record = input as Record<string, unknown>;
  const allowed = ['email', 'name', 'password'];
  if (Object.keys(record).length !== allowed.length || Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new OwnerBootstrapError('BOOTSTRAP_PAYLOAD_INVALID', 'Only email, name and password are accepted.');
  }

  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const password = typeof record.password === 'string' ? record.password : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new OwnerBootstrapError('BOOTSTRAP_EMAIL_INVALID', 'Email is invalid.');
  }
  if (name.length < 2 || name.length > 80) {
    throw new OwnerBootstrapError('BOOTSTRAP_NAME_INVALID', 'Name must contain 2 to 80 characters.');
  }
  if (
    password.length < 14 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new OwnerBootstrapError('BOOTSTRAP_PASSWORD_WEAK', 'Password does not meet the security requirements.');
  }

  return { email, name, password };
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly maxAttempts: number, private readonly windowMs: number) {}

  consume(key: string, timestamp = Date.now()) {
    const current = this.entries.get(key);
    if (!current || current.resetAt <= timestamp) {
      this.entries.set(key, { count: 1, resetAt: timestamp + this.windowMs });
      return true;
    }
    current.count += 1;
    return current.count <= this.maxAttempts;
  }
}

export async function createInitialOwner(
  prismaClient: any,
  payload: OwnerBootstrapPayload,
  hashPassword: (password: string) => Promise<string>,
) {
  return prismaClient.$transaction(async (transaction: any) => {
    // PostgreSQL transaction lock prevents two concurrent bootstrap requests from creating two owners.
    await transaction.$executeRawUnsafe(OWNER_BOOTSTRAP_LOCK_SQL);

    const existingOwner = await transaction.adminUser.findFirst({ where: { role: 'OWNER' }, select: { id: true } });
    if (existingOwner) throw new OwnerBootstrapError('OWNER_ALREADY_EXISTS', 'An owner already exists.');

    const existingEmail = await transaction.adminUser.findUnique({ where: { email: payload.email }, select: { id: true } });
    if (existingEmail) throw new OwnerBootstrapError('ADMIN_EMAIL_ALREADY_EXISTS', 'This email already belongs to an administrator.');

    const owner = await transaction.adminUser.create({
      data: {
        email: payload.email,
        name: payload.name,
        passwordHash: await hashPassword(payload.password),
        role: 'OWNER',
        isActive: true,
      },
      select: { id: true, email: true, role: true },
    });

    await transaction.auditLog.create({
      data: {
        actorId: owner.id,
        actorRole: 'OWNER',
        action: 'ADMIN_OWNER_BOOTSTRAPPED',
        entityType: 'AdminUser',
        entityId: owner.id,
        metadata: { source: 'protected_bootstrap' },
      },
    });

    return { email: owner.email, role: 'OWNER' as const };
  });
}
