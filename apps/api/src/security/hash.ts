import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

export async function hashSecret(secret: string, keyLength = 64) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(secret, salt, keyLength)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifySecret(secret: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = (await scrypt(secret, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function stableHash(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!domain) return '***';
  return `${name.slice(0, 2)}***@${domain}`;
}
