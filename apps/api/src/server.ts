import 'dotenv/config';

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { OAuth2Client } from 'google-auth-library';

import { calculateCyclePrediction } from '../../../src/services/cyclePrediction';
import { CycleValidationError, validateAndNormalizePeriodRecord, validateCycleObservationDate } from '../../../src/domain/cycleValidation';
import { findAllergenConflicts, hasUnrecognizedAllergens } from '../../../src/services/allergenSafety';
import { canTransitionDelivery } from '../../../packages/shared/src';
import { checkGyumriDeliveryZone } from '../../../src/services/deliveryZone';
import { canExposeDevOtp, getEmailDeliveryMode, isEmailDeliveryConfigured, sendVerificationEmail } from './emailService';
import { loadApiEnv } from './config/env';
import { prisma } from './db/prisma';
import { RedisLite } from './db/redis';
import { hashSecret, stableHash, verifySecret } from './security/hash';
import { FirebaseAdminNotConfiguredError, verifyFirebaseIdToken } from './auth/firebaseAdmin';

const env = loadApiEnv();
const redis = new RedisLite(env.redisUrl);
const googleClient = new OAuth2Client(env.googleWebClientId);
const allowedGoogleAudiences = [env.googleWebClientId, env.googleAndroidClientId].filter(Boolean);
const jsonLimitBytes = Number(process.env.JSON_BODY_LIMIT_BYTES || 262_144);
const accessTtlMs = 15 * 60_000;
const refreshTtlMs = 30 * 24 * 60 * 60_000;
const quoteTtlMs = 15 * 60_000;

type JsonObject = Record<string, any>;

type AuthedRequest = IncomingMessage & { userId?: string; requestId?: string };

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: JsonObject) {
    super(message);
  }
}

const DEMO_EMAIL = 'demo@lousa.app';
const DEMO_PASSWORD = 'Lousa2026';

function route(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}

function now() { return new Date(); }
function minutes(n: number) { return n * 60_000; }
function future(ms: number) { return new Date(Date.now() + ms); }
function lowerEmail(value: unknown) { return String(value || '').trim().toLowerCase(); }
function language(value: unknown): 'ru' | 'en' | 'hy' { return value === 'en' || value === 'hy' ? value : 'ru'; }
function str(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max); }
function optionalStr(value: unknown, max = 500) { const v = str(value, max); return v || null; }
function int(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function bool(value: unknown) { return value === true || value === 'true'; }
function syncMeta(body: any) {
  const raw = body?._sync && typeof body._sync === 'object' ? body._sync : null;
  if (!raw) return null;
  const expected = raw.expectedServerRevision;
  return {
    operationId: optionalStr(raw.operationId, 120),
    localRevision: Number.isFinite(Number(raw.localRevision)) ? Number(raw.localRevision) : null,
    expectedServerRevision: expected === null || expected === undefined || expected === '' ? null : Number(expected),
  };
}
function assertExpectedRevision(existing: any, meta: ReturnType<typeof syncMeta>) {
  if (!existing || !meta || meta.expectedServerRevision === null) return;
  const actual = Number(existing.revision || 1);
  if (!Number.isFinite(meta.expectedServerRevision) || meta.expectedServerRevision !== actual) {
    throw new ApiError(409, 'REVISION_CONFLICT', 'Запись была изменена на другом устройстве.', { expected: meta.expectedServerRevision, actual });
  }
}

function generateCode() {
  const testCode = process.env.TEST_VERIFICATION_CODE;
  if (env.appEnv === 'test' && testCode && /^\d{6}$/.test(testCode)) return testCode;
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function safeEmailDeliveryPayload(result: { provider?: string; messageId?: string; devCode?: string } | null, code: string) {
  const provider = result?.provider || getEmailDeliveryMode();
  const delivery = {
    provider,
    configured: provider === 'resend' || provider === 'smtp',
    messageId: result?.messageId || null,
    devMode: provider === 'console-dev',
  };
  return {
    emailDelivery: delivery,
    ...(canExposeDevOtp() ? { devCode: result?.devCode || code } : {}),
  };
}

function emailDeliveryFailure() {
  return new ApiError(502, 'EMAIL_DELIVERY_FAILED', 'Не удалось отправить код на почту. Проверьте настройки email-провайдера на сервере.');
}

function normalizePhone(value: unknown) {
  const raw = String(value || '').trim().replace(/[\s().-]/g, '');
  const normalized = raw.startsWith('00')
    ? `+${raw.slice(2)}`
    : raw.startsWith('+')
      ? raw
      : raw.startsWith('0') && raw.length >= 8 && raw.length <= 10
        ? `+374${raw.slice(1)}`
        : raw.startsWith('374')
          ? `+${raw}`
          : `+${raw}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new ApiError(400, 'PHONE_INVALID', 'Введите номер телефона в международном формате, например +374XXXXXXXX.');
  return normalized;
}

function phoneLocalEmail(phone: string) {
  const digest = createHash('sha256').update(phone).digest('hex').slice(0, 24);
  return `phone_${digest}@phone.lousa.local`;
}

function canExposeDevSmsOtp() {
  return env.appEnv !== 'production' && process.env.ALLOW_DEV_OTP_RESPONSE === 'true';
}

function safeSmsDeliveryPayload(result: { provider?: string; messageId?: string; devCode?: string } | null, code: string) {
  const provider = result?.provider || env.smsProvider || 'console';
  const devMode = provider === 'console-dev' || provider === 'mock-dev';
  return {
    smsDelivery: {
      provider,
      configured: provider === 'twilio' || provider === 'messagebird',
      messageId: result?.messageId || null,
      devMode,
    },
    ...(canExposeDevSmsOtp() ? { devCode: result?.devCode || code } : {}),
  };
}

function smsDeliveryFailure() {
  return new ApiError(502, 'SMS_DELIVERY_FAILED', 'Не удалось отправить SMS-код. Проверьте настройки SMS-провайдера на сервере.');
}

function smsText(code: string) {
  return `LOUSA MOON verification code: ${code}. Do not share this code.`;
}

async function sendWithTwilio(phone: string, code: string) {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFrom) throw smsDeliveryFailure();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}/Messages.json`;
  const body = new URLSearchParams({ To: phone, From: env.twilioFrom, Body: smsText(code) });
  const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[twilio] sms failed', { status: response.status, code: (payload as any)?.code, message: (payload as any)?.message });
    throw smsDeliveryFailure();
  }
  return { provider: 'twilio', messageId: String((payload as any)?.sid || '') || undefined };
}

async function sendWithMessageBird(phone: string, code: string) {
  if (!env.messagebirdApiKey || !env.messagebirdOriginator) throw smsDeliveryFailure();
  const response = await fetch('https://rest.messagebird.com/messages', {
    method: 'POST',
    headers: { Authorization: `AccessKey ${env.messagebirdApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ originator: env.messagebirdOriginator, recipients: [phone.replace(/^\+/, '')], body: smsText(code) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[messagebird] sms failed', { status: response.status, errors: (payload as any)?.errors });
    throw smsDeliveryFailure();
  }
  return { provider: 'messagebird', messageId: String((payload as any)?.id || '') || undefined };
}

async function sendPhoneOtp(phone: string, code: string) {
  const provider = env.smsProvider || 'console';
  if (provider === 'console' || provider === 'mock') {
    if (env.appEnv === 'production') throw smsDeliveryFailure();
    console.info(`[dev-sms-fallback] phone ${phone}: ${code}`);
    return { provider: `${provider}-dev`, devCode: code };
  }
  if (provider === 'twilio') return sendWithTwilio(phone, code);
  if (provider === 'messagebird') return sendWithMessageBird(phone, code);
  throw new ApiError(400, 'SMS_PROVIDER_REQUIRED', 'SMS-вход не настроен для этой сборки.');
}

function getBearer(req: IncomingMessage) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

function setCommonHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || '';
  const allowAll = env.corsOrigins.includes('*') && env.appEnv !== 'production';
  const allowedOrigin = allowAll ? (origin || '*') : env.corsOrigins.includes(origin) ? origin : env.corsOrigins[0] || '';
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  if (origin && allowedOrigin !== '*') res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-Request-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Request-Id', (req as AuthedRequest).requestId || '');
}

function json(req: IncomingMessage, res: ServerResponse, status: number, data: unknown) {
  setCommonHeaders(req, res);
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

function errorResponse(req: IncomingMessage, res: ServerResponse, error: unknown) {
  const requestId = (req as AuthedRequest).requestId || randomUUID();
  if (error instanceof ApiError) {
    json(req, res, error.status, { error: { code: error.code, message: error.message, details: error.details, requestId } });
    return;
  }
  const message = env.appEnv === 'production' ? 'Server error.' : error instanceof Error ? error.message : 'Unknown server error.';
  json(req, res, 500, { error: { code: 'SERVER_ERROR', message, requestId } });
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > jsonLimitBytes) {
        reject(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new ApiError(400, 'INVALID_JSON', 'Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

async function rateLimit(key: string, max = 20, windowSeconds = 60) {
  if (!env.redisUrl) {
    if (env.requireRedis) throw new ApiError(503, 'REDIS_REQUIRED', 'Rate limiting service is not configured.');
    return;
  }
  const count = await redis.incrWithExpire(`rl:${key}`, windowSeconds);
  if (count > max) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
}

async function requireUser(req: IncomingMessage) {
  const accessToken = getBearer(req);
  if (!accessToken) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  const hash = stableHash(accessToken, env.jwtAccessSecret);
  const session = await (prisma as any).session.findFirst({ where: { refreshTokenHash: `access:${hash}`, revokedAt: null, expiresAt: { gt: now() } } });
  if (!session) throw new ApiError(401, 'UNAUTHORIZED', 'Session expired.');
  const user = await (prisma as any).user.findFirst({ where: { id: session.userId, deletedAt: null, status: 'active' } });
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'User not found.');
  return user;
}

async function issueSession(userId: string, req?: IncomingMessage) {
  const accessToken = randomUUID() + '.' + randomUUID();
  const refreshToken = randomUUID() + '.' + randomUUID();
  const ip = String(req?.headers['x-forwarded-for'] || req?.socket.remoteAddress || '');
  await (prisma as any).session.createMany({ data: [
    {
      userId,
      refreshTokenHash: `access:${stableHash(accessToken, env.jwtAccessSecret)}`,
      deviceName: String(req?.headers['user-agent'] || '').slice(0, 180) || null,
      ipHash: ip ? stableHash(ip, env.jwtAccessSecret) : null,
      expiresAt: future(accessTtlMs),
    },
    {
      userId,
      refreshTokenHash: `refresh:${stableHash(refreshToken, env.jwtRefreshSecret)}`,
      deviceName: String(req?.headers['user-agent'] || '').slice(0, 180) || null,
      ipHash: ip ? stableHash(ip, env.jwtRefreshSecret) : null,
      expiresAt: future(refreshTtlMs),
    },
  ] });
  return { accessToken, refreshToken };
}

function userPayload(user: any) {
  return { id: user.id, email: user.email, phone: user.phone ?? null, name: user.name, avatarUri: user.avatarUri ?? null };
}

async function sessionPayload(user: any, req: IncomingMessage, extra: JsonObject = {}) {
  const tokens = await issueSession(user.id, req);
  return { user: userPayload(user), ...tokens, demo: user.email === DEMO_EMAIL, ...extra };
}


function firebaseSyntheticEmail(uid: string) {
  const digest = createHash('sha256').update(uid).digest('hex').slice(0, 24);
  return `firebase_${digest}@firebase.lousa.local`;
}

async function sessionFromFirebaseIdToken(idToken: string, req: IncomingMessage, profile: JsonObject = {}) {
  let decoded: any;
  try {
    decoded = await verifyFirebaseIdToken(env, idToken);
  } catch (error) {
    if (error instanceof FirebaseAdminNotConfiguredError) {
      throw new ApiError(503, 'FIREBASE_ADMIN_NOT_CONFIGURED', 'Firebase Admin SDK не настроен на backend. Добавьте FIREBASE_SERVICE_ACCOUNT_JSON или service account env.');
    }
    console.error('[firebase-auth] verify id token failed', error);
    throw new ApiError(401, 'FIREBASE_ID_TOKEN_INVALID', 'Firebase session could not be verified.');
  }
  if (!decoded?.uid) throw new ApiError(401, 'FIREBASE_ID_TOKEN_INVALID', 'Firebase token has no uid.');

  const firebaseUid = String(decoded.uid);
  const email = decoded.email ? lowerEmail(decoded.email) : '';
  const phone = decoded.phone_number ? normalizePhone(decoded.phone_number) : null;
  const provider = decoded.firebase?.sign_in_provider || str(profile.provider || 'firebase', 60) || 'firebase';
  if (provider === 'password' && !decoded.email_verified) {
    throw new ApiError(403, 'FIREBASE_EMAIL_NOT_VERIFIED', 'Confirm your email before creating a LOUSA session.');
  }
  const displayName = str(profile.name || decoded.name || (email ? email.split('@')[0] : 'LOUSA'), 120) || 'LOUSA';
  const avatarUri = optionalStr(decoded.picture, 500);

  const identity = await (prisma as any).authIdentity.findUnique({
    where: { provider_providerSubject: { provider: 'firebase', providerSubject: firebaseUid } },
    include: { user: true },
  });
  let user = identity?.user || null;
  let isNewUser = false;

  if (!user && email) user = await (prisma as any).user.findUnique({ where: { email } });
  if (!user && phone) user = await (prisma as any).user.findFirst({ where: { phone, deletedAt: null } });

  if (!user) {
    user = await (prisma as any).user.create({
      data: {
        email: email || firebaseSyntheticEmail(firebaseUid),
        emailVerifiedAt: decoded.email_verified ? now() : null,
        phone,
        name: displayName,
        language: language(profile.language),
        status: 'active',
      },
    });
    isNewUser = true;
  } else {
    const updates: JsonObject = { status: user.status === 'pending' ? 'active' : user.status };
    if (decoded.email_verified && !user.emailVerifiedAt) updates.emailVerifiedAt = now();
    if (phone && !user.phone) updates.phone = phone;
    if (displayName && (!user.name || user.name === 'LOUSA')) updates.name = displayName;
    if (Object.keys(updates).length) user = await (prisma as any).user.update({ where: { id: user.id }, data: updates });
  }

  await (prisma as any).authIdentity.upsert({
    where: { provider_providerSubject: { provider: 'firebase', providerSubject: firebaseUid } },
    update: { providerEmail: email || null },
    create: { userId: user.id, provider: 'firebase', providerSubject: firebaseUid, providerEmail: email || null },
  });
  await (prisma as any).authIdentity.upsert({
    where: { provider_providerSubject: { provider: `firebase:${provider}`, providerSubject: firebaseUid } },
    update: { providerEmail: email || null },
    create: { userId: user.id, provider: `firebase:${provider}`, providerSubject: firebaseUid, providerEmail: email || null },
  }).catch(() => null);

  return sessionPayload(user, req, { isNewUser, firebaseUid, authProvider: 'firebase' });
}

async function ensureDemoUser() {
  const existing = await (prisma as any).user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) return existing;
  return (prisma as any).user.create({ data: {
    email: DEMO_EMAIL,
    emailVerifiedAt: now(),
    passwordHash: await hashSecret(DEMO_PASSWORD),
    name: 'Ани',
    language: 'ru',
    status: 'active',
  } });
}

const DEFAULT_PRODUCT_METADATA: Record<string, Record<string, unknown>> = {
  'pad-day': { allergens: [], materials: ['cotton', 'cellulose'], fragranceFree: true },
  'pad-night': { allergens: [], materials: ['cotton', 'cellulose'], fragranceFree: true },
  'tampon-regular': { allergens: [], materials: ['cotton'], fragranceFree: true },
  'tampon-non-applicator': { allergens: [], materials: ['cotton'], fragranceFree: true },
  'menstrual-cup': { allergens: [], materials: ['medical_grade_silicone'], fragranceFree: true },
  'menstrual-disc': { allergens: [], materials: ['medical_grade_silicone'], fragranceFree: true },
  liner: { allergens: [], materials: ['cotton', 'cellulose'], fragranceFree: true },
  wipes: { allergens: ['fragrance'], materials: ['nonwoven'], fragranceFree: false },
  tea: { allergens: ['herbs'], ingredients: ['herbal_blend'] },
  chocolate: { allergens: ['milk', 'nuts'], ingredients: ['cocoa', 'milk'], requiresLabelReview: true },
  'heat-pad': { allergens: [], materials: ['iron_powder', 'activated_carbon'] },
};

async function ensureCatalog() {
  const count = await (prisma as any).productCatalogItem.count();
  let zone = await (prisma as any).deliveryZone.findFirst({ where: { name: 'Gyumri Standard' } });
  if (!zone) {
    zone = await (prisma as any).deliveryZone.create({ data: {
      name: 'Gyumri Standard', type: 'radius', centerLat: 40.7894, centerLng: 43.8475,
      radiusKm: env.deliveryZoneRadiusKm, baseFeeMinor: 0, currency: 'AMD', isActive: true,
    } });
  }
  if (count > 0) {
    for (const [sku, metadata] of Object.entries(DEFAULT_PRODUCT_METADATA)) {
      const existing = await (prisma as any).productCatalogItem.findUnique({ where: { sku } }).catch(() => null);
      if (existing && !existing.metadata) {
        await (prisma as any).productCatalogItem.update({ where: { sku }, data: { metadata } }).catch(() => null);
      }
    }
    return;
  }
  const items = [
    ['pad-day', 'Дневные прокладки', 'Day pads', 'Ցերեկային միջադիրներ', 'menstrual', 25000, 500],
    ['pad-night', 'Ночные прокладки', 'Night pads', 'Գիշերային միջադիրներ', 'menstrual', 32000, 300],
    ['tampon-regular', 'Тампоны с аппликатором', 'Applicator tampons', 'Ապլիկատորով տամպոններ', 'menstrual', 36000, 300],
    ['tampon-non-applicator', 'Тампоны без аппликатора', 'Non-applicator tampons', 'Տամպոններ առանց ապլիկատորի', 'menstrual', 33000, 300],
    ['menstrual-cup', 'Менструальная чаша', 'Menstrual cup', 'Դաշտանային բաժակ', 'menstrual', 520000, 60],
    ['menstrual-disc', 'Менструальный диск', 'Menstrual disc', 'Դաշտանային սկավառակ', 'menstrual', 580000, 60],
    ['liner', 'Ежедневные прокладки', 'Liners', 'Ամենօրյա միջադիրներ', 'menstrual', 18000, 500],
    ['wipes', 'Деликатные салфетки', 'Gentle wipes', 'Նուրբ անձեռոցիկներ', 'care', 70000, 120],
    ['tea', 'Травяной чай', 'Herbal tea', 'Բուսական թեյ', 'wellness', 90000, 100],
    ['chocolate', 'Шоколад', 'Chocolate', 'Շոկոլադ', 'food', 80000, 100],
    ['heat-pad', 'Грелка', 'Heat pad', 'Տաքացնող փաթեթ', 'wellness', 190000, 80],
  ];
  const created: Record<string, string> = {};
  for (const [sku, ru, en, hy, category, price, stock] of items as any[]) {
    const product = await (prisma as any).productCatalogItem.create({ data: { sku, nameRu: ru, nameEn: en, nameHy: hy, category, isActive: true, metadata: DEFAULT_PRODUCT_METADATA[sku] || {} } });
    created[sku] = product.id;
    await (prisma as any).productPrice.create({ data: { productId: product.id, amountMinor: price, currency: 'AMD', priceVersion: 1 } });
    await (prisma as any).inventoryItem.create({ data: { productId: product.id, availableQuantity: stock, reservedQuantity: 0, warehouseId: 'gyumri-main' } });
  }
  const plans = [
    ['essential', 'Essential', 1290000, 16, [['pad-day', 12], ['pad-night', 4], ['wipes', 1]]],
    ['comfort', 'Comfort', 1690000, 24, [['pad-day', 16], ['pad-night', 6], ['liner', 10], ['wipes', 1], ['tea', 1]]],
    ['ritual', 'Moon Ritual', 2490000, 32, [['pad-day', 18], ['pad-night', 8], ['liner', 14], ['wipes', 1], ['tea', 1], ['chocolate', 1], ['heat-pad', 1]]],
  ];
  for (const [code, name, basePriceMinor, includedUnits, includes] of plans as any[]) {
    const plan = await (prisma as any).boxPlan.create({ data: { code, name, basePriceMinor, includedUnits, currency: 'AMD', isActive: true } });
    for (const [sku, includedQuantity] of includes) {
      await (prisma as any).boxPlanIncludedItem.create({ data: { planId: plan.id, productId: created[sku], includedQuantity } });
    }
  }
}

function periodFromDb(record: any) {
  const data = record.data || {};
  return {
    id: record.id,
    startDate: record.startDate?.toISOString?.().slice(0, 10) || data.startDate,
    endDate: record.endDate?.toISOString?.().slice(0, 10) || null,
    confirmed: record.confirmed,
    source: record.source,
    needsReview: record.needsReview,
    ...data,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString?.() || null,
    serverRevision: Number(record.revision || 1),
  };
}

function cycleObservationFromDb(record: any) {
  return {
    id: record.id,
    date: record.date?.toISOString?.().slice(0, 10) || String(record.date || '').slice(0, 10),
    type: record.type,
    source: record.source || 'user',
    periodRecordId: record.periodRecordId || null,
    ...(record.data || {}),
    createdAt: record.createdAt?.toISOString?.() || String(record.createdAt || ''),
    updatedAt: record.updatedAt?.toISOString?.() || String(record.updatedAt || ''),
    deletedAt: record.deletedAt?.toISOString?.() || null,
    serverRevision: Number(record.revision || 1),
  };
}

function orderFromDb(order: any) {
  const quote = order.quote || {};
  const snapshot = quote.selectedSnapshot || {};
  const substitutionPolicy = snapshot.substitutionPolicy || snapshot.preferences?.substitutionPolicy || 'none';
  const items = (order.items || []).map((item: any) => ({
    id: item.id,
    sku: item.product?.sku,
    name: item.product?.nameRu || item.product?.nameEn || 'LOUSA item',
    category: item.product?.category || 'menstrual',
    quantity: item.quantity,
    reason: item.includedQuantity > 0 ? 'Включено в тариф' : 'Дополнительный товар',
    replaceable: substitutionPolicy === 'same_category',
    unitPriceMinor: item.unitPriceMinor,
  }));
  return {
    id: order.id,
    subscriptionId: null,
    cyclePredictionSnapshot: null,
    preferenceSnapshot: null,
    plannedDeliveryDate: null,
    deliveryRange: { earliest: null, latest: null },
    preparationDeadline: null,
    customizationDeadline: null,
    status: String(order.status || 'awaiting_payment').toLowerCase(),
    paymentStatus: String(order.paymentStatus || 'pending').toLowerCase(),
    currency: order.currency,
    totalMinor: order.totalMinor,
    version: 9,
    items,
    statusHistory: [{ status: String(order.status || 'awaiting_payment').toLowerCase(), at: order.createdAt.toISOString(), source: 'system' }],
    deliveryAddressSnapshot: order.deliverySnapshot || snapshot.deliveryAddress || null,
    demo: env.paymentProvider === 'sandbox',
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

async function getActivePrices(productIds: string[]) {
  const prices = await (prisma as any).productPrice.findMany({
    where: { productId: { in: productIds }, currency: 'AMD', OR: [{ validUntil: null }, { validUntil: { gt: now() } }] },
    orderBy: [{ productId: 'asc' }, { validFrom: 'desc' }],
  });
  const map = new Map<string, any>();
  for (const price of prices) if (!map.has(price.productId)) map.set(price.productId, price);
  return map;
}

async function calculateServerQuote(userId: string, body: any) {
  await ensureCatalog();
  const planIdOrCode = str(body.planId || body.plan || 'comfort', 80);
  const plan = await (prisma as any).boxPlan.findFirst({
    where: { isActive: true, OR: [{ id: planIdOrCode }, { code: planIdOrCode }] },
    include: { includedItems: { include: { product: true } } },
  });
  if (!plan) throw new ApiError(400, 'PLAN_NOT_FOUND', 'Тариф не найден.');

  const selected = Array.isArray(body.selectedItems) ? body.selectedItems : [];
  const preferences = body.preferences && typeof body.preferences === 'object' ? body.preferences : {};
  const substitutionPolicy = preferences.allowSubstitutions === true && preferences.substitutionPolicy === 'same_category'
    ? 'same_category'
    : 'none';
  const selectedByProduct = new Map<string, number>();
  for (const rawItem of selected) {
    const productIdOrSku = str(rawItem.productId || rawItem.sku || rawItem.id, 120);
    const qty = int(rawItem.quantity, 0);
    if (!productIdOrSku || qty < 0 || qty > 200) throw new ApiError(400, 'INVALID_QUANTITY', 'Проверьте количество товаров.');
    const product = await (prisma as any).productCatalogItem.findFirst({ where: { OR: [{ id: productIdOrSku }, { sku: productIdOrSku }], isActive: true } });
    if (!product) throw new ApiError(400, 'PRODUCT_NOT_FOUND', 'Товар не найден.');
    selectedByProduct.set(product.id, (selectedByProduct.get(product.id) || 0) + qty);
  }
  const selectedHasMenstrual = [...selectedByProduct.keys()].some((productId) =>
    plan.includedItems.some((included: any) => included.productId === productId && included.product?.category === 'menstrual'),
  ) || selected.some((rawItem: any) => ['pad-day', 'pad-night', 'tampon-regular', 'tampon-non-applicator', 'menstrual-cup', 'menstrual-disc'].includes(String(rawItem.sku || rawItem.id || '')));
  for (const included of plan.includedItems) {
    const isMenstrual = included.product?.category === 'menstrual';
    if (isMenstrual && selectedHasMenstrual) continue;
    if (!selectedByProduct.has(included.productId)) selectedByProduct.set(included.productId, included.includedQuantity);
  }

  const productIds = [...selectedByProduct.keys()];
  const [products, inventories] = await Promise.all([
    (prisma as any).productCatalogItem.findMany({ where: { id: { in: productIds } } }),
    (prisma as any).inventoryItem.findMany({ where: { productId: { in: productIds }, warehouseId: 'gyumri-main' } }),
  ]);
  const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));
  const inventoryMap = new Map<string, any>(inventories.map((i: any) => [i.productId, i]));
  const priceMap = await getActivePrices(productIds);
  const includeMap = new Map<string, number>(plan.includedItems.map((item: any) => [item.productId, item.includedQuantity]));
  const validationErrors: string[] = [];
  const warnings: string[] = [];
  const quoteItems: any[] = [];
  let addOnTotalMinor = 0;

  let remainingMenstrualAllowance = plan.includedUnits;
  for (const [productId, quantity] of selectedByProduct) {
    const product = productMap.get(productId);
    const includedQuantity = product?.category === 'menstrual' && selectedHasMenstrual
      ? Math.min(quantity, Math.max(0, remainingMenstrualAllowance))
      : Math.min(quantity, includeMap.get(productId) || 0);
    if (product?.category === 'menstrual' && selectedHasMenstrual) remainingMenstrualAllowance -= includedQuantity;
    const addOnQuantity = Math.max(0, quantity - includedQuantity);
    const price = priceMap.get(productId);
    const unitPriceMinor = addOnQuantity > 0 ? (price?.amountMinor || 0) : 0;
    const totalMinor = addOnQuantity * unitPriceMinor;
    const inventory = inventoryMap.get(productId);
    if (!inventory || inventory.availableQuantity - inventory.reservedQuantity < quantity) validationErrors.push(`OUT_OF_STOCK:${productMap.get(productId)?.sku || productId}`);
    const allergenConflicts = findAllergenConflicts(preferences, product?.metadata);
    if (allergenConflicts.length) validationErrors.push(`ALLERGEN_CONFLICT:${product?.sku || productId}:${allergenConflicts.join('+')}`);
    addOnTotalMinor += totalMinor;
    quoteItems.push({ productId, quantity, includedQuantity, addOnQuantity, unitPriceMinor, totalMinor });
  }

  let deliveryFeeMinor = 0;
  let deliveryZoneId: string | null = null;
  let deliveryAddress: any = null;
  if (body.deliveryAddressId) {
    deliveryAddress = await (prisma as any).deliveryAddress.findFirst({ where: { id: String(body.deliveryAddressId), userId, validationStatus: 'verified' } });
    if (!deliveryAddress) validationErrors.push('DELIVERY_ADDRESS_NOT_CONFIRMED');
    else {
      const zone = await checkDeliveryZone(deliveryAddress.latitude, deliveryAddress.longitude);
      if (!zone.available) validationErrors.push('OUTSIDE_DELIVERY_ZONE');
      deliveryFeeMinor = 0;
      deliveryZoneId = zone.zoneId;
    }
  } else {
    validationErrors.push('DELIVERY_ADDRESS_REQUIRED');
  }

  if (hasUnrecognizedAllergens(preferences)) warnings.push('ALLERGEN_MANUAL_REVIEW_REQUIRED');
  if (substitutionPolicy === 'none') warnings.push('SUBSTITUTIONS_DISABLED');
  const totalMinor = plan.basePriceMinor + addOnTotalMinor + deliveryFeeMinor;
  const quote = await (prisma as any).orderQuote.create({
    data: {
      userId,
      planId: plan.id,
      deliveryAddressId: deliveryAddress?.id || null,
      deliveryZoneId,
      basePriceMinor: plan.basePriceMinor,
      includedTotalMinor: 0,
      addOnTotalMinor,
      deliveryFeeMinor,
      discountMinor: 0,
      totalMinor,
      currency: 'AMD',
      validationErrors,
      warnings: [...warnings, ...(validationErrors.length ? ['QUOTE_HAS_VALIDATION_ERRORS'] : [])],
      selectedSnapshot: {
        selectedItems: selected,
        planCode: plan.code,
        preferences,
        substitutionPolicy,
        deliveryAddress: deliveryAddress ? safeDeliveryAddressSnapshot(deliveryAddress) : null,
      },
      expiresAt: future(quoteTtlMs),
      items: { create: quoteItems },
    },
    include: { items: { include: { product: true } }, plan: true, deliveryAddress: true },
  });
  return formatQuote(quote);
}

function formatQuote(quote: any) {
  return {
    quoteId: quote.id,
    expiresAt: quote.expiresAt.toISOString(),
    currency: quote.currency,
    basePriceMinor: quote.basePriceMinor,
    includedItems: (quote.items || []).filter((item: any) => item.includedQuantity > 0).map((item: any) => ({
      productId: item.productId,
      sku: item.product?.sku,
      name: item.product?.nameRu || item.product?.nameEn,
      quantity: item.includedQuantity,
    })),
    addOns: (quote.items || []).filter((item: any) => item.addOnQuantity > 0).map((item: any) => ({
      productId: item.productId,
      sku: item.product?.sku,
      name: item.product?.nameRu || item.product?.nameEn,
      quantity: item.addOnQuantity,
      unitPriceMinor: item.unitPriceMinor,
      totalMinor: item.totalMinor,
    })),
    addOnTotalMinor: quote.addOnTotalMinor,
    deliveryFeeMinor: quote.deliveryFeeMinor,
    discountMinor: quote.discountMinor,
    totalMinor: quote.totalMinor,
    validationErrors: quote.validationErrors || [],
    warnings: quote.warnings || [],
  };
}

async function checkDeliveryZone(latitude: number, longitude: number, planCode: string | null = null) {
  const zone = await (prisma as any).deliveryZone.findFirst({ where: { isActive: true, type: 'radius' } });
  const centerLat = zone?.centerLat ?? 40.7894;
  const centerLng = zone?.centerLng ?? 43.8475;
  const radiusKm = zone?.radiusKm ?? env.deliveryZoneRadiusKm;
  const result = checkGyumriDeliveryZone({ latitude, longitude }, { center: { latitude: centerLat, longitude: centerLng }, radiusKm, baseFeeMinor: 0 });
  const zoneId = result.isAvailable ? zone?.id || result.deliveryZoneId || 'gyumri-radius' : null;
  return {
    isAvailable: result.isAvailable,
    available: result.isAvailable,
    deliveryZoneId: zoneId,
    zoneId,
    distanceKm: result.distanceKm,
    deliveryFeeMinor: result.isAvailable ? 0 : null,
    feeMinor: 0,
    includedInPlan: true,
    planCode: planCode || 'all_plans',
    estimatedMinutes: result.estimatedMinutes,
    etaMin: result.estimatedMinutes,
    availableSlots: result.availableSlots,
    reason: result.reason,
    message: result.reason,
    verifiedAt: now().toISOString(),
  };
}

function safeDeliveryAddressSnapshot(address: any) {
  return {
    recipientName: address.recipientName,
    phone: address.phone,
    formattedAddress: address.formattedAddress,
    latitude: address.latitude,
    longitude: address.longitude,
    deliveryNote: address.instructions || null,
    addressType: address.addressType,
    handoffType: address.handoffType,
    entrance: address.entrance,
    floor: address.floor,
    apartment: address.apartment,
    intercomCode: address.intercomCode,
    deliveryZoneId: address.deliveryZoneId,
    deliveryFeeMinor: 0,
    deliveryIncludedInPlan: address.deliveryIncludedInPlan !== false,
    planCode: address.planCode || null,
    zoneVerifiedAt: address.zoneVerifiedAt?.toISOString?.() || address.zoneVerifiedAt || null,
    estimatedMinutes: address.estimatedMinutes,
  };
}

function validateAddress(body: any) {
  const addressType = str(body.addressType || 'apartment');
  const handoffType = str(body.handoffType || 'hand_to_recipient');
  const errors: JsonObject = {};
  const formattedAddress = str(body.formattedAddress || `${body.street || ''} ${body.house || ''}`);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!formattedAddress) errors.formattedAddress = 'Адрес обязателен.';
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = 'Некорректная широта.';
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.longitude = 'Некорректная долгота.';
  if (!str(body.recipientName, 120)) errors.recipientName = 'Имя получателя обязательно.';
  if (!str(body.phone, 40)) errors.phone = 'Телефон обязателен.';
  if (addressType === 'private_house' && !str(body.house, 80) && !str(body.landmark, 160)) errors.house = 'Для частного дома укажите дом или ориентир.';
  if ((addressType === 'office' || addressType === 'workplace') && !str(body.companyName, 120) && !str(body.hotelName, 120)) errors.companyName = 'Для офиса укажите компанию или здание.';
  if (addressType === 'hotel' && !str(body.hotelName, 120)) errors.hotelName = 'Для отеля укажите название.';
  if (addressType === 'other' && !str(body.instructions, 300)) errors.instructions = 'Для другого адреса нужна инструкция.';
  if (handoffType === 'leave_at_door' && !str(body.leaveAtDoorLocation, 200)) errors.leaveAtDoorLocation = 'Укажите точное место, где оставить заказ.';
  if (handoffType === 'call_on_arrival' && !str(body.phone, 40)) errors.phone = 'Для звонка нужен телефон.';
  if (Object.keys(errors).length) throw new ApiError(400, 'VALIDATION_ERROR', 'Проверьте адрес доставки.', errors);
  return { addressType, handoffType, formattedAddress, latitude, longitude };
}

function mapTilerFeatureToAddress(feature: any): JsonObject {
  const center = Array.isArray(feature?.center) ? feature.center : feature?.geometry?.coordinates;
  const [longitude, latitude] = Array.isArray(center) ? center : [0, 0];
  const context = Array.isArray(feature?.context) ? feature.context : [];
  const contextText = (kind: string) => context.find((item: any) => String(item?.id || '').startsWith(kind))?.text || '';
  const placeName = feature?.place_name || feature?.place_name_en || feature?.text || feature?.properties?.name || '';
  return {
    provider: 'maptiler',
    providerPlaceId: feature?.id || null,
    formattedAddress: placeName,
    country: contextText('country') || 'Armenia',
    region: contextText('region') || contextText('province') || 'Shirak',
    city: contextText('place') || contextText('locality') || feature?.text || 'Gyumri',
    district: contextText('neighbourhood') || contextText('district') || '',
    street: feature?.properties?.address || feature?.text || '',
    house: feature?.address || '',
    postalCode: contextText('postcode') || '',
    latitude: Number(latitude) || 0,
    longitude: Number(longitude) || 0,
  };
}

function mapTilerPlaceId(longitude: number, latitude: number, label: string) {
  return `maptiler:${longitude},${latitude}:${encodeURIComponent(label || '')}`;
}

function parseMapTilerPlaceId(placeId: string) {
  if (!placeId.startsWith('maptiler:')) return null;
  const rest = placeId.slice('maptiler:'.length);
  const [coordPart, encodedLabel = ''] = rest.split(':');
  const [longitude, latitude] = coordPart.split(',').map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, label: decodeURIComponent(encodedLabel) };
}

async function handleMapTilerProxy(pathname: string, parsedUrl: URL, req: IncomingMessage, res: ServerResponse) {
  if (!env.mapTilerApiKey) throw new ApiError(503, 'MAPTILER_NOT_CONFIGURED', 'MapTiler key is not configured.');
  const languageParam = parsedUrl.searchParams.get('language') || 'ru';
  const languageCode = languageParam === 'hy' ? 'hy' : languageParam === 'en' ? 'en' : 'ru';

  if (pathname === '/v1/maps/autocomplete') {
    const input = parsedUrl.searchParams.get('input') || parsedUrl.searchParams.get('query') || '';
    if (input.length < 2) return json(req, res, 200, { items: [] });
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(input)}.json?key=${encodeURIComponent(env.mapTilerApiKey)}&country=am&language=${encodeURIComponent(languageCode)}&limit=6`;
    const response = await fetch(url, { headers: { 'User-Agent': 'LOUSA-MOON/MapLibre address picker' } });
    const payload = await response.json() as any;
    if (!response.ok) throw new ApiError(502, 'MAPTILER_GEOCODING_ERROR', payload?.message || 'MapTiler geocoding error.');
    const items = (payload.features || []).map((feature: any) => {
      const address = mapTilerFeatureToAddress(feature);
      return {
        placeId: mapTilerPlaceId(address.longitude, address.latitude, address.formattedAddress),
        primaryText: feature?.text || address.street || address.city || address.formattedAddress,
        secondaryText: String(address.formattedAddress || '').replace(String(feature?.text || ''), '').replace(/^,\s*/, '') || 'Armenia',
        fullText: address.formattedAddress,
      };
    });
    return json(req, res, 200, { items });
  }

  if (pathname === '/v1/maps/place-details') {
    const placeId = parsedUrl.searchParams.get('placeId') || parsedUrl.searchParams.get('place_id') || '';
    const parsed = parseMapTilerPlaceId(placeId);
    if (!parsed) throw new ApiError(400, 'PLACE_ID_REQUIRED', 'Valid MapTiler place id is required.');
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(`${parsed.longitude},${parsed.latitude}`)}.json?key=${encodeURIComponent(env.mapTilerApiKey)}&language=${encodeURIComponent(languageCode)}&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'LOUSA-MOON/MapLibre address picker' } });
    const payload = await response.json() as any;
    const feature = payload?.features?.[0];
    const address = feature ? mapTilerFeatureToAddress(feature) : {
      provider: 'maptiler', providerPlaceId: placeId, formattedAddress: parsed.label, country: 'Armenia', region: 'Shirak', city: 'Gyumri', district: '', street: parsed.label, house: '', postalCode: '', latitude: parsed.latitude, longitude: parsed.longitude,
    };
    return json(req, res, 200, address);
  }

  const lat = parsedUrl.searchParams.get('lat') || parsedUrl.searchParams.get('latitude');
  const lng = parsedUrl.searchParams.get('lng') || parsedUrl.searchParams.get('longitude');
  if (!lat || !lng) throw new ApiError(400, 'COORDINATES_REQUIRED', 'Coordinates are required.');
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(`${lng},${lat}`)}.json?key=${encodeURIComponent(env.mapTilerApiKey)}&language=${encodeURIComponent(languageCode)}&limit=1`;
  const response = await fetch(url, { headers: { 'User-Agent': 'LOUSA-MOON/MapLibre address picker' } });
  const payload = await response.json() as any;
  if (!response.ok) throw new ApiError(502, 'MAPTILER_REVERSE_GEOCODING_ERROR', payload?.message || 'MapTiler reverse geocoding error.');
  const feature = payload?.features?.[0];
  return json(req, res, 200, feature ? mapTilerFeatureToAddress(feature) : {
    provider: 'maptiler', providerPlaceId: null, formattedAddress: `${lat}, ${lng}`, country: 'Armenia', region: 'Shirak', city: 'Gyumri', district: '', street: '', house: '', postalCode: '', latitude: Number(lat), longitude: Number(lng),
  });
}

async function handleGoogleMapsProxy(pathname: string, parsedUrl: URL, req: IncomingMessage, res: ServerResponse) {
  if (!env.googleMapsServerApiKey) throw new ApiError(503, 'MAPS_NOT_CONFIGURED', 'Google Maps server key is not configured.');
  let url: string;
  const languageParam = parsedUrl.searchParams.get('language') || 'ru';
  const languageCode = languageParam === 'hy' ? 'hy' : languageParam === 'en' ? 'en' : 'ru';
  if (pathname === '/v1/maps/autocomplete') {
    const input = parsedUrl.searchParams.get('input') || parsedUrl.searchParams.get('query') || '';
    if (input.length < 2) return json(req, res, 200, { items: [] });
    url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&language=${encodeURIComponent(languageCode)}&components=country:am&key=${encodeURIComponent(env.googleMapsServerApiKey)}`;
  } else if (pathname === '/v1/maps/place-details') {
    const placeId = parsedUrl.searchParams.get('placeId') || parsedUrl.searchParams.get('place_id') || '';
    if (!placeId) throw new ApiError(400, 'PLACE_ID_REQUIRED', 'Place id is required.');
    url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=place_id,formatted_address,geometry,address_component,name&language=${encodeURIComponent(languageCode)}&key=${encodeURIComponent(env.googleMapsServerApiKey)}`;
  } else {
    const lat = parsedUrl.searchParams.get('lat') || parsedUrl.searchParams.get('latitude');
    const lng = parsedUrl.searchParams.get('lng') || parsedUrl.searchParams.get('longitude');
    if (!lat || !lng) throw new ApiError(400, 'COORDINATES_REQUIRED', 'Coordinates are required.');
    url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&language=${encodeURIComponent(languageCode)}&key=${encodeURIComponent(env.googleMapsServerApiKey)}`;
  }
  const response = await fetch(url);
  const payload = await response.json() as any;
  if (!response.ok || payload.status === 'REQUEST_DENIED') throw new ApiError(502, 'GOOGLE_MAPS_ERROR', payload.error_message || payload.status || 'Google Maps error.');
  if (pathname === '/v1/maps/autocomplete') {
    const items = (payload.predictions || []).map((item: any) => ({
      placeId: item.place_id,
      primaryText: item.structured_formatting?.main_text || item.description,
      secondaryText: item.structured_formatting?.secondary_text || '',
      fullText: item.description,
    }));
    return json(req, res, 200, { items });
  }
  const result = pathname === '/v1/maps/place-details' ? payload.result : payload.results?.[0];
  const location = result?.geometry?.location;
  return json(req, res, 200, {
    provider: 'google',
    providerPlaceId: result?.place_id || null,
    formattedAddress: result?.formatted_address || result?.name || '',
    country: 'Armenia',
    region: '',
    city: '',
    district: '',
    street: result?.name || '',
    house: '',
    postalCode: '',
    latitude: location?.lat || 0,
    longitude: location?.lng || 0,
  });
}

async function handleMapsProxy(pathname: string, parsedUrl: URL, req: IncomingMessage, res: ServerResponse) {
  if (env.mapTilerApiKey) return handleMapTilerProxy(pathname, parsedUrl, req, res);
  if (env.googleMapsServerApiKey) return handleGoogleMapsProxy(pathname, parsedUrl, req, res);
  if (pathname === '/v1/maps/autocomplete') return json(req, res, 200, { items: [] });
  throw new ApiError(503, 'MAPS_NOT_CONFIGURED', 'Map search provider is not configured. Set MAPTILER_API_KEY or GOOGLE_MAPS_SERVER_API_KEY.');
}

const ADMIN_SESSION_COOKIE = 'lousa_admin_session';
const adminSessionTtlMs = Number(process.env.ADMIN_SESSION_TTL_HOURS || 12) * 60 * 60_000;
const adminAllowedRoles = ['OWNER','ADMIN','SUPPORT','PACKER','COURIER_MANAGER','COURIER','READONLY','CATALOG_MANAGER'] as const;

type AdminRole = typeof adminAllowedRoles[number];
type AdminContext = { id: string; email: string; name: string; role: AdminRole };

const statusTransitions: Record<string, string[]> = {
  DRAFT: ['PENDING_PAYMENT','CANCELLED'],
  PENDING_PAYMENT: ['PAID','PAYMENT_FAILED','CANCELLED'],
  PAID: ['PACKING','CANCELLED','ISSUE'],
  PACKING: ['READY_FOR_COURIER','ISSUE','CANCELLED'],
  READY_FOR_COURIER: ['COURIER_ASSIGNED','ISSUE','CANCELLED'],
  COURIER_ASSIGNED: ['OUT_FOR_DELIVERY','ISSUE','CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED','ISSUE'],
  DELIVERED: ['REFUNDED'],
  PAYMENT_FAILED: ['PENDING_PAYMENT','CANCELLED'],
  ISSUE: ['PACKING','READY_FOR_COURIER','CANCELLED','REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const publicOrderText: Record<string, { title: string; body: string }> = {
  PENDING_PAYMENT: { title: 'Заказ создан', body: 'Мы ждём подтверждение оплаты.' },
  PAID: { title: 'Оплата подтверждена', body: 'LOUSA получила оплату и готовит твой бокс.' },
  PACKING: { title: 'Бокс собирается', body: 'Команда LOUSA собирает твой заказ.' },
  READY_FOR_COURIER: { title: 'Бокс готов', body: 'Заказ готов к передаче курьеру.' },
  COURIER_ASSIGNED: { title: 'Курьер назначен', body: 'Курьер получил задачу на доставку.' },
  OUT_FOR_DELIVERY: { title: 'Курьер в пути', body: 'Твой LOUSA BOX уже едет к тебе.' },
  DELIVERED: { title: 'Доставлено', body: 'Заказ отмечен как доставленный.' },
  ISSUE: { title: 'Нужно уточнение', body: 'Команда LOUSA проверяет заказ.' },
  CANCELLED: { title: 'Заказ отменён', body: 'Заказ был отменён.' },
  PAYMENT_FAILED: { title: 'Оплата не прошла', body: 'Попробуй оплатить ещё раз.' },
  REFUNDED: { title: 'Возврат оформлен', body: 'По заказу оформлен возврат.' },
};

function getCookie(req: IncomingMessage, name: string) {
  const cookie = String(req.headers.cookie || '');
  return cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}

function setAdminCookie(res: ServerResponse, token: string | null) {
  const secure = env.appEnv === 'production' ? '; Secure' : '';
  if (!token) {
    res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return;
  }
  res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(adminSessionTtlMs / 1000)}${secure}`);
}

function normalizeAdminRole(value: unknown): AdminRole {
  const role = String(value || 'ADMIN').toUpperCase();
  return (adminAllowedRoles as readonly string[]).includes(role) ? role as AdminRole : 'ADMIN';
}

function requireRole(admin: AdminContext, roles: AdminRole[]) {
  if (admin.role === 'OWNER') return;
  if (!roles.includes(admin.role)) throw new ApiError(403, 'FORBIDDEN', 'Недостаточно прав.');
}

async function requireAdmin(req: IncomingMessage, roles: AdminRole[] = ['OWNER','ADMIN']) {
  const bearer = getBearer(req);
  const cookie = getCookie(req, ADMIN_SESSION_COOKIE);
  const token = bearer || cookie;
  if (!token) throw new ApiError(401, 'ADMIN_UNAUTHORIZED', 'Войдите в админ-панель.');
  const session = await (prisma as any).adminSession.findFirst({
    where: { tokenHash: stableHash(token, env.jwtRefreshSecret), revokedAt: null, expiresAt: { gt: now() } },
    include: { adminUser: true },
  });
  if (!session?.adminUser?.isActive) throw new ApiError(401, 'ADMIN_SESSION_EXPIRED', 'Сессия администратора истекла.');
  const admin: AdminContext = { id: session.adminUser.id, email: session.adminUser.email, name: session.adminUser.name, role: normalizeAdminRole(session.adminUser.role) };
  requireRole(admin, roles);
  return admin;
}

async function adminAudit(admin: AdminContext | null, action: string, entityType: string, entityId?: string | null, metadata?: JsonObject) {
  await (prisma as any).auditLog.create({ data: { actorId: admin?.id || null, actorRole: admin?.role || 'SYSTEM', action, entityType, entityId: entityId || null, metadata: metadata || {} } }).catch(() => null);
}

function safeCustomer(user: any, ordersCount?: number) {
  return { id: user?.id || '', name: user?.name || '—', email: user?.email || '', phone: user?.phone || null, status: user?.status || 'active', createdAt: user?.createdAt?.toISOString?.() || String(user?.createdAt || ''), ordersCount };
}

function safeDelivery(address: any) {
  if (!address) return null;
  return {
    id: address.id,
    label: address.label,
    addressType: address.addressType,
    formattedAddress: address.formattedAddress,
    country: address.country,
    region: address.region,
    city: address.city,
    district: address.district,
    street: address.street,
    house: address.house,
    entrance: address.entrance,
    floor: address.floor,
    apartment: address.apartment,
    landmark: address.landmark,
    gateDetails: address.gateDetails,
    phone: address.phone,
    recipientName: address.recipientName,
    handoffType: address.handoffType,
    instructions: address.instructions,
    latitude: address.latitude,
    longitude: address.longitude,
    deliveryZoneId: address.deliveryZoneId,
    validationStatus: address.validationStatus,
    deliveryIncludedInPlan: address.deliveryIncludedInPlan !== false,
    deliveryFeeMinor: 0,
    estimatedMinutes: address.estimatedMinutes,
    planCode: address.planCode || null,
    zoneVerifiedAt: address.zoneVerifiedAt?.toISOString?.() || address.zoneVerifiedAt || null,
    syncStatus: address.syncStatus || 'synced',
    isDefault: address.isDefault,
    updatedAt: address.updatedAt?.toISOString?.() || String(address.updatedAt || ''),
  };
}

function orderCode(order: any) { return `LM-${String(order.id || '').slice(0, 8).toUpperCase()}`; }

function adminOrderDto(order: any) {
  const plan = order.quote?.plan?.name || order.quote?.plan?.code || null;
  return { id: order.id, code: orderCode(order), status: order.status, paymentStatus: order.paymentStatus, deliveryStatus: order.deliveryTasks?.[0]?.status || null, assignedCourierId: order.deliveryTasks?.[0]?.courierId || null, totalMinor: order.totalMinor, recurringMonthlyTotalMinor: order.quote?.selectedSnapshot?.recurringMonthlyTotalMinor || order.totalMinor, currency: order.currency || 'AMD', createdAt: order.createdAt?.toISOString?.() || String(order.createdAt || ''), customer: safeCustomer(order.user), delivery: safeDelivery(order.deliveryAddress), plan, itemsCount: Array.isArray(order.items) ? order.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) : 0 };
}

function packerOrderDto(order: any) {
  return { id: order.id, code: orderCode(order), status: order.status, plan: order.quote?.plan?.name || order.quote?.plan?.code || null, items: (order.items || []).map((item: any) => ({ id: item.id, sku: item.product?.sku, name: item.product?.nameRu || item.product?.sku || item.productId, quantity: item.quantity, packedQuantity: item.packingItems?.[0]?.packedQuantity || 0, status: item.packingItems?.[0]?.status || 'OPEN' })), preferences: order.quote?.selectedSnapshot?.preferences || {} };
}

function courierTaskDto(task: any) {
  const payload = task.safePayload || {};
  return { id: task.id, orderCode: task.order ? orderCode(task.order) : payload.orderCode, recipientName: payload.recipientName || task.order?.deliveryAddress?.recipientName || '', phone: payload.phone || task.order?.deliveryAddress?.phone || '', formattedAddress: payload.formattedAddress || task.order?.deliveryAddress?.formattedAddress || '', latitude: payload.latitude || task.order?.deliveryAddress?.latitude || null, longitude: payload.longitude || task.order?.deliveryAddress?.longitude || null, handoffType: payload.handoffType || task.order?.deliveryAddress?.handoffType || null, instructions: payload.instructions || task.order?.deliveryAddress?.instructions || null, status: task.status, eta: task.eta?.toISOString?.() || null };
}



function redactSupportText(value: unknown, max = 1200) {
  return str(value, max)
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '•••• •••• •••• ••••')
    .replace(/\b\d{3,4}\b/g, (m) => m.length >= 4 ? '••••' : m);
}

function supportTicketDto(ticket: any, includeInternal = false) {
  return {
    id: ticket.id,
    orderId: ticket.orderId || null,
    subject: ticket.subject,
    category: ticket.category || 'GENERAL',
    status: ticket.status,
    priority: ticket.priority,
    safeSummary: ticket.safeSummary || '',
    contactChannel: ticket.contactChannel || 'IN_APP',
    createdAt: ticket.createdAt?.toISOString?.() || String(ticket.createdAt || ''),
    updatedAt: ticket.updatedAt?.toISOString?.() || String(ticket.updatedAt || ''),
    lastMessageAt: ticket.lastMessageAt?.toISOString?.() || null,
    customer: ticket.user ? safeCustomer(ticket.user) : null,
    orderCode: ticket.order ? orderCode(ticket.order) : null,
    messages: (ticket.messages || []).filter((message: any) => includeInternal || message.visibility !== 'INTERNAL').map((message: any) => ({
      id: message.id,
      senderType: message.senderType,
      body: includeInternal ? message.body : (message.safeBody || message.body),
      visibility: message.visibility,
      createdAt: message.createdAt?.toISOString?.() || String(message.createdAt || ''),
    })),
    internalNote: includeInternal ? ticket.internalNote || null : undefined,
  };
}

function safeCourierContactDto(order: any) {
  const task = order.deliveryTasks?.[0];
  const assignment = order.courierAssignments?.[0];
  const courier = assignment?.courier || null;
  if (!task || !courier || !['COURIER_ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY'].includes(task.status)) {
    return { available: false, status: task?.status || order.status, message: 'Курьер появится здесь после назначения доставки.', supportFallback: true };
  }
  return {
    available: true,
    status: task.status,
    courier: { id: courier.id, name: courier.name, phone: courier.phone || null },
    canCall: Boolean(courier.phone),
    canMessage: true,
    privacyNote: 'Курьер видит только данные доставки: имя получателя, телефон, адрес и окно доставки. Данные цикла и заметки скрыты.',
  };
}

async function createSafeNotification(userId: string | null | undefined, category: string, titleKey: string, bodyKey: string, data: JsonObject = {}) {
  if (!userId) return null;
  return (prisma as any).notificationInboxItem.create({ data: { userId, category, titleKey, bodyKey, data } }).catch(() => null);
}

const safeNotificationCopy: Record<string, { title: string; body: string; privateBody?: string; route?: string }> = {
  'support.ticket.created': { title: 'Поддержка LOUSA', body: 'Обращение создано. Мы ответим в приложении.', privateBody: 'Новое уведомление LOUSA.', route: '/screens/support' },
  'support.status.updated': { title: 'Поддержка LOUSA', body: 'Статус обращения обновлён.', privateBody: 'Новое уведомление LOUSA.', route: '/screens/support' },
  'support.reply': { title: 'Поддержка LOUSA', body: 'Команда LOUSA ответила на ваше обращение.', privateBody: 'Новое уведомление LOUSA.', route: '/screens/support' },
  'courier.message.sent': { title: 'Доставка LOUSA BOX', body: 'Сообщение передано команде доставки.', privateBody: 'Обновление LOUSA.', route: '/screens/support' },
  'delivery.status.updated': { title: 'Доставка LOUSA BOX', body: 'Статус доставки обновлён.', privateBody: 'Обновление доставки.', route: '/screens/support' },
};

function appNotificationDto(item: any) {
  const data = item.data || {};
  const copy = safeNotificationCopy[item.titleKey] || safeNotificationCopy[item.bodyKey] || { title: 'LOUSA', body: 'У вас новое уведомление.', privateBody: 'Новое уведомление LOUSA.' };
  const category = String(item.category || data.category || 'system').toLowerCase();
  return {
    id: item.id,
    remoteId: item.id,
    category: ['cycle','diary','box','moon','system','support','delivery'].includes(category) ? category : 'system',
    title: copy.title,
    body: copy.body,
    privateBody: copy.privateBody || 'Новое уведомление LOUSA.',
    route: typeof data.route === 'string' ? data.route : copy.route,
    createdAt: item.createdAt?.toISOString?.() || String(item.createdAt || ''),
    readAt: item.readAt?.toISOString?.() || null,
  };
}

function appSubscriptionDto(subscription: any) {
  const data = subscription?.data && typeof subscription.data === 'object' ? subscription.data : {};
  return {
    id: subscription.id,
    plan: String(subscription.plan || 'comfort').toLowerCase(),
    status: String(subscription.status || 'active').toLowerCase(),
    pauseUntil: subscription.pauseUntil?.toISOString?.() || data.pauseUntil || null,
    skipNextBox: Boolean(subscription.skipNextBox ?? data.skipNextBox),
    deliveryAddressId: subscription.deliveryAddressId || data.deliveryAddressId || '',
    deliveryWindow: subscription.deliveryWindow || data.deliveryWindow || '',
    nextBillingDate: subscription.nextBillingDate?.toISOString?.() || data.nextBillingDate || null,
    nextPreparationDate: subscription.nextPreparationDate?.toISOString?.() || data.nextPreparationDate || null,
    nextDeliveryDate: subscription.nextDeliveryDate?.toISOString?.() || data.nextDeliveryDate || null,
    cancelledAt: subscription.cancelledAt?.toISOString?.() || data.cancelledAt || null,
    cancellationReason: data.cancellationReason || null,
    createdAt: subscription.createdAt?.toISOString?.() || String(subscription.createdAt || ''),
    updatedAt: subscription.updatedAt?.toISOString?.() || String(subscription.updatedAt || ''),
  };
}

function subscriptionDto(subscription: any) {
  const data = subscription.data || {};
  return {
    id: subscription.id,
    customer: safeCustomer(subscription.user),
    plan: subscription.plan,
    status: subscription.status,
    nextBoxDate: subscription.nextDeliveryDate?.toISOString?.() || data.nextBoxDate || null,
    nextBillingDate: subscription.nextBillingDate?.toISOString?.() || data.nextBillingDate || null,
    recurringMonthlyTotalMinor: data.recurringMonthlyTotalMinor || data.recurringMonthlyTotal || 0,
    recurringAddOns: data.recurringAddOns || [],
    lastOrderId: subscription.orders?.[0]?.id || null,
    createdAt: subscription.createdAt?.toISOString?.() || String(subscription.createdAt || ''),
    updatedAt: subscription.updatedAt?.toISOString?.() || String(subscription.updatedAt || ''),
  };
}

function publicTimelineEvent(event: any) {
  return {
    id: event.id,
    type: event.type,
    publicTitle: event.publicTitleRu || event.publicTitle || 'Статус обновлён',
    publicBody: event.publicBodyRu || event.publicBody || '',
    createdAt: event.createdAt?.toISOString?.() || String(event.createdAt || ''),
  };
}

async function courierFromAdmin(admin: AdminContext) {
  return (prisma as any).courier.findFirst({ where: { OR: [{ adminUserId: admin.id }, { name: admin.name }] } }).catch(() => null);
}

async function createPublicOrderEvent(orderId: string, status: string, internalNote?: string) {
  const copy = publicOrderText[status] || { title: `Статус обновлён: ${status}`, body: '' };
  return (prisma as any).orderEvent.create({ data: { orderId, type: status, publicTitleRu: copy.title, publicBodyRu: copy.body, publicTitle: copy.title, publicBody: copy.body, internalTitle: `Internal ${status}`, internalBody: internalNote || null, internalNote: internalNote || null, visibleToCustomer: true } }).catch(() => null);
}

async function assertOrderPackingQuality(orderId: string) {
  const order = await (prisma as any).order.findUnique({ where: { id: orderId }, include: { items: true, boxPackingRecord: { include: { batches: { include: { productBatch: true } } } } } });
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
  const record = order.boxPackingRecord;
  if (!record || record.qaStatus !== 'RELEASED' || !record.qaReleasedAt || !record.sealedAt || !record.sealId) {
    throw new ApiError(409, 'BOX_QA_NOT_RELEASED', 'Бокс нельзя передать курьеру до проверки качества и пломбирования.');
  }
  const packedByProduct = new Map<string, number>();
  for (const link of record.batches || []) {
    const batch = link.productBatch;
    if (!batch || batch.qaStatus !== 'RELEASED' || batch.recallStatus !== 'CLEAR') {
      throw new ApiError(409, 'PRODUCT_BATCH_NOT_RELEASED', 'В боксе есть партия без разрешения контроля качества.');
    }
    if (batch.expiryDate && batch.expiryDate <= now()) throw new ApiError(409, 'PRODUCT_BATCH_EXPIRED', 'В боксе есть товар с истёкшим сроком годности.');
    packedByProduct.set(batch.productId, (packedByProduct.get(batch.productId) || 0) + Number(link.quantity || 0));
  }
  for (const item of order.items || []) {
    if ((packedByProduct.get(item.productId) || 0) < item.quantity) {
      throw new ApiError(409, 'PACKING_BATCH_TRACE_INCOMPLETE', 'Не все товары заказа связаны с проверенными партиями.');
    }
  }
  return record;
}

async function ensurePackingTask(order: any) {
  let task = await (prisma as any).packingTask.findFirst({ where: { orderId: order.id }, include: { items: true } }).catch(() => null);
  if (!task) {
    task = await (prisma as any).packingTask.create({ data: { orderId: order.id, status: 'OPEN' } });
    const items = order.items || await (prisma as any).orderItem.findMany({ where: { orderId: order.id } });
    for (const item of items) {
      await (prisma as any).packingTaskItem.create({ data: { packingTaskId: task.id, orderItemId: item.id, quantity: item.quantity } }).catch(() => null);
    }
  }
  return task;
}

async function handleAdminRoutes(pathname: string, parsed: URL, method: string, req: AuthedRequest, res: ServerResponse) {
  if (method === 'POST' && pathname === '/v1/admin/auth/login') {
    await rateLimit(`admin-login:${req.socket.remoteAddress}`, 10, 300);
    const body = await readJson(req);
    const email = lowerEmail(body.email);
    const adminUser = await (prisma as any).adminUser.findUnique({ where: { email } });
    if (!adminUser?.isActive || !await verifySecret(String(body.password || ''), adminUser.passwordHash)) {
      await adminAudit(null, 'ADMIN_LOGIN_FAILED', 'AdminUser', null, { email });
      throw new ApiError(401, 'INVALID_ADMIN_CREDENTIALS', 'Неверный email или пароль.');
    }
    const token = randomUUID() + '.' + randomUUID();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    await (prisma as any).adminSession.create({ data: { adminUserId: adminUser.id, tokenHash: stableHash(token, env.jwtRefreshSecret), expiresAt: future(adminSessionTtlMs), ipHash: ip ? stableHash(ip, env.jwtRefreshSecret) : null, userAgentHash: stableHash(String(req.headers['user-agent'] || ''), env.jwtRefreshSecret) } });
    await (prisma as any).adminUser.update({ where: { id: adminUser.id }, data: { lastLoginAt: now() } });
    const admin = { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: normalizeAdminRole(adminUser.role) };
    await adminAudit(admin, 'ADMIN_LOGIN', 'AdminUser', admin.id);
    setAdminCookie(res, token);
    return json(req, res, 200, { admin, accessToken: token });
  }

  if (method === 'POST' && pathname === '/v1/admin/auth/logout') {
    const token = getBearer(req) || getCookie(req, ADMIN_SESSION_COOKIE);
    if (token) await (prisma as any).adminSession.updateMany({ where: { tokenHash: stableHash(token, env.jwtRefreshSecret), revokedAt: null }, data: { revokedAt: now() } }).catch(() => null);
    setAdminCookie(res, null);
    return json(req, res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/v1/admin/health') {
    let dbConnected = 'unknown';
    let ownerExists = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = 'connected';
      const owner = await (prisma as any).adminUser.findFirst({ where: { role: 'OWNER' } });
      ownerExists = !!owner;
    } catch (_e) {
      dbConnected = 'disconnected';
    }
    const payload: any = {
      ok: true,
      service: 'lousa-api',
      adminApi: true,
      timestamp: new Date().toISOString(),
      environment: env.appEnv
    };
    if (env.appEnv === 'development') {
      payload.ownerExists = ownerExists;
      payload.database = dbConnected;
    }
    return json(req, res, 200, payload);
  }

  if (method === 'GET' && pathname === '/v1/admin/setup/status') {
    if (env.appEnv !== 'development') {
      throw new ApiError(403, 'FORBIDDEN', 'Доступ ограничен в production.');
    }
    let dbConnected = true;
    let adminUsersCount = 0;
    let ownerExists = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      adminUsersCount = await (prisma as any).adminUser.count();
      const owner = await (prisma as any).adminUser.findFirst({ where: { role: 'OWNER' } });
      ownerExists = !!owner;
    } catch (_e) {
      dbConnected = false;
    }
    return json(req, res, 200, {
      ownerExists,
      adminUsersCount,
      databaseConnected: dbConnected,
      apiVersion: '1.1'
    });
  }

  const admin = await requireAdmin(req, ['OWNER','ADMIN','SUPPORT','PACKER','COURIER_MANAGER','COURIER','READONLY','CATALOG_MANAGER']);

  if (method === 'GET' && pathname === '/v1/admin/sync/status') {
    requireRole(admin, ['OWNER', 'ADMIN', 'SUPPORT']);
    let dbConnected = true;
    let ordersCount = 0;
    let lastOrderAt: string | null = null;
    let lastOrderEventAt: string | null = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      ordersCount = await (prisma as any).order.count();
      const lastOrder = await (prisma as any).order.findFirst({ orderBy: { createdAt: 'desc' } });
      lastOrderAt = lastOrder?.createdAt ? lastOrder.createdAt.toISOString() : null;
      const lastEvent = await (prisma as any).orderEvent.findFirst({ orderBy: { createdAt: 'desc' } });
      lastOrderEventAt = lastEvent?.createdAt ? lastEvent.createdAt.toISOString() : null;
    } catch (_e) {
      dbConnected = false;
    }
    return json(req, res, 200, {
      api: 'online',
      database: dbConnected ? 'connected' : 'disconnected',
      ordersCount,
      lastOrderAt,
      lastOrderEventAt,
      mobileEndpoints: {
        activeOrders: true,
        timeline: true
      }
    });
  }

  if (method === 'POST' && pathname === '/v1/admin/dev/create-sample-order') {
    requireRole(admin, ['OWNER']);
    if (env.appEnv !== 'development') {
      throw new ApiError(403, 'FORBIDDEN', 'Только для разработки.');
    }
    
    // Create/Ensure a dev user
    const devUser = await prisma.user.upsert({
      where: { email: 'ani-dev-sample@lousa.app' },
      update: {},
      create: {
        email: 'ani-dev-sample@lousa.app',
        emailVerifiedAt: new Date(),
        passwordHash: await hashSecret('SamplePassword1'),
        name: 'Ani Sample',
        language: 'ru',
        status: 'active'
      }
    });

    // Resolve or create a dev product
    let product = await (prisma as any).productCatalogItem.findFirst({ where: { sku: 'dev-tea' } });
    if (!product) {
      product = await (prisma as any).productCatalogItem.create({
        data: { sku: 'dev-tea', nameRu: 'Dev Травяной чай', nameEn: 'Dev Herbal Tea', nameHy: 'Dev Բուսական Թեյ', category: 'wellness', isActive: true }
      });
    }

    // Resolve or create a dev plan
    let plan = await (prisma as any).boxPlan.findFirst({ where: { code: 'dev-essential' } });
    if (!plan) {
      plan = await (prisma as any).boxPlan.create({
        data: { code: 'dev-essential', name: 'Dev Essential', basePriceMinor: 1290000, currency: 'AMD', isActive: true }
      });
    }

    // Create delivery zone if not exists
    await (prisma as any).deliveryZone.upsert({
      where: { id: 'gyumri-main-zone' },
      update: {},
      create: { id: 'gyumri-main-zone', name: 'Gyumri Standard', type: 'radius', centerLat: 40.7894, centerLng: 43.8475, radiusKm: 15, baseFeeMinor: 0, currency: 'AMD', isActive: true }
    });

    // Create quote and order
    const quote = await (prisma as any).orderQuote.create({
      data: {
        userId: devUser.id,
        planId: plan.id,
        basePriceMinor: plan.basePriceMinor,
        totalMinor: plan.basePriceMinor,
        selectedSnapshot: {},
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    const order = await (prisma as any).order.create({
      data: {
        userId: devUser.id,
        quoteId: quote.id,
        status: 'PAID',
        paymentStatus: 'PAID',
        totalMinor: plan.basePriceMinor,
        currency: 'AMD',
        handoffSnapshot: { source: 'DEV_SEED' },
        recipientSnapshot: { recipientName: 'Ani Sample', phone: '+37499112233' }
      }
    });

    const orderItem = await (prisma as any).orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        quantity: 1,
        unitPriceMinor: plan.basePriceMinor,
        totalMinor: plan.basePriceMinor
      }
    });

    // Create packing task
    const packingTask = await (prisma as any).packingTask.create({
      data: {
        orderId: order.id,
        status: 'OPEN'
      }
    });

    await (prisma as any).packingTaskItem.create({
      data: {
        packingTaskId: packingTask.id,
        orderItemId: orderItem.id,
        quantity: 1,
        status: 'OPEN'
      }
    });

    // Create public order event
    await createPublicOrderEvent(order.id, 'PAID', 'Sample order created');

    // Audit log
    await adminAudit(admin, 'DEV_SAMPLE_ORDER_CREATED', 'Order', order.id, { createdBy: admin.email });

    return json(req, res, 200, { success: true, orderId: order.id, code: orderCode(order) });
  }

  if (method === 'GET' && pathname === '/v1/admin/me') return json(req, res, 200, { admin });

  if (method === 'GET' && pathname === '/v1/admin/dashboard') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT','PACKER','COURIER_MANAGER','READONLY','CATALOG_MANAGER']);
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);

    const [
      newOrders,
      pendingPaymentOrders,
      paidOrders,
      packingOrders,
      issueOrders,
      readyForCourierOrders,
      outForDeliveryOrders,
      deliveredTodayOrders,
      recentOrders,
      lowStock,
      todayOrders,
      activeSubscriptions,
      supportOpenTickets,
      supportWaitingTickets,
      supportHighPriorityTickets,
      deliveryIssueTasks,
      recentSupportTickets
    ] = await Promise.all([
      (prisma as any).order.count({ where: { status: 'PENDING_PAYMENT' } }),
      (prisma as any).order.count({ where: { status: 'PENDING_PAYMENT' } }),
      (prisma as any).order.count({ where: { status: 'PAID' } }),
      (prisma as any).order.count({ where: { status: 'PACKING' } }),
      (prisma as any).order.count({ where: { status: 'ISSUE' } }),
      (prisma as any).order.count({ where: { status: 'READY_FOR_COURIER' } }),
      (prisma as any).order.count({ where: { status: 'OUT_FOR_DELIVERY' } }),
      (prisma as any).order.count({ where: { status: 'DELIVERED', updatedAt: { gte: todayStart } } }),
      (prisma as any).order.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { user: true, deliveryAddress: true, deliveryTasks: true, items: true, quote: { include: { plan: true } } } }),
      (prisma as any).inventoryItem.findMany({ take: 8, where: { availableQuantity: { lt: 10 } }, include: { product: true }, orderBy: { availableQuantity: 'asc' } }).catch(() => []),
      (prisma as any).order.findMany({
        where: {
          createdAt: { gte: todayStart },
          status: { in: ['PAID', 'PACKING', 'READY_FOR_COURIER', 'COURIER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'] }
        },
        select: { totalMinor: true }
      }).catch(() => []),
      (prisma as any).subscription.count({ where: { status: { in: ['active','ACTIVE','paused','PAUSED'] } } }).catch(() => 0),
      (prisma as any).supportTicket.count({ where: { status: { in: ['OPEN','PENDING_TEAM'] } } }).catch(() => 0),
      (prisma as any).supportTicket.count({ where: { status: 'PENDING_CUSTOMER' } }).catch(() => 0),
      (prisma as any).supportTicket.count({ where: { priority: { in: ['HIGH','URGENT'] }, status: { notIn: ['RESOLVED','CLOSED'] } } }).catch(() => 0),
      (prisma as any).deliveryTask.count({ where: { status: 'DELIVERY_ISSUE' } }).catch(() => 0),
      (prisma as any).supportTicket.findMany({ take: 6, orderBy: { updatedAt: 'desc' }, include: { user: true, order: true, messages: { orderBy: { createdAt: 'asc' } } } }).catch(() => [])
    ]);

    const revenueToday = todayOrders.reduce((sum: number, o: any) => sum + o.totalMinor, 0);

    return json(req, res, 200, {
      newOrders,
      pendingPaymentOrders,
      paidOrders,
      packingOrders,
      issueOrders,
      readyForCourierOrders,
      outForDeliveryOrders,
      deliveredTodayOrders,
      revenueToday,
      activeSubscriptions,
      supportOpenTickets,
      supportWaitingTickets,
      supportHighPriorityTickets,
      deliveryIssueTasks,
      recentOrders: recentOrders.map(adminOrderDto),
      recentSupportTickets: (recentSupportTickets || []).map((ticket: any) => supportTicketDto(ticket, true)),
      lowStock: lowStock.map((i: any) => ({ productId: i.productId, sku: i.product?.sku, nameRu: i.product?.nameRu, availableQuantity: i.availableQuantity, reservedQuantity: i.reservedQuantity }))
    });
  }

  if (method === 'GET' && pathname === '/v1/admin/orders') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT','PACKER','READONLY']);
    const status = parsed.searchParams.get('status');
    const items = await (prisma as any).order.findMany({ where: status ? { status } : {}, take: 100, orderBy: { createdAt: 'desc' }, include: { user: true, deliveryAddress: true, deliveryTasks: true, items: true, quote: { include: { plan: true } } } });
    return json(req, res, 200, { items: items.map(admin.role === 'PACKER' ? packerOrderDto : adminOrderDto) });
  }

  const orderMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)$/);
  if (orderMatch && method === 'GET') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT','PACKER','READONLY']);
    const order = await (prisma as any).order.findUnique({ where: { id: orderMatch[1] }, include: { user: true, deliveryAddress: true, deliveryTasks: true, items: { include: { product: true, packingItems: true } }, quote: { include: { plan: true } }, orderEvents: { orderBy: { createdAt: 'asc' } }, supportNotes: { orderBy: { createdAt: 'desc' } } } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    if (admin.role === 'PACKER') return json(req, res, 200, packerOrderDto(order));
    return json(req, res, 200, { ...adminOrderDto(order), items: order.items, events: order.orderEvents, notes: order.supportNotes, customer: safeCustomer(order.user), delivery: safeDelivery(order.deliveryAddress) });
  }

  const statusMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)\/status$/);
  if (statusMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN']);
    const body = await readJson(req);
    const nextStatus = str(body.status, 40).toUpperCase();
    const reason = str(body.reason || 'status update', 240);
    const order = await (prisma as any).order.findUnique({ where: { id: statusMatch[1] }, include: { items: true, deliveryAddress: true } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    const allowed = admin.role === 'OWNER' || (statusTransitions[order.status] || []).includes(nextStatus);
    if (!allowed) throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Нельзя перейти из ${order.status} в ${nextStatus}.`);
    const updated = await (prisma as any).order.update({ where: { id: order.id }, data: { status: nextStatus, paymentStatus: nextStatus === 'PAID' ? 'PAID' : order.paymentStatus } });
    if (nextStatus === 'PACKING' || nextStatus === 'PAID') await ensurePackingTask({ ...order, status: nextStatus });
    if (nextStatus === 'READY_FOR_COURIER') {
      const payload = { orderCode: orderCode(order), recipientName: order.deliveryAddress?.recipientName, phone: order.deliveryAddress?.phone, formattedAddress: order.deliveryAddress?.formattedAddress, latitude: order.deliveryAddress?.latitude, longitude: order.deliveryAddress?.longitude, handoffType: order.deliveryAddress?.handoffType, instructions: order.deliveryAddress?.instructions };
      await (prisma as any).deliveryTask.upsert({ where: { orderId: order.id }, update: { status: 'READY', safePayload: payload }, create: { orderId: order.id, status: 'READY', safePayload: payload } }).catch(() => null);
    }
    await createPublicOrderEvent(order.id, nextStatus, reason);
    await adminAudit(admin, 'ORDER_STATUS_CHANGED', 'Order', order.id, { from: order.status, to: nextStatus, reason });
    return json(req, res, 200, { order: { id: updated.id, status: updated.status } });
  }

  const noteMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)\/admin-note$/);
  if (noteMatch && method === 'POST') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT']);
    const body = await readJson(req);
    const note = str(body.note, 2000);
    if (!note) throw new ApiError(400, 'NOTE_REQUIRED', 'Заметка пустая.');
    const item = await (prisma as any).supportNote.create({ data: { orderId: noteMatch[1], adminUserId: admin.id, note } });
    await adminAudit(admin, 'SUPPORT_NOTE_CREATED', 'Order', noteMatch[1]);
    return json(req, res, 200, { item });
  }


  const internalNoteMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)\/internal-notes$/);
  if (internalNoteMatch && method === 'POST') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT']);
    const body = await readJson(req);
    const note = str(body.note, 2000);
    if (!note) throw new ApiError(400, 'NOTE_REQUIRED', 'Заметка пустая.');
    const item = await (prisma as any).supportNote.create({ data: { orderId: internalNoteMatch[1], adminUserId: admin.id, note } });
    await adminAudit(admin, 'INTERNAL_NOTE_CREATED', 'Order', internalNoteMatch[1]);
    return json(req, res, 200, { item });
  }

  const paymentConfirmMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)\/payment\/confirm$/);
  if (paymentConfirmMatch && method === 'POST') {
    requireRole(admin, ['OWNER','ADMIN']);
    const body = await readJson(req);
    const reason = str(body.reason, 240);
    if (!reason) throw new ApiError(400, 'REASON_REQUIRED', 'Для ручного подтверждения оплаты нужна причина.');
    const order = await (prisma as any).order.findUnique({ where: { id: paymentConfirmMatch[1] } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    const updated = await (prisma as any).order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', status: order.status === 'PENDING_PAYMENT' ? 'PAID' : order.status } });
    await createPublicOrderEvent(order.id, 'PAID', `manual payment confirmed: ${reason}`);
    await adminAudit(admin, 'PAYMENT_MANUALLY_CONFIRMED', 'Order', order.id, { reason, fromPaymentStatus: order.paymentStatus, toPaymentStatus: 'PAID' });
    return json(req, res, 200, { order: { id: updated.id, status: updated.status, paymentStatus: updated.paymentStatus } });
  }

  const cancelOrderMatch = pathname.match(/^\/v1\/admin\/orders\/([^/]+)\/cancel$/);
  if (cancelOrderMatch && method === 'POST') {
    requireRole(admin, ['OWNER','ADMIN']);
    const body = await readJson(req);
    const reason = str(body.reason, 240);
    if (!reason) throw new ApiError(400, 'REASON_REQUIRED', 'Укажите причину отмены.');
    const order = await (prisma as any).order.findUnique({ where: { id: cancelOrderMatch[1] } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    const updated = await (prisma as any).order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: now() } });
    await createPublicOrderEvent(order.id, 'CANCELLED', reason);
    await adminAudit(admin, 'ORDER_CANCELLED', 'Order', order.id, { reason, from: order.status });
    return json(req, res, 200, { order: { id: updated.id, status: updated.status } });
  }

  if (method === 'POST' && pathname === '/v1/admin/quality/suppliers') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER']);
    const body = await readJson(req);
    const supplier = await (prisma as any).supplier.create({ data: {
      legalName: str(body.legalName, 180),
      country: optionalStr(body.country, 80),
      contactEmail: optionalStr(body.contactEmail, 160),
      contactPhone: optionalStr(body.contactPhone, 60),
      agreementStatus: str(body.agreementStatus || 'PENDING', 40),
      qualityStatus: str(body.qualityStatus || 'PENDING_REVIEW', 40),
      certificates: body.certificates || null,
      lastAuditAt: body.lastAuditAt ? new Date(body.lastAuditAt) : null,
    } });
    await adminAudit(admin, 'SUPPLIER_CREATED', 'Supplier', supplier.id);
    return json(req, res, 201, supplier);
  }

  if (method === 'POST' && pathname === '/v1/admin/quality/batches') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER','PACKER']);
    const body = await readJson(req);
    const quantity = int(body.quantityReceived, 0);
    if (quantity <= 0) throw new ApiError(400, 'BATCH_QUANTITY_INVALID', 'Количество партии должно быть больше нуля.');
    const batch = await (prisma as any).productBatch.create({ data: {
      productId: str(body.productId, 80), supplierId: str(body.supplierId, 80), lotNumber: str(body.lotNumber, 120),
      manufactureDate: body.manufactureDate ? new Date(body.manufactureDate) : null,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      quantityReceived: quantity, quantityAvailable: quantity,
      warehouseId: str(body.warehouseId || 'gyumri-main', 80),
      storageLocation: optionalStr(body.storageLocation, 120), storageCondition: optionalStr(body.storageCondition, 160),
      qaStatus: 'QUARANTINE', certificateReferences: body.certificateReferences || null,
    } });
    await adminAudit(admin, 'PRODUCT_BATCH_RECEIVED', 'ProductBatch', batch.id, { lotNumber: batch.lotNumber, quantity });
    return json(req, res, 201, batch);
  }

  const batchReleaseMatch = pathname.match(/^\/v1\/admin\/quality\/batches\/([^/]+)\/release$/);
  if (batchReleaseMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER']);
    const body = await readJson(req);
    const batch = await (prisma as any).productBatch.update({ where: { id: batchReleaseMatch[1] }, data: {
      qaStatus: body.approved === false ? 'REJECTED' : 'RELEASED', qaCheckedAt: now(), qaCheckedBy: admin.id,
      qaNotes: optionalStr(body.notes, 500), recallStatus: body.approved === false ? 'BLOCKED' : 'CLEAR',
    } });
    await adminAudit(admin, 'PRODUCT_BATCH_QA_UPDATED', 'ProductBatch', batch.id, { qaStatus: batch.qaStatus });
    return json(req, res, 200, batch);
  }

  const packingRecordMatch = pathname.match(/^\/v1\/admin\/packing\/([^/]+)\/quality-record$/);
  if (packingRecordMatch && method === 'PUT') {
    requireRole(admin, ['OWNER','ADMIN','PACKER']);
    const body = await readJson(req);
    const order = await (prisma as any).order.findUnique({ where: { id: packingRecordMatch[1] }, include: { items: true } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    const batchLines = Array.isArray(body.batches) ? body.batches : [];
    if (!batchLines.length) throw new ApiError(400, 'PACKING_BATCHES_REQUIRED', 'Укажите проверенные партии для каждого товара.');
    const record = await (prisma as any).$transaction(async (tx: any) => {
      const saved = await tx.boxPackingRecord.upsert({ where: { orderId: order.id }, update: {
        packedBy: admin.id, checkedBy: optionalStr(body.checkedBy, 80), qaStatus: body.release === true ? 'RELEASED' : 'PENDING',
        qaReleasedAt: body.release === true ? now() : null, sealedAt: body.sealId ? now() : null, sealId: optionalStr(body.sealId, 120),
        measuredWeightG: body.measuredWeightG == null ? null : int(body.measuredWeightG, 0), photoReference: optionalStr(body.photoReference, 500),
        substitutionLog: body.substitutionLog || null,
      }, create: {
        orderId: order.id, packedBy: admin.id, checkedBy: optionalStr(body.checkedBy, 80), qaStatus: body.release === true ? 'RELEASED' : 'PENDING',
        qaReleasedAt: body.release === true ? now() : null, sealedAt: body.sealId ? now() : null, sealId: optionalStr(body.sealId, 120),
        measuredWeightG: body.measuredWeightG == null ? null : int(body.measuredWeightG, 0), photoReference: optionalStr(body.photoReference, 500),
        substitutionLog: body.substitutionLog || null,
      } });
      await tx.boxPackingBatch.deleteMany({ where: { packingRecordId: saved.id } });
      for (const line of batchLines) {
        const quantity = int(line.quantity, 0);
        if (quantity <= 0) throw new ApiError(400, 'PACKING_QUANTITY_INVALID', 'Количество партии в боксе должно быть больше нуля.');
        await tx.boxPackingBatch.create({ data: { packingRecordId: saved.id, productBatchId: str(line.productBatchId, 80), quantity } });
      }
      return tx.boxPackingRecord.findUnique({ where: { id: saved.id }, include: { batches: { include: { productBatch: true } } } });
    });
    if (body.release === true) await assertOrderPackingQuality(order.id);
    await adminAudit(admin, 'BOX_PACKING_QUALITY_RECORDED', 'Order', order.id, { released: body.release === true });
    return json(req, res, 200, record);
  }

  if (method === 'GET' && pathname === '/v1/admin/packing') {
    requireRole(admin, ['OWNER','ADMIN','PACKER']);
    const items = await (prisma as any).order.findMany({ where: { status: { in: ['PAID','PACKING'] } }, take: 100, orderBy: { createdAt: 'asc' }, include: { user: true, items: { include: { product: true, packingItems: true } }, quote: { include: { plan: true } } } });
    return json(req, res, 200, { items: items.map(packerOrderDto) });
  }

  const packingMatch = pathname.match(/^\/v1\/admin\/packing\/([^/]+)\/complete$/);
  if (packingMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','PACKER']);
    const order = await (prisma as any).order.findUnique({ where: { id: packingMatch[1] }, include: { items: true, deliveryAddress: true } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    await assertOrderPackingQuality(order.id);
    const task = await ensurePackingTask(order);
    await (prisma as any).packingTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', completedAt: now() } });
    const updated = await (prisma as any).order.update({ where: { id: order.id }, data: { status: 'READY_FOR_COURIER' } });
    await createPublicOrderEvent(order.id, 'READY_FOR_COURIER', 'packing complete');
    await adminAudit(admin, 'PACKING_COMPLETED', 'Order', order.id);
    return json(req, res, 200, { order: { id: updated.id, status: updated.status } });
  }

  if (method === 'GET' && pathname === '/v1/admin/customers') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT','READONLY']);
    const users = await (prisma as any).user.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { directOrders: true } });
    return json(req, res, 200, { items: users.map((u: any) => safeCustomer(u, u.directOrders?.length || 0)) });
  }


  if (method === 'POST' && pathname === '/v1/admin/support/tickets') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT']);
    const body = await readJson(req);
    const orderId = optionalStr(body.orderId, 80);
    const userId = optionalStr(body.userId, 80);
    const subject = str(body.subject || 'Обращение LOUSA', 180);
    const category = str(body.category || 'GENERAL', 40).toUpperCase();
    const priority = str(body.priority || (category === 'DELIVERY' ? 'HIGH' : 'NORMAL'), 40).toUpperCase();
    const message = redactSupportText(body.message || body.safeSummary || subject, 2000);
    let resolvedUserId = userId;
    if (orderId && !resolvedUserId) {
      const order = await (prisma as any).order.findUnique({ where: { id: orderId } });
      resolvedUserId = order?.userId || null;
    }
    const ticket = await (prisma as any).supportTicket.create({
      data: {
        userId: resolvedUserId,
        orderId,
        subject,
        category,
        status: 'OPEN',
        priority,
        safeSummary: message.slice(0, 280),
        contactChannel: 'ADMIN_CREATED',
        assignedAdminUserId: admin.id,
        lastMessageAt: now(),
        messages: { create: { senderType: 'ADMIN', senderAdminUserId: admin.id, body: message, safeBody: message, visibility: 'CUSTOMER_AND_SUPPORT' } }
      },
      include: { user: true, order: true, messages: { orderBy: { createdAt: 'asc' } } }
    });
    await adminAudit(admin, 'SUPPORT_TICKET_CREATED_BY_ADMIN', 'SupportTicket', ticket.id, { orderId, category, priority });
    await createSafeNotification(ticket.userId, 'support', 'support.ticket.created', 'support.ticket.created.private', { ticketId: ticket.id, orderId });
    return json(req, res, 201, supportTicketDto(ticket, true));
  }

  if (method === 'GET' && pathname === '/v1/admin/support/tickets') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT','READONLY']);
    const status = parsed.searchParams.get('status') || undefined;
    const where: JsonObject = status ? { status } : {};
    const items = await (prisma as any).supportTicket.findMany({ where, take: 100, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }], include: { user: true, order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    return json(req, res, 200, { items: items.map((ticket: any) => supportTicketDto(ticket, true)) });
  }

  const adminTicketMatch = pathname.match(/^\/v1\/admin\/support\/tickets\/([^/]+)$/);
  if (adminTicketMatch && method === 'GET') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT','READONLY']);
    const ticket = await (prisma as any).supportTicket.findUnique({ where: { id: adminTicketMatch[1] }, include: { user: true, order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    if (!ticket) throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Обращение не найдено.');
    return json(req, res, 200, supportTicketDto(ticket, true));
  }

  const adminTicketAssignMatch = pathname.match(/^\/v1\/admin\/support\/tickets\/([^/]+)\/assign$/);
  if (adminTicketAssignMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT']);
    const body = await readJson(req);
    const assignedAdminUserId = optionalStr(body.assignedAdminUserId, 80) || admin.id;
    const before = await (prisma as any).supportTicket.findUnique({ where: { id: adminTicketAssignMatch[1] } });
    if (!before) throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Обращение не найдено.');
    const ticket = await (prisma as any).supportTicket.update({ where: { id: before.id }, data: { assignedAdminUserId, updatedAt: now() }, include: { user: true, order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    await adminAudit(admin, 'SUPPORT_TICKET_ASSIGNED', 'SupportTicket', ticket.id, { from: before.assignedAdminUserId, to: assignedAdminUserId });
    return json(req, res, 200, supportTicketDto(ticket, true));
  }

  const adminTicketInternalNoteMatch = pathname.match(/^\/v1\/admin\/support\/tickets\/([^/]+)\/internal-note$/);
  if (adminTicketInternalNoteMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT']);
    const body = await readJson(req);
    const internalNote = str(body.internalNote || '', 2000);
    const before = await (prisma as any).supportTicket.findUnique({ where: { id: adminTicketInternalNoteMatch[1] } });
    if (!before) throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Обращение не найдено.');
    const ticket = await (prisma as any).supportTicket.update({ where: { id: before.id }, data: { internalNote, updatedAt: now() }, include: { user: true, order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    await adminAudit(admin, 'SUPPORT_TICKET_INTERNAL_NOTE_UPDATED', 'SupportTicket', ticket.id);
    return json(req, res, 200, supportTicketDto(ticket, true));
  }

  const adminTicketStatusMatch = pathname.match(/^\/v1\/admin\/support\/tickets\/([^/]+)\/status$/);
  if (adminTicketStatusMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT']);
    const body = await readJson(req);
    const status = str(body.status || 'OPEN', 40).toUpperCase();
    const allowed = ['OPEN','PENDING_CUSTOMER','PENDING_TEAM','RESOLVED','CLOSED'];
    if (!allowed.includes(status)) throw new ApiError(400, 'SUPPORT_STATUS_INVALID', 'Недопустимый статус обращения.');
    const before = await (prisma as any).supportTicket.findUnique({ where: { id: adminTicketStatusMatch[1] } });
    if (!before) throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Обращение не найдено.');
    const ticket = await (prisma as any).supportTicket.update({ where: { id: before.id }, data: { status, closedAt: ['RESOLVED','CLOSED'].includes(status) ? now() : null, updatedAt: now() }, include: { user: true, order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    await adminAudit(admin, 'SUPPORT_TICKET_STATUS_CHANGED', 'SupportTicket', ticket.id, { from: before.status, to: status, reason: str(body.reason || '', 240) });
    await createSafeNotification(ticket.userId, 'support', 'support.status.updated', 'support.status.updated.private', { ticketId: ticket.id, status });
    return json(req, res, 200, supportTicketDto(ticket, true));
  }

  const adminTicketReplyMatch = pathname.match(/^\/v1\/admin\/support\/tickets\/([^/]+)\/reply$/);
  if (adminTicketReplyMatch && method === 'POST') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT']);
    const body = await readJson(req);
    const message = redactSupportText(body.message, 2000);
    if (!message) throw new ApiError(400, 'SUPPORT_MESSAGE_REQUIRED', 'Сообщение не может быть пустым.');
    const ticket = await (prisma as any).supportTicket.findUnique({ where: { id: adminTicketReplyMatch[1] } });
    if (!ticket) throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Обращение не найдено.');
    await (prisma as any).supportMessage.create({ data: { ticketId: ticket.id, senderType: 'ADMIN', senderAdminUserId: admin.id, body: message, safeBody: message, visibility: 'CUSTOMER_AND_SUPPORT' } });
    const updated = await (prisma as any).supportTicket.update({ where: { id: ticket.id }, data: { status: 'PENDING_CUSTOMER', lastMessageAt: now(), updatedAt: now() }, include: { user: true, order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    await adminAudit(admin, 'SUPPORT_TICKET_REPLIED', 'SupportTicket', ticket.id);
    await createSafeNotification(ticket.userId, 'support', 'support.reply', 'support.reply.private', { ticketId: ticket.id });
    return json(req, res, 200, supportTicketDto(updated, true));
  }

  if (method === 'GET' && pathname === '/v1/admin/catalog/products') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER','READONLY']);
    const items = await (prisma as any).productCatalogItem.findMany({ orderBy: { createdAt: 'desc' }, include: { prices: { take: 1, orderBy: { validFrom: 'desc' } }, inventory: true } });
    return json(req, res, 200, { items });
  }
  if (method === 'POST' && pathname === '/v1/admin/catalog/products') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER']);
    const body = await readJson(req);
    const sku = str(body.sku, 80);
    if (!sku) throw new ApiError(400, 'SKU_REQUIRED', 'SKU обязателен.');
    const product = await (prisma as any).productCatalogItem.create({ data: { sku, nameRu: str(body.nameRu, 160), nameEn: str(body.nameEn || body.nameRu, 160), nameHy: str(body.nameHy || body.nameRu, 160), category: str(body.category || 'OTHER', 80), description: optionalStr(body.description, 500), imageUrl: optionalStr(body.imageUrl, 500), isActive: body.isActive !== false, costMinor: int(body.costMinor, 0), lowStockThreshold: int(body.lowStockThreshold, 10), isIncludedInPlan: Boolean(body.isIncludedInPlan), isRecommendedOnly: Boolean(body.isRecommendedOnly), isPaidAddon: Boolean(body.isPaidAddon), isOneTimeAddon: Boolean(body.isOneTimeAddon), isRecurringAddon: Boolean(body.isRecurringAddon), visibleInApp: body.visibleInApp !== false } });
    const priceMinor = int(body.priceMinor, 0);
    if (priceMinor > 0) await (prisma as any).productPrice.create({ data: { productId: product.id, amountMinor: priceMinor, currency: 'AMD' } });
    await (prisma as any).inventoryItem.create({ data: { productId: product.id, availableQuantity: int(body.availableQuantity, 0), reservedQuantity: 0 } }).catch(() => null);
    await adminAudit(admin, 'CATALOG_PRODUCT_CREATED', 'ProductCatalogItem', product.id, { sku });
    return json(req, res, 201, { product });
  }
  const productMatch = pathname.match(/^\/v1\/admin\/catalog\/products\/([^/]+)$/);
  if (productMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER']);
    const body = await readJson(req);
    const product = await (prisma as any).productCatalogItem.update({ where: { id: productMatch[1] }, data: { nameRu: body.nameRu ? str(body.nameRu, 160) : undefined, nameEn: body.nameEn ? str(body.nameEn, 160) : undefined, nameHy: body.nameHy ? str(body.nameHy, 160) : undefined, category: body.category ? str(body.category, 80) : undefined, description: body.description !== undefined ? optionalStr(body.description, 500) : undefined, isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined, costMinor: body.costMinor !== undefined ? int(body.costMinor, 0) : undefined, lowStockThreshold: body.lowStockThreshold !== undefined ? int(body.lowStockThreshold, 10) : undefined, isIncludedInPlan: body.isIncludedInPlan !== undefined ? Boolean(body.isIncludedInPlan) : undefined, isRecommendedOnly: body.isRecommendedOnly !== undefined ? Boolean(body.isRecommendedOnly) : undefined, isPaidAddon: body.isPaidAddon !== undefined ? Boolean(body.isPaidAddon) : undefined, isOneTimeAddon: body.isOneTimeAddon !== undefined ? Boolean(body.isOneTimeAddon) : undefined, isRecurringAddon: body.isRecurringAddon !== undefined ? Boolean(body.isRecurringAddon) : undefined, visibleInApp: body.visibleInApp !== undefined ? Boolean(body.visibleInApp) : undefined } });
    if (body.priceMinor !== undefined) await (prisma as any).productPrice.create({ data: { productId: product.id, amountMinor: int(body.priceMinor, 0), currency: 'AMD' } });
    await adminAudit(admin, 'CATALOG_PRODUCT_UPDATED', 'ProductCatalogItem', product.id);
    return json(req, res, 200, { product });
  }

  if (method === 'GET' && pathname === '/v1/admin/catalog/plans') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER','READONLY']);
    const items = await (prisma as any).boxPlan.findMany({ include: { includedItems: { include: { product: true } } } });
    return json(req, res, 200, { items });
  }

  if (method === 'GET' && pathname === '/v1/admin/inventory') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER','READONLY']);
    const items = await (prisma as any).inventoryItem.findMany({ include: { product: true }, orderBy: { updatedAt: 'desc' } });
    return json(req, res, 200, { items });
  }
  const inventoryMatch = pathname.match(/^\/v1\/admin\/inventory\/([^/]+)$/);
  if (inventoryMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','CATALOG_MANAGER']);
    const body = await readJson(req);
    const current = await (prisma as any).inventoryItem.findFirst({ where: { productId: inventoryMatch[1] } });
    const nextAvailable = int(body.availableQuantity, current?.availableQuantity || 0);
    const item = await (prisma as any).inventoryItem.upsert({ where: { productId_warehouseId: { productId: inventoryMatch[1], warehouseId: 'gyumri-main' } }, update: { availableQuantity: nextAvailable }, create: { productId: inventoryMatch[1], warehouseId: 'gyumri-main', availableQuantity: nextAvailable } });
    await (prisma as any).inventoryMovement.create({ data: { productId: inventoryMatch[1], type: 'ADJUSTMENT', quantity: nextAvailable - (current?.availableQuantity || 0), reason: str(body.reason || 'admin adjustment', 240), adminUserId: admin.id } }).catch(() => null);
    await adminAudit(admin, 'INVENTORY_ADJUSTED', 'ProductCatalogItem', inventoryMatch[1], { availableQuantity: nextAvailable });
    return json(req, res, 200, { item });
  }

  if (method === 'GET' && pathname === '/v1/admin/delivery-addresses') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER','SUPPORT','READONLY']);
    const items = await (prisma as any).deliveryAddress.findMany({
      take: 500,
      orderBy: { updatedAt: 'desc' },
      include: { user: { include: { subscriptions: { where: { cancelledAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } } } },
    });
    return json(req, res, 200, {
      items: items.map((address: any) => ({
        ...safeDelivery(address),
        customer: safeCustomer(address.user),
        plan: address.planCode || address.user?.subscriptions?.[0]?.plan || null,
        subscriptionStatus: address.user?.subscriptions?.[0]?.status || null,
      })),
    });
  }

  if (method === 'GET' && pathname === '/v1/admin/delivery-map') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER','SUPPORT','READONLY']);
    const items = await (prisma as any).deliveryAddress.findMany({
      where: { validationStatus: 'verified' },
      take: 1000,
      orderBy: { updatedAt: 'desc' },
      include: { user: { include: { subscriptions: { where: { cancelledAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } } } },
    });
    return json(req, res, 200, {
      items: items.map((address: any) => ({
        id: address.id,
        latitude: address.latitude,
        longitude: address.longitude,
        formattedAddress: address.formattedAddress,
        customer: safeCustomer(address.user),
        plan: address.planCode || address.user?.subscriptions?.[0]?.plan || null,
        validationStatus: address.validationStatus,
        deliveryIncludedInPlan: address.deliveryIncludedInPlan !== false,
        updatedAt: address.updatedAt?.toISOString?.() || null,
      })),
    });
  }

  const customerDeliveryProfileMatch = pathname.match(/^\/v1\/admin\/customers\/([^/]+)\/delivery-profile$/);
  if (customerDeliveryProfileMatch && method === 'GET') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER','SUPPORT','READONLY']);
    const customer = await (prisma as any).user.findUnique({
      where: { id: customerDeliveryProfileMatch[1] },
      include: {
        deliveryAddresses: { orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] },
        subscriptions: { where: { cancelledAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Клиент не найден.');
    await adminAudit(admin, 'DELIVERY_PROFILE_VIEWED', 'User', customer.id, { scope: 'delivery_only' });
    return json(req, res, 200, {
      customer: safeCustomer(customer),
      subscription: customer.subscriptions?.[0] ? { plan: customer.subscriptions[0].plan, status: customer.subscriptions[0].status, deliveryWindow: customer.subscriptions[0].deliveryWindow } : null,
      addresses: customer.deliveryAddresses.map(safeDelivery),
      privacy: { cycleDataIncluded: false, symptomsIncluded: false, privateNotesIncluded: false },
    });
  }

  if (method === 'GET' && pathname === '/v1/admin/delivery/tasks') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER','COURIER','READONLY']);
    let where: JsonObject = {};
    if (admin.role === 'COURIER') {
      const courier = await courierFromAdmin(admin);
      if (!courier) throw new ApiError(403, 'COURIER_PROFILE_REQUIRED', 'Профиль курьера не найден.');
      where = { courierId: courier.id };
    }
    const items = await (prisma as any).deliveryTask.findMany({ where, take: 100, orderBy: { updatedAt: 'desc' }, include: { order: { include: { deliveryAddress: true } } } });
    return json(req, res, 200, { items: items.map(courierTaskDto) });
  }
  const deliveryMatch = pathname.match(/^\/v1\/admin\/delivery\/tasks\/([^/]+)\/status$/);
  if (deliveryMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER','COURIER']);
    const currentTask = await (prisma as any).deliveryTask.findUnique({ where: { id: deliveryMatch[1] }, select: { id: true, courierId: true, status: true } });
    if (!currentTask) throw new ApiError(404, 'DELIVERY_NOT_FOUND', 'Доставка не найдена.');
    if (admin.role === 'COURIER') {
      const courier = await courierFromAdmin(admin);
      if (!courier) throw new ApiError(403, 'COURIER_PROFILE_REQUIRED', 'Профиль курьера не найден.');
      if (currentTask.courierId !== courier.id) throw new ApiError(403, 'DELIVERY_TASK_FORBIDDEN', 'Эта доставка не назначена текущему курьеру.');
    }
    const body = await readJson(req);
    const status = str(body.status, 60).toUpperCase();
    if (!canTransitionDelivery(currentTask.status, status, admin.role)) throw new ApiError(409, 'DELIVERY_STATUS_TRANSITION_INVALID', 'Недопустимый переход статуса доставки.');
    const task = await (prisma as any).deliveryTask.update({ where: { id: deliveryMatch[1] }, data: { status } });
    const orderStatus = status === 'DELIVERED' ? 'DELIVERED' : status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : null;
    if (orderStatus) {
      await (prisma as any).order.update({ where: { id: task.orderId }, data: { status: orderStatus } });
      await createPublicOrderEvent(task.orderId, orderStatus, str(body.reason || 'delivery update', 240));
    }
    await adminAudit(admin, 'DELIVERY_STATUS_CHANGED', 'DeliveryTask', task.id, { status });
    return json(req, res, 200, { task });
  }



  const deliveryV2StatusMatch = pathname.match(/^\/v1\/admin\/deliveries\/([^/]+)\/status$/);
  if (deliveryV2StatusMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER','COURIER']);
    const currentTask = await (prisma as any).deliveryTask.findUnique({ where: { id: deliveryV2StatusMatch[1] }, select: { id: true, courierId: true, status: true } });
    if (!currentTask) throw new ApiError(404, 'DELIVERY_NOT_FOUND', 'Доставка не найдена.');
    if (admin.role === 'COURIER') {
      const courier = await courierFromAdmin(admin);
      if (!courier) throw new ApiError(403, 'COURIER_PROFILE_REQUIRED', 'Профиль курьера не найден.');
      if (currentTask.courierId !== courier.id) throw new ApiError(403, 'DELIVERY_TASK_FORBIDDEN', 'Эта доставка не назначена текущему курьеру.');
    }
    const body = await readJson(req);
    const status = str(body.status, 60).toUpperCase();
    if (!canTransitionDelivery(currentTask.status, status, admin.role)) throw new ApiError(409, 'DELIVERY_STATUS_TRANSITION_INVALID', 'Недопустимый переход статуса доставки.');
    const task = await (prisma as any).deliveryTask.update({ where: { id: deliveryV2StatusMatch[1] }, data: { status } });
    const orderStatus = status === 'DELIVERED' ? 'DELIVERED' : status === 'OUT_FOR_DELIVERY' || status === 'PICKED_UP' ? 'OUT_FOR_DELIVERY' : status === 'DELIVERY_ISSUE' ? 'ISSUE' : null;
    if (orderStatus) {
      await (prisma as any).order.update({ where: { id: task.orderId }, data: { status: orderStatus } });
      await createPublicOrderEvent(task.orderId, orderStatus, str(body.reason || 'delivery update', 240));
    }
    await adminAudit(admin, 'DELIVERY_STATUS_CHANGED', 'DeliveryTask', task.id, { status });
    return json(req, res, 200, { task });
  }

  if (method === 'GET' && pathname === '/v1/admin/subscriptions') {
    requireRole(admin, ['OWNER','ADMIN','SUPPORT','READONLY']);
    const items = await (prisma as any).subscription.findMany({ take: 100, orderBy: { updatedAt: 'desc' }, include: { user: true, orders: { take: 1, orderBy: { createdAt: 'desc' } } } });
    return json(req, res, 200, { items: items.map(subscriptionDto) });
  }

  const subscriptionMatch = pathname.match(/^\/v1\/admin\/subscriptions\/([^/]+)$/);
  if (subscriptionMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN']);
    const body = await readJson(req);
    const before = await (prisma as any).subscription.findUnique({ where: { id: subscriptionMatch[1] } });
    if (!before) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Подписка не найдена.');
    const data = { ...(before.data || {}) };
    if (body.recurringAddOns !== undefined) data.recurringAddOns = Array.isArray(body.recurringAddOns) ? body.recurringAddOns : [];
    if (body.recurringMonthlyTotalMinor !== undefined) data.recurringMonthlyTotalMinor = int(body.recurringMonthlyTotalMinor, 0);
    const updated = await (prisma as any).subscription.update({ where: { id: before.id }, data: {
      status: body.status ? str(body.status, 40) : undefined,
      nextDeliveryDate: body.nextDeliveryDate ? new Date(body.nextDeliveryDate) : undefined,
      nextBillingDate: body.nextBillingDate ? new Date(body.nextBillingDate) : undefined,
      data,
    }, include: { user: true, orders: { take: 1, orderBy: { createdAt: 'desc' } } } });
    await adminAudit(admin, 'SUBSCRIPTION_UPDATED', 'Subscription', updated.id, { beforeStatus: before.status, afterStatus: updated.status, reason: str(body.reason || 'subscription update', 240) });
    return json(req, res, 200, { subscription: subscriptionDto(updated) });
  }

  if (method === 'GET' && pathname === '/v1/admin/couriers') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER','READONLY']);
    const items = await (prisma as any).courier.findMany({ orderBy: { createdAt: 'desc' }, include: { assignments: true } });
    return json(req, res, 200, { items: items.map((c: any) => ({ id: c.id, adminUserId: c.adminUserId, name: c.name, phone: c.phone, isActive: c.isActive, assignmentsCount: c.assignments?.length || 0, createdAt: c.createdAt?.toISOString?.() })) });
  }

  if (method === 'POST' && pathname === '/v1/admin/couriers') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER']);
    const body = await readJson(req);
    const name = str(body.name, 120);
    if (!name) throw new ApiError(400, 'COURIER_NAME_REQUIRED', 'Имя курьера обязательно.');
    const courier = await (prisma as any).courier.create({ data: { name, phone: optionalStr(body.phone, 40), adminUserId: optionalStr(body.adminUserId, 80), isActive: body.isActive !== false } });
    await adminAudit(admin, 'COURIER_CREATED', 'Courier', courier.id, { name });
    return json(req, res, 201, { courier });
  }

  const courierPatchMatch = pathname.match(/^\/v1\/admin\/couriers\/([^/]+)$/);
  if (courierPatchMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER']);
    const body = await readJson(req);
    const courier = await (prisma as any).courier.update({ where: { id: courierPatchMatch[1] }, data: { name: body.name ? str(body.name, 120) : undefined, phone: body.phone !== undefined ? optionalStr(body.phone, 40) : undefined, isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined, adminUserId: body.adminUserId !== undefined ? optionalStr(body.adminUserId, 80) : undefined } });
    await adminAudit(admin, 'COURIER_UPDATED', 'Courier', courier.id);
    return json(req, res, 200, { courier });
  }

  if (method === 'GET' && pathname === '/v1/admin/deliveries') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER','COURIER','READONLY']);
    const courier = admin.role === 'COURIER' ? await courierFromAdmin(admin) : null;
    const where = courier ? { courierId: courier.id } : {};
    const items = await (prisma as any).deliveryTask.findMany({ where, take: 100, orderBy: { updatedAt: 'desc' }, include: { order: { include: { deliveryAddress: true } } } });
    return json(req, res, 200, { items: items.map(courierTaskDto) });
  }

  const assignCourierMatch = pathname.match(/^\/v1\/admin\/deliveries\/([^/]+)\/assign-courier$/);
  if (assignCourierMatch && method === 'PATCH') {
    requireRole(admin, ['OWNER','ADMIN','COURIER_MANAGER']);
    const body = await readJson(req);
    const courierId = str(body.courierId, 80);
    if (!courierId) throw new ApiError(400, 'COURIER_REQUIRED', 'Выберите курьера.');
    const task = await (prisma as any).deliveryTask.findUnique({ where: { id: assignCourierMatch[1] }, include: { order: true } });
    if (!task) throw new ApiError(404, 'DELIVERY_NOT_FOUND', 'Доставка не найдена.');
    const courier = await (prisma as any).courier.findUnique({ where: { id: courierId } });
    if (!courier || !courier.isActive) throw new ApiError(404, 'COURIER_NOT_FOUND', 'Курьер не найден или выключен.');
    const updatedTask = await (prisma as any).deliveryTask.update({ where: { id: task.id }, data: { courierId, status: 'COURIER_ASSIGNED' } });
    await (prisma as any).courierAssignment.create({ data: { orderId: task.orderId, courierId, status: 'ASSIGNED' } }).catch(() => null);
    await (prisma as any).order.update({ where: { id: task.orderId }, data: { status: 'COURIER_ASSIGNED' } });
    await createPublicOrderEvent(task.orderId, 'COURIER_ASSIGNED', `assigned to courier ${courier.name}`);
    await adminAudit(admin, 'COURIER_ASSIGNED', 'DeliveryTask', task.id, { courierId, courierName: courier.name });
    return json(req, res, 200, { task: courierTaskDto({ ...updatedTask, order: task.order }) });
  }

  if (method === 'GET' && pathname === '/v1/admin/audit-log') {
    requireRole(admin, ['OWNER']);
    const items = await (prisma as any).auditLog.findMany({ take: 200, orderBy: { createdAt: 'desc' } });
    return json(req, res, 200, { items });
  }

  throw new ApiError(404, 'ADMIN_ROUTE_NOT_FOUND', 'Admin route not found.');
}

async function router(req: AuthedRequest, res: ServerResponse) {
  req.requestId = String(req.headers['x-request-id'] || randomUUID());
  if (req.method === 'OPTIONS') return json(req, res, 204, {});
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = route(parsed.pathname);
  const method = req.method || 'GET';

  if (method === 'GET' && pathname === '/health') {
    return json(req, res, 200, {
      ok: true,
      version: '2.0.0-admin-ops',
      build: 120,
      appEnv: env.appEnv,
      databaseConfigured: Boolean(env.databaseUrl),
      redisConfigured: Boolean(env.redisUrl),
      redisRequired: env.requireRedis,
      firebaseProjectConfigured: Boolean(env.firebaseProjectId),
      firebaseAdminConfigured: Boolean(env.firebaseServiceAccountJson || env.firebaseApplicationCredentials || (env.firebaseClientEmail && env.firebasePrivateKey)),
      firebaseRestConfigured: Boolean(env.firebaseProjectId && env.firebaseWebApiKey),
      emailDeliveryConfigured: isEmailDeliveryConfigured(),
      emailDeliveryMode: getEmailDeliveryMode(),
      mapsProvider: env.mapTilerApiKey ? 'maptiler' : env.googleMapsServerApiKey ? 'google' : 'none',
      mapTilerConfigured: Boolean(env.mapTilerApiKey),
      googleMapsConfigured: Boolean(env.googleMapsServerApiKey),
      paymentProvider: env.paymentProvider,
    });
  }

  if (pathname.startsWith('/v1/maps/') && method === 'GET') return handleMapsProxy(pathname, parsed, req, res);


  if (method === 'POST' && pathname === '/v1/courier/auth/login') {
    const body = await readJson(req);
    const email = lowerEmail(body.email);
    const adminUser = await (prisma as any).adminUser.findUnique({ where: { email } });
    const role = normalizeAdminRole(adminUser?.role);
    if (!adminUser?.isActive || !['COURIER','COURIER_MANAGER','OWNER'].includes(role) || !await verifySecret(String(body.password || ''), adminUser.passwordHash)) {
      await adminAudit(null, 'COURIER_LOGIN_FAILED', 'AdminUser', null, { email });
      throw new ApiError(401, 'INVALID_COURIER_CREDENTIALS', 'Неверный email или пароль курьера.');
    }
    const token = randomUUID() + '.' + randomUUID();
    await (prisma as any).adminSession.create({ data: { adminUserId: adminUser.id, tokenHash: stableHash(token, env.jwtRefreshSecret), expiresAt: future(adminSessionTtlMs) } });
    const admin = { id: adminUser.id, email: adminUser.email, name: adminUser.name, role };
    await adminAudit(admin, 'COURIER_LOGIN', 'AdminUser', admin.id);
    return json(req, res, 200, { courier: { id: admin.id, email: admin.email, name: admin.name, role }, accessToken: token });
  }

  if (pathname.startsWith('/v1/courier/')) {
    const courierAdmin = await requireAdmin(req, ['OWNER','COURIER_MANAGER','COURIER']);
    if (method === 'GET' && pathname === '/v1/courier/me') return json(req, res, 200, { courier: courierAdmin });
    const courier = courierAdmin.role === 'COURIER' ? await courierFromAdmin(courierAdmin) : null;
    if (method === 'GET' && pathname === '/v1/courier/deliveries') {
      const where = courier ? { courierId: courier.id } : {};
      const tasks = await (prisma as any).deliveryTask.findMany({ where, orderBy: { updatedAt: 'desc' }, include: { order: { include: { deliveryAddress: true } } } });
      return json(req, res, 200, { items: tasks.map(courierTaskDto) });
    }
    const courierDeliveryMatch = pathname.match(/^\/v1\/courier\/deliveries\/([^/]+)$/);
    if (courierDeliveryMatch && method === 'GET') {
      const where: any = { id: courierDeliveryMatch[1] };
      if (courier) where.courierId = courier.id;
      const task = await (prisma as any).deliveryTask.findFirst({ where, include: { order: { include: { deliveryAddress: true } } } });
      if (!task) throw new ApiError(404, 'DELIVERY_NOT_FOUND', 'Доставка не найдена.');
      return json(req, res, 200, courierTaskDto(task));
    }
    const courierStatusMatch = pathname.match(/^\/v1\/courier\/deliveries\/([^/]+)\/status$/);
    if (courierStatusMatch && method === 'PATCH') {
      const body = await readJson(req);
      const where: any = { id: courierStatusMatch[1] };
      if (courier) where.courierId = courier.id;
      const task = await (prisma as any).deliveryTask.findFirst({ where });
      if (!task) throw new ApiError(404, 'DELIVERY_NOT_FOUND', 'Доставка не найдена.');
      const status = str(body.status, 60).toUpperCase();
      if (!canTransitionDelivery(task.status, status, courierAdmin.role)) throw new ApiError(409, 'DELIVERY_STATUS_TRANSITION_INVALID', 'Недопустимый переход статуса доставки.');
      const updated = await (prisma as any).deliveryTask.update({ where: { id: task.id }, data: { status } });
      const orderStatus = status === 'DELIVERED' ? 'DELIVERED' : status === 'OUT_FOR_DELIVERY' || status === 'PICKED_UP' ? 'OUT_FOR_DELIVERY' : status === 'DELIVERY_ISSUE' ? 'ISSUE' : null;
      if (orderStatus) {
        await (prisma as any).order.update({ where: { id: task.orderId }, data: { status: orderStatus } });
        await createPublicOrderEvent(task.orderId, orderStatus, str(body.reason || 'courier update', 240));
      }
      await adminAudit(courierAdmin, 'COURIER_DELIVERY_STATUS_CHANGED', 'DeliveryTask', task.id, { status });
      return json(req, res, 200, { task: courierTaskDto(updated) });
    }
    const courierProblemMatch = pathname.match(/^\/v1\/courier\/deliveries\/([^/]+)\/problem$/);
    if (courierProblemMatch && method === 'POST') {
      const body = await readJson(req);
      const where: any = { id: courierProblemMatch[1] };
      if (courier) where.courierId = courier.id;
      const task = await (prisma as any).deliveryTask.findFirst({ where });
      if (!task) throw new ApiError(404, 'DELIVERY_NOT_FOUND', 'Доставка не найдена.');
      if (!canTransitionDelivery(task.status, 'DELIVERY_ISSUE', courierAdmin.role)) throw new ApiError(409, 'DELIVERY_STATUS_TRANSITION_INVALID', 'Недопустимый переход статуса доставки.');
      await (prisma as any).deliveryTask.update({ where: { id: task.id }, data: { status: 'DELIVERY_ISSUE' } });
      await (prisma as any).order.update({ where: { id: task.orderId }, data: { status: 'ISSUE' } });
      await createPublicOrderEvent(task.orderId, 'ISSUE', str(body.problem || 'courier problem', 500));
      await adminAudit(courierAdmin, 'COURIER_DELIVERY_PROBLEM', 'DeliveryTask', task.id, { problem: str(body.problem || '', 500) });
      return json(req, res, 200, { ok: true });
    }
    const courierLocationMatch = pathname.match(/^\/v1\/courier\/deliveries\/([^/]+)\/location$/);
    if (courierLocationMatch && method === 'POST') {
      const body = await readJson(req);
      await adminAudit(courierAdmin, 'COURIER_LOCATION_PING', 'DeliveryTask', courierLocationMatch[1], { latitude: Number(body.latitude), longitude: Number(body.longitude) });
      return json(req, res, 200, { ok: true });
    }
    throw new ApiError(404, 'COURIER_ROUTE_NOT_FOUND', 'Courier route not found.');
  }

  if (pathname.startsWith('/v1/admin/')) return handleAdminRoutes(pathname, parsed, method, req, res);


  if (method === 'POST' && pathname === '/v1/auth/firebase/session') {
    await rateLimit(`firebase-session:${req.socket.remoteAddress}`, 30, 300);
    const body = await readJson(req);
    const idToken = str(body.idToken, 12000);
    if (!idToken) throw new ApiError(400, 'FIREBASE_ID_TOKEN_REQUIRED', 'Firebase ID token is required.');
    return json(req, res, 200, await sessionFromFirebaseIdToken(idToken, req, {
      ...(body.profile || {}),
      provider: body.provider,
    }));
  }

  const legacyAuthRoutes = new Set([
    '/v1/auth/register',
    '/v1/auth/verify-email',
    '/v1/auth/login',
    '/v1/auth/phone/start',
    '/v1/auth/phone/verify',
    '/v1/auth/google',
    '/v1/auth/password-reset/request',
    '/v1/auth/password-reset/confirm',
  ]);
  if (env.authProvider === 'firebase' && legacyAuthRoutes.has(pathname)) {
    throw new ApiError(410, 'LEGACY_AUTH_DISABLED', 'This LOUSA backend accepts Firebase Auth only.');
  }

  if (method === 'POST' && pathname === '/v1/auth/register') {
    await rateLimit(`register:${req.socket.remoteAddress}`, 8, 300);
    const body = await readJson(req);
    const email = lowerEmail(body.email);
    const password = String(body.password || '');
    const name = str(body.name || email.split('@')[0] || 'LOUSA', 120);
    if (!email.includes('@')) throw new ApiError(400, 'INVALID_EMAIL', 'Введите корректный email.');
    if (password.length < 8) throw new ApiError(400, 'WEAK_PASSWORD', 'Пароль должен быть не короче 8 символов.');
    const existing = await (prisma as any).user.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) throw new ApiError(409, 'EMAIL_EXISTS', 'Этот email уже зарегистрирован.');
    const code = generateCode();
    const expiresAt = future(minutes(env.verificationCodeTtlMinutes));
    await (prisma as any).emailVerification.create({ data: { email, purpose: 'registration', codeHash: await hashSecret(code, 32), expiresAt, lastSentAt: now() } });
    await (prisma as any).user.upsert({
      where: { email },
      update: { name, passwordHash: await hashSecret(password), language: language(body.language), status: 'pending' },
      create: { email, name, passwordHash: await hashSecret(password), language: language(body.language), status: 'pending' },
    });
    if (env.redisUrl) await redis.setEx(`otp:cooldown:${email}:registration`, 60, '1');
    let emailResult: Awaited<ReturnType<typeof sendVerificationEmail>> | null = null;
    try {
      emailResult = await sendVerificationEmail({ email, code, locale: language(body.language), purpose: 'registration', expiresAt });
    } catch (error) {
      console.error('[email-delivery] registration failed', error);
      if (env.appEnv === 'production') throw emailDeliveryFailure();
      emailResult = { provider: 'console-dev', devCode: code };
      console.info(`[dev-email-fallback] registration ${email}: ${code}`);
    }
    return json(req, res, 200, { expiresAt: expiresAt.toISOString(), resendAfterSeconds: 60, ...safeEmailDeliveryPayload(emailResult, code) });
  }

  if (method === 'POST' && pathname === '/v1/auth/verify-email') {
    const body = await readJson(req);
    const email = lowerEmail(body.email);
    const code = str(body.code, 6);
    const verification = await (prisma as any).emailVerification.findFirst({ where: { email, purpose: 'registration', usedAt: null, expiresAt: { gt: now() } }, orderBy: { createdAt: 'desc' } });
    if (!verification) throw new ApiError(400, 'OTP_EXPIRED', 'Код истёк. Запросите новый.');
    if (verification.attempts >= 5) throw new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Слишком много попыток.');
    const ok = await verifySecret(code, verification.codeHash);
    if (!ok) {
      await (prisma as any).emailVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } });
      throw new ApiError(400, 'INVALID_OTP', 'Неверный код.');
    }
    const user = await (prisma as any).user.update({ where: { email }, data: { emailVerifiedAt: now(), status: 'active' } });
    await (prisma as any).emailVerification.update({ where: { id: verification.id }, data: { usedAt: now() } });
    await (prisma as any).consentRecord.createMany({ data: [
      { userId: user.id, type: 'PRIVACY_POLICY', version: 'v1', locale: user.language || 'ru', source: 'registration' },
      { userId: user.id, type: 'HEALTH_DATA_PROCESSING', version: 'v1', locale: user.language || 'ru', source: 'registration' },
    ], skipDuplicates: true }).catch(() => null);
    return json(req, res, 200, await sessionPayload(user, req, { isNewUser: true }));
  }

  if (method === 'POST' && pathname === '/v1/auth/login') {
    await rateLimit(`login:${req.socket.remoteAddress}`, 15, 300);
    const body = await readJson(req);
    await ensureDemoUser();
    const email = lowerEmail(body.email);
    const user = await (prisma as any).user.findUnique({ where: { email } });
    if (!user || user.deletedAt || user.status === 'deleted') throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
    if (!await verifySecret(String(body.password || ''), user.passwordHash)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
    return json(req, res, 200, await sessionPayload(user, req));
  }

  if (method === 'POST' && pathname === '/v1/auth/phone/start') {
    await rateLimit(`phone-start:${req.socket.remoteAddress}`, 10, 300);
    const body = await readJson(req);
    const phone = normalizePhone(body.phone);
    await rateLimit(`phone-start:${phone}`, 4, 300);
    const code = generateCode();
    const expiresAt = future(minutes(env.verificationCodeTtlMinutes));
    await (prisma as any).phoneVerification.create({
      data: {
        phone,
        purpose: 'login',
        codeHash: await hashSecret(code, 32),
        expiresAt,
        lastSentAt: now(),
      },
    });
    if (env.redisUrl) await redis.setEx(`otp:cooldown:${phone}:phone`, 60, '1');
    let smsResult: Awaited<ReturnType<typeof sendPhoneOtp>> | null = null;
    try {
      smsResult = await sendPhoneOtp(phone, code);
    } catch (error) {
      console.error('[sms-delivery] phone auth failed', error);
      if (env.appEnv === 'production') throw smsDeliveryFailure();
      smsResult = { provider: 'console-dev', devCode: code };
      console.info(`[dev-sms-fallback] phone ${phone}: ${code}`);
    }
    return json(req, res, 200, { expiresAt: expiresAt.toISOString(), resendAfterSeconds: 60, ...safeSmsDeliveryPayload(smsResult, code) });
  }

  if (method === 'POST' && pathname === '/v1/auth/phone/verify') {
    await rateLimit(`phone-verify:${req.socket.remoteAddress}`, 20, 300);
    const body = await readJson(req);
    const phone = normalizePhone(body.phone);
    const code = str(body.code, 6);
    const verification = await (prisma as any).phoneVerification.findFirst({
      where: { phone, purpose: 'login', usedAt: null, expiresAt: { gt: now() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification) throw new ApiError(400, 'OTP_EXPIRED', 'Код истёк. Запросите новый.');
    if (verification.attempts >= 5) throw new ApiError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Слишком много попыток.');
    const isValid = await verifySecret(code, verification.codeHash);
    if (!isValid) {
      await (prisma as any).phoneVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } });
      throw new ApiError(400, 'INVALID_PHONE_OTP', 'Неверный SMS-код.');
    }
    let user = await (prisma as any).user.findFirst({ where: { phone, deletedAt: null } });
    let isNewUser = false;
    if (!user) {
      const email = phoneLocalEmail(phone);
      user = await (prisma as any).user.create({
        data: {
          email,
          phone,
          emailVerifiedAt: null,
          name: 'LOUSA',
          language: language(body.language),
          status: 'active',
        },
      });
      isNewUser = true;
      await (prisma as any).authIdentity.create({ data: { userId: user.id, provider: 'phone', providerSubject: phone, providerEmail: null } }).catch(() => null);
    }
    await (prisma as any).phoneVerification.update({ where: { id: verification.id }, data: { usedAt: now() } });
    return json(req, res, 200, await sessionPayload(user, req, { isNewUser }));
  }

  if (method === 'POST' && pathname === '/v1/auth/google') {
    const body = await readJson(req);
    const idToken = str(body.idToken, 5000);
    if (!idToken) throw new ApiError(400, 'GOOGLE_TOKEN_REQUIRED', 'Google token is required.');
    if (!allowedGoogleAudiences.length) throw new ApiError(503, 'GOOGLE_AUTH_NOT_CONFIGURED', 'Google OAuth client IDs are not configured for this backend.');
    const ticket = await googleClient.verifyIdToken({ idToken, audience: allowedGoogleAudiences });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) throw new ApiError(401, 'GOOGLE_TOKEN_INVALID', 'Google account email is not verified.');
    const identity = await (prisma as any).authIdentity.findUnique({ where: { provider_providerSubject: { provider: 'google', providerSubject: payload.sub } }, include: { user: true } });
    let user = identity?.user;
    let isNewUser = false;
    if (!user) {
      const email = lowerEmail(payload.email);
      const found = await (prisma as any).user.findUnique({ where: { email } });
      user = found || await (prisma as any).user.create({ data: { email, emailVerifiedAt: now(), name: payload.name || email.split('@')[0], language: 'ru', status: 'active' } });
      isNewUser = !found;
      await (prisma as any).authIdentity.create({ data: { userId: user.id, provider: 'google', providerSubject: payload.sub, providerEmail: email } });
    }
    return json(req, res, 200, await sessionPayload(user, req, { isNewUser }));
  }

  if (method === 'POST' && pathname === '/v1/auth/refresh') {
    const body = await readJson(req);
    const refreshToken = str(body.refreshToken, 200);
    const hash = `refresh:${stableHash(refreshToken, env.jwtRefreshSecret)}`;
    const session = await (prisma as any).session.findFirst({ where: { refreshTokenHash: hash, revokedAt: null, expiresAt: { gt: now() } } });
    if (!session) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh session expired.');
    await (prisma as any).session.update({ where: { id: session.id }, data: { revokedAt: now() } });
    const user = await (prisma as any).user.findUnique({ where: { id: session.userId } });
    if (!user || user.deletedAt) throw new ApiError(401, 'UNAUTHORIZED', 'User not found.');
    return json(req, res, 200, await sessionPayload(user, req));
  }

  if (method === 'POST' && pathname === '/v1/auth/logout') {
    const token = getBearer(req);
    if (token) await (prisma as any).session.updateMany({ where: { refreshTokenHash: `access:${stableHash(token, env.jwtAccessSecret)}`, revokedAt: null }, data: { revokedAt: now() } });
    return json(req, res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/v1/auth/logout-all') {
    const user = await requireUser(req);
    await (prisma as any).session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now() } });
    return json(req, res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/v1/auth/password-reset/request') {
    const body = await readJson(req);
    const email = lowerEmail(body.email);
    const user = await (prisma as any).user.findUnique({ where: { email } });
    if (user && !user.deletedAt) {
      const code = generateCode();
      const expiresAt = future(minutes(env.verificationCodeTtlMinutes));
      await (prisma as any).passwordReset.create({ data: { email, resetTokenHash: await hashSecret(code, 32), expiresAt } });
      let emailResult: Awaited<ReturnType<typeof sendVerificationEmail>> | null = null;
      try {
        emailResult = await sendVerificationEmail({ email, code, locale: language(body.language), purpose: 'password_reset', expiresAt });
      } catch (error) {
        console.error('[email-delivery] password reset failed', error);
        if (env.appEnv === 'production') throw emailDeliveryFailure();
        emailResult = { provider: 'console-dev', devCode: code };
        console.info(`[dev-email-fallback] password_reset ${email}: ${code}`);
      }
      return json(req, res, 200, { ok: true, ...safeEmailDeliveryPayload(emailResult, code) });
    }
    return json(req, res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/v1/auth/password-reset/confirm') {
    const body = await readJson(req);
    const email = lowerEmail(body.email);
    const code = str(body.code, 6);
    const password = String(body.password || '');
    if (password.length < 8) throw new ApiError(400, 'WEAK_PASSWORD', 'Пароль должен быть не короче 8 символов.');
    const reset = await (prisma as any).passwordReset.findFirst({ where: { email, usedAt: null, expiresAt: { gt: now() } }, orderBy: { createdAt: 'desc' } });
    if (!reset || !await verifySecret(code, reset.resetTokenHash)) throw new ApiError(400, 'INVALID_OTP', 'Неверный или истёкший код.');
    await (prisma as any).user.update({ where: { email }, data: { passwordHash: await hashSecret(password) } });
    await (prisma as any).passwordReset.update({ where: { id: reset.id }, data: { usedAt: now() } });
    await (prisma as any).session.updateMany({ where: { user: { email } }, data: { revokedAt: now() } });
    return json(req, res, 200, { ok: true });
  }

  const user = pathname.startsWith('/v1/') ? await requireUser(req) : null;


  if (method === 'GET' && pathname === '/v1/app/admin-v2-2-sync/health') {
    return json(req, res, 200, {
      api: 'online',
      supportTickets: true,
      orderTimeline: true,
      courierContact: true,
      notificationInbox: true,
      privacyBoundary: true,
      checkedAt: now().toISOString(),
    });
  }

  if (method === 'GET' && pathname === '/v1/app/notifications') {
    const items = await (prisma as any).notificationInboxItem.findMany({
      where: { userId: user.id },
      take: 80,
      orderBy: { createdAt: 'desc' },
    });
    return json(req, res, 200, { items: items.map(appNotificationDto) });
  }

  const appNotificationReadMatch = pathname.match(/^\/v1\/app\/notifications\/([^/]+)\/read$/);
  if (appNotificationReadMatch && method === 'POST') {
    await (prisma as any).notificationInboxItem.updateMany({
      where: { id: appNotificationReadMatch[1], userId: user.id },
      data: { readAt: now() },
    });
    return json(req, res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/v1/app/notifications/read-all') {
    await (prisma as any).notificationInboxItem.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: now() },
    });
    return json(req, res, 200, { ok: true });
  }



  if (method === 'GET' && pathname === '/v1/support/tickets') {
    const items = await (prisma as any).supportTicket.findMany({ where: { userId: user.id }, take: 50, orderBy: { updatedAt: 'desc' }, include: { order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    return json(req, res, 200, { items: items.map((ticket: any) => supportTicketDto(ticket, false)) });
  }

  if (method === 'POST' && pathname === '/v1/support/tickets') {
    const body = await readJson(req);
    const subject = str(body.subject || 'Обращение в поддержку', 160);
    const message = redactSupportText(body.message, 2000);
    const category = str(body.category || 'GENERAL', 40).toUpperCase();
    const orderId = optionalStr(body.orderId, 80);
    if (!message) throw new ApiError(400, 'SUPPORT_MESSAGE_REQUIRED', 'Сообщение не может быть пустым.');
    if (orderId) {
      const order = await (prisma as any).order.findFirst({ where: { id: orderId, userId: user.id, deletedAt: null } });
      if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    }
    const ticket = await (prisma as any).supportTicket.create({ data: { userId: user.id, orderId, subject, category, status: 'OPEN', priority: category === 'DELIVERY' ? 'HIGH' : 'NORMAL', safeSummary: message.slice(0, 280), contactChannel: 'IN_APP', lastMessageAt: now(), messages: { create: { senderType: 'CUSTOMER', senderUserId: user.id, body: message, safeBody: message, visibility: 'CUSTOMER_AND_SUPPORT' } } }, include: { order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    await (prisma as any).auditLog.create({ data: { actorId: user.id, actorRole: 'CUSTOMER', action: 'SUPPORT_TICKET_CREATED', entityType: 'SupportTicket', entityId: ticket.id, metadata: { category, orderId } } }).catch(() => null);
    return json(req, res, 201, supportTicketDto(ticket, false));
  }

  const appTicketMatch = pathname.match(/^\/v1\/support\/tickets\/([^/]+)$/);
  if (appTicketMatch && method === 'GET') {
    const ticket = await (prisma as any).supportTicket.findFirst({ where: { id: appTicketMatch[1], userId: user.id }, include: { order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    if (!ticket) throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Обращение не найдено.');
    return json(req, res, 200, supportTicketDto(ticket, false));
  }

  const appTicketMessageMatch = pathname.match(/^\/v1\/support\/tickets\/([^/]+)\/messages$/);
  if (appTicketMessageMatch && method === 'POST') {
    const body = await readJson(req);
    const message = redactSupportText(body.message, 2000);
    if (!message) throw new ApiError(400, 'SUPPORT_MESSAGE_REQUIRED', 'Сообщение не может быть пустым.');
    const ticket = await (prisma as any).supportTicket.findFirst({ where: { id: appTicketMessageMatch[1], userId: user.id } });
    if (!ticket) throw new ApiError(404, 'SUPPORT_TICKET_NOT_FOUND', 'Обращение не найдено.');
    await (prisma as any).supportMessage.create({ data: { ticketId: ticket.id, senderType: 'CUSTOMER', senderUserId: user.id, body: message, safeBody: message, visibility: 'CUSTOMER_AND_SUPPORT' } });
    const updated = await (prisma as any).supportTicket.update({ where: { id: ticket.id }, data: { status: 'PENDING_TEAM', lastMessageAt: now(), updatedAt: now() }, include: { order: true, messages: { orderBy: { createdAt: 'asc' } } } });
    return json(req, res, 200, supportTicketDto(updated, false));
  }

  const courierContactMatch = pathname.match(/^\/v1\/app\/orders\/([^/]+)\/courier-contact$/);
  if (courierContactMatch && method === 'GET') {
    const order = await (prisma as any).order.findFirst({ where: { id: courierContactMatch[1], userId: user.id, deletedAt: null }, include: { deliveryTasks: true, courierAssignments: { take: 1, orderBy: { assignedAt: 'desc' }, include: { courier: true } } } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    return json(req, res, 200, safeCourierContactDto(order));
  }

  const courierMessageMatch = pathname.match(/^\/v1\/app\/orders\/([^/]+)\/courier-message$/);
  if (courierMessageMatch && method === 'POST') {
    const body = await readJson(req);
    const message = redactSupportText(body.message, 1000);
    if (!message) throw new ApiError(400, 'COURIER_MESSAGE_REQUIRED', 'Сообщение курьеру не может быть пустым.');
    const order = await (prisma as any).order.findFirst({ where: { id: courierMessageMatch[1], userId: user.id, deletedAt: null }, include: { deliveryTasks: true } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    const ticket = await (prisma as any).supportTicket.create({ data: { userId: user.id, orderId: order.id, subject: 'Сообщение по доставке', category: 'DELIVERY', status: 'OPEN', priority: 'HIGH', safeSummary: message.slice(0, 280), contactChannel: 'COURIER_RELAY', lastMessageAt: now(), messages: { create: { senderType: 'CUSTOMER', senderUserId: user.id, body: message, safeBody: message, visibility: 'SUPPORT_AND_COURIER' } } } });
    await createSafeNotification(user.id, 'support', 'courier.message.sent', 'courier.message.sent.private', { orderId: order.id, ticketId: ticket.id });
    return json(req, res, 201, { ok: true, ticketId: ticket.id, message: 'Сообщение передано команде доставки.' });
  }

  if (method === 'GET' && pathname === '/v1/app/orders/active') {
    const items = await (prisma as any).order.findMany({ where: { userId: user.id, status: { notIn: ['DELIVERED','CANCELLED','REFUNDED'] } }, take: 5, orderBy: { updatedAt: 'desc' }, include: { orderEvents: { where: { visibleToCustomer: true }, orderBy: { createdAt: 'asc' } } } });
    return json(req, res, 200, { items: items.map((order: any) => ({ id: order.id, status: order.status, paymentStatus: order.paymentStatus, totalMinor: order.totalMinor, currency: order.currency, updatedAt: order.updatedAt, events: order.orderEvents })) });
  }
  const appTimelineMatch = pathname.match(/^\/v1\/app\/orders\/([^/]+)\/timeline$/);
  if (appTimelineMatch && method === 'GET') {
    const order = await (prisma as any).order.findFirst({ where: { id: appTimelineMatch[1], userId: user.id }, include: { orderEvents: { where: { visibleToCustomer: true }, orderBy: { createdAt: 'asc' } } } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    return json(req, res, 200, { orderId: order.id, status: order.status, events: order.orderEvents });
  }


  const appOrderDetailMatch = pathname.match(/^\/v1\/app\/orders\/([^/]+)$/);
  if (appOrderDetailMatch && method === 'GET') {
    const order = await (prisma as any).order.findFirst({ where: { id: appOrderDetailMatch[1], userId: user.id }, include: { items: { include: { product: true } }, quote: true, orderEvents: { where: { visibleToCustomer: true }, orderBy: { createdAt: 'asc' } } } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    return json(req, res, 200, { ...orderFromDb(order), timeline: order.orderEvents.map(publicTimelineEvent) });
  }

  const appCancelMatch = pathname.match(/^\/v1\/app\/orders\/([^/]+)\/cancel-request$/);
  if (appCancelMatch && method === 'POST') {
    const order = await (prisma as any).order.findFirst({ where: { id: appCancelMatch[1], userId: user.id } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    const body = await readJson(req);
    const reason = str(body.reason || 'customer requested cancellation', 500);
    await createPublicOrderEvent(order.id, 'ISSUE', reason);
    await (prisma as any).auditLog.create({ data: { actorId: user.id, actorRole: 'USER', action: 'CUSTOMER_CANCEL_REQUESTED', entityType: 'Order', entityId: order.id, metadata: { reason } } }).catch(() => null);
    return json(req, res, 200, { ok: true, orderId: order.id, status: order.status });
  }

  if (method === 'GET' && pathname === '/v1/app/subscription') {
    const subscription = await (prisma as any).subscription.findFirst({ where: { userId: user.id, cancelledAt: null }, orderBy: { createdAt: 'desc' } });
    return json(req, res, 200, subscription ? appSubscriptionDto(subscription) : null);
  }

  if (method === 'GET' && pathname === '/v1/cycle/settings') {
    const settings = await (prisma as any).cycleSettings.findUnique({ where: { userId: user.id } });
    if (!settings) return json(req, res, 200, null);
    const data = settings.data && typeof settings.data === 'object' ? settings.data : {};
    return json(req, res, 200, {
      averageCycleLength: settings.averageCycleLength,
      averagePeriodLength: settings.averagePeriodLength,
      onboardingProfile: data.onboardingProfile || null,
      schemaVersion: Number(data.schemaVersion || 1),
    });
  }
  if (method === 'PUT' && pathname === '/v1/cycle/settings') {
    const body = await readJson(req);
    const averageCycleLength = int(body.averageCycleLength, 28);
    const averagePeriodLength = int(body.averagePeriodLength, 5);
    if (averageCycleLength < 15 || averageCycleLength > 90) throw new ApiError(400, 'CYCLE_LENGTH_INVALID', 'Проверьте среднюю длину цикла.');
    if (averagePeriodLength < 1 || averagePeriodLength > 14) throw new ApiError(400, 'PERIOD_LENGTH_INVALID', 'Проверьте среднюю длительность менструации.');
    const onboardingProfile = body.onboardingProfile && typeof body.onboardingProfile === 'object' ? body.onboardingProfile : null;
    if (!onboardingProfile) throw new ApiError(400, 'QUESTIONNAIRE_REQUIRED', 'Не удалось сохранить настройки анкеты.');
    const allowedContexts = ['natural','pill','hormonal_iud','copper_iud','implant','injection','pregnant','postpartum','breastfeeding','perimenopause','amenorrhea','prefer_not_to_say'];
    const allowedFactors = ['pcos','endometriosis','thyroid','recent_contraception_change','recent_pregnancy','intense_training','weight_change','none','prefer_not_to_say'];
    const allowedGoals = ['track','symptoms','pregnancy','box','reminders'];
    const allowedStatuses = ['completed','skipped_cycle_date','partial'];
    const context = str(onboardingProfile.cycleContext || 'prefer_not_to_say', 80);
    if (!allowedContexts.includes(context)) throw new ApiError(400, 'CYCLE_CONTEXT_INVALID', 'Неизвестный контекст цикла.');
    const factors: string[] = Array.isArray(onboardingProfile.factors) ? [...new Set<string>(onboardingProfile.factors.map((item: unknown) => str(item, 80)))] : ['prefer_not_to_say'];
    if (!factors.length || factors.some((item) => !allowedFactors.includes(item))) throw new ApiError(400, 'CYCLE_FACTORS_INVALID', 'Проверьте факторы цикла.');
    const goals: string[] = Array.isArray(onboardingProfile.goals) ? [...new Set<string>(onboardingProfile.goals.map((item: unknown) => str(item, 80)))] : [];
    if (goals.some((item) => !allowedGoals.includes(item))) throw new ApiError(400, 'CYCLE_GOALS_INVALID', 'Проверьте цели использования.');
    const questionnaireStatus = str(onboardingProfile.questionnaireStatus || 'partial', 40);
    if (!allowedStatuses.includes(questionnaireStatus)) throw new ApiError(400, 'QUESTIONNAIRE_STATUS_INVALID', 'Неизвестный статус анкеты.');
    const schemaVersion = Math.max(1, Math.min(100, int(body.schemaVersion, 1)));
    const data = {
      onboardingProfile: {
        ...onboardingProfile,
        cycleContext: context,
        factors,
        goals,
        questionnaireStatus,
        questionnaireSchemaVersion: `cycle-profile-v${schemaVersion}`,
        updatedAt: now().toISOString(),
      },
      schemaVersion,
    };
    const settings = await (prisma as any).cycleSettings.upsert({
      where: { userId: user.id },
      update: { averageCycleLength, averagePeriodLength, regularity: str(onboardingProfile.regularity || 'unknown', 40), data },
      create: { userId: user.id, averageCycleLength, averagePeriodLength, regularity: str(onboardingProfile.regularity || 'unknown', 40), data },
    });
    return json(req, res, 200, { averageCycleLength: settings.averageCycleLength, averagePeriodLength: settings.averagePeriodLength, onboardingProfile: data.onboardingProfile, schemaVersion });
  }

  if (method === 'GET' && pathname === '/v1/periods') {
    const items = await (prisma as any).period.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { startDate: 'asc' } });
    return json(req, res, 200, { items: items.map(periodFromDb) });
  }
  if (method === 'POST' && pathname === '/v1/periods') {
    const body = await readJson(req);
    const id = str(body.id || randomUUID(), 80);
    const existingRows = await (prisma as any).period.findMany({ where: { userId: user.id, deletedAt: null } });
    let checked: any;
    try {
      checked = validateAndNormalizePeriodRecord({ ...body, id }, existingRows.map(periodFromDb), { ignoreId: id });
    } catch (error) {
      if (error instanceof CycleValidationError) throw new ApiError(400, error.code, error.message, error.details);
      throw error;
    }
    const startDate = new Date(`${checked.startDate}T12:00:00`);
    const endDate = checked.endDate ? new Date(`${checked.endDate}T12:00:00`) : null;
    const meta = syncMeta(body);
    const existing = await (prisma as any).period.findFirst({ where: { id, userId: user.id } });
    assertExpectedRevision(existing, meta);
    const { _sync: _ignoredSync, ...bodyWithoutSync } = body;
    const data = { ...bodyWithoutSync, ...checked, id, lastClientOperationId: meta?.operationId || null };
    const record = await (prisma as any).period.upsert({
      where: { id },
      update: { startDate, endDate, confirmed: checked.confirmed !== false, source: checked.source || 'user', data, revision: { increment: 1 }, updatedAt: now(), deletedAt: null },
      create: { id, userId: user.id, startDate, endDate, confirmed: checked.confirmed !== false, source: checked.source || 'user', data, revision: 1 },
    });
    return json(req, res, 200, periodFromDb(record));
  }
  const periodMatch = pathname.match(/^\/v1\/periods\/([^/]+)$/);
  if (periodMatch && method === 'PATCH') {
    const body = await readJson(req);
    const existing = await (prisma as any).period.findFirst({ where: { id: periodMatch[1], userId: user.id, deletedAt: null } });
    if (!existing) throw new ApiError(404, 'PERIOD_NOT_FOUND', 'Запись цикла не найдена.');
    const meta = syncMeta(body);
    assertExpectedRevision(existing, meta);
    const existingRows = await (prisma as any).period.findMany({ where: { userId: user.id, deletedAt: null } });
    let checked: any;
    try {
      checked = validateAndNormalizePeriodRecord({ ...periodFromDb(existing), ...body, id: existing.id }, existingRows.map(periodFromDb), { ignoreId: existing.id });
    } catch (error) {
      if (error instanceof CycleValidationError) throw new ApiError(400, error.code, error.message, error.details);
      throw error;
    }
    const updated = await (prisma as any).period.update({ where: { id: existing.id }, data: {
      startDate: new Date(`${checked.startDate}T12:00:00`),
      endDate: checked.endDate ? new Date(`${checked.endDate}T12:00:00`) : null,
      confirmed: checked.confirmed !== false,
      needsReview: Boolean(checked.needsReview),
      source: checked.source || existing.source,
      data: { ...(existing.data || {}), ...body, ...checked, _sync: undefined, lastClientOperationId: meta?.operationId || null },
      revision: { increment: 1 },
    } });
    return json(req, res, 200, periodFromDb(updated));
  }
  if (periodMatch && method === 'DELETE') {
    const body = await readJson(req).catch(() => ({}));
    const existing = await (prisma as any).period.findFirst({ where: { id: periodMatch[1], userId: user.id, deletedAt: null } });
    if (!existing) return json(req, res, 200, { ok: true });
    const meta = syncMeta(body);
    assertExpectedRevision(existing, meta);
    await (prisma as any).period.update({ where: { id: existing.id }, data: { deletedAt: now(), revision: { increment: 1 }, data: { ...(existing.data || {}), lastClientOperationId: meta?.operationId || null } } });
    return json(req, res, 200, { ok: true });
  }
  if (method === 'GET' && pathname === '/v1/prediction') {
    const [periods, observations] = await Promise.all([
      (prisma as any).period.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { startDate: 'asc' } }),
      (prisma as any).cycleObservation.findMany({ where: { userId: user.id, deletedAt: null, type: 'no_bleeding' }, orderBy: { date: 'asc' } }).catch(() => []),
    ]);
    return json(req, res, 200, calculateCyclePrediction(periods.map(periodFromDb), { negativeBleedingDates: observations.map((item: any) => item.date.toISOString().slice(0, 10)) }));
  }

  if (method === 'GET' && pathname === '/v1/cycle/calendar') {
    const [periods, observations] = await Promise.all([
      (prisma as any).period.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { startDate: 'asc' } }),
      (prisma as any).cycleObservation.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { date: 'asc' } }).catch(() => []),
    ]);
    const prediction = calculateCyclePrediction(periods.map(periodFromDb), { negativeBleedingDates: observations.filter((item: any) => item.type === 'no_bleeding').map((item: any) => item.date.toISOString().slice(0, 10)) });
    return json(req, res, 200, { periods: periods.map(periodFromDb), observations: observations.map(cycleObservationFromDb), prediction });
  }

  if (method === 'POST' && pathname === '/v1/cycle/recalculate') {
    const [periods, observations] = await Promise.all([
      (prisma as any).period.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { startDate: 'asc' } }),
      (prisma as any).cycleObservation.findMany({ where: { userId: user.id, deletedAt: null, type: 'no_bleeding' }, orderBy: { date: 'asc' } }).catch(() => []),
    ]);
    const prediction = calculateCyclePrediction(periods.map(periodFromDb), { negativeBleedingDates: observations.map((item: any) => item.date.toISOString().slice(0, 10)) });
    await (prisma as any).predictionSnapshot.create({ data: {
      userId: user.id,
      generatedAt: new Date(prediction.generatedAt || now()),
      mostLikelyStart: prediction.mostLikelyStart ? new Date(`${prediction.mostLikelyStart}T12:00:00`) : null,
      earliestStart: prediction.earliestStart ? new Date(`${prediction.earliestStart}T12:00:00`) : null,
      latestStart: prediction.latestStart ? new Date(`${prediction.latestStart}T12:00:00`) : null,
      confidence: prediction.confidence,
      confidenceScore: prediction.confidenceScore ?? null,
      sourcePeriodIds: periods.map((item: any) => item.id),
      data: prediction,
    } }).catch(() => null);
    return json(req, res, 200, prediction);
  }

  if (method === 'GET' && pathname === '/v1/cycle/observations') {
    const items = await (prisma as any).cycleObservation.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { date: 'asc' } });
    return json(req, res, 200, { items: items.map(cycleObservationFromDb) });
  }
  if (method === 'POST' && pathname === '/v1/cycle/observations') {
    const body = await readJson(req);
    let normalizedDate: string;
    try { normalizedDate = validateCycleObservationDate(str(body.date, 10)); } catch (error) {
      if (error instanceof CycleValidationError) throw new ApiError(400, error.code, error.message, error.details);
      throw error;
    }
    const date = new Date(`${normalizedDate}T12:00:00`);
    const type = str(body.type, 40);
    const allowed = ['period_start','period_day','period_end','spotting','no_bleeding'];
    if (Number.isNaN(date.valueOf()) || !allowed.includes(type)) throw new ApiError(400, 'CYCLE_OBSERVATION_INVALID', 'Проверьте дату и тип записи.');
    const meta = syncMeta(body);
    const existingObservation = await (prisma as any).cycleObservation.findUnique({ where: { userId_date_type: { userId: user.id, date, type } } });
    assertExpectedRevision(existingObservation, meta);
    await (prisma as any).cycleObservation.updateMany({
      where: { userId: user.id, date, type: { not: type }, deletedAt: null },
      data: { deletedAt: now(), updatedAt: now() },
    });
    const { _sync: _ignoredSync, ...observationData } = body;
    const record = await (prisma as any).cycleObservation.upsert({
      where: { userId_date_type: { userId: user.id, date, type } },
      update: { source: 'user', periodRecordId: optionalStr(body.periodRecordId, 80), data: { ...observationData, lastClientOperationId: meta?.operationId || null }, revision: { increment: 1 }, deletedAt: null, updatedAt: now() },
      create: { userId: user.id, date, type, source: 'user', periodRecordId: optionalStr(body.periodRecordId, 80), data: { ...observationData, lastClientOperationId: meta?.operationId || null }, revision: 1 },
    });
    return json(req, res, 200, cycleObservationFromDb(record));
  }
  const cycleObservationMatch = pathname.match(/^\/v1\/cycle\/observations\/([^/]+)$/);
  if (cycleObservationMatch && method === 'DELETE') {
    const body = await readJson(req).catch(() => ({}));
    const existing = await (prisma as any).cycleObservation.findFirst({ where: { id: cycleObservationMatch[1], userId: user.id, deletedAt: null } });
    if (!existing) return json(req, res, 200, { ok: true });
    const meta = syncMeta(body);
    assertExpectedRevision(existing, meta);
    await (prisma as any).cycleObservation.update({ where: { id: existing.id }, data: { deletedAt: now(), revision: { increment: 1 }, data: { ...(existing.data || {}), lastClientOperationId: meta?.operationId || null } } });
    return json(req, res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/v1/box/preferences') {
    const pref = await (prisma as any).boxPreference.findUnique({ where: { userId: user.id } });
    return json(req, res, 200, pref?.data || null);
  }
  if ((method === 'PUT' || method === 'POST') && pathname === '/v1/box/preferences') {
    const body = await readJson(req);
    const pref = await (prisma as any).boxPreference.upsert({ where: { userId: user.id }, update: { data: body }, create: { userId: user.id, data: body } });
    return json(req, res, 200, pref.data);
  }

  if (method === 'GET' && pathname === '/v1/subscription') {
    const subscription = await (prisma as any).subscription.findFirst({ where: { userId: user.id, cancelledAt: null }, orderBy: { createdAt: 'desc' } });
    return json(req, res, 200, subscription ? appSubscriptionDto(subscription) : null);
  }
  if (method === 'POST' && pathname === '/v1/subscription') {
    const body = await readJson(req);
    const orderId = str(body.orderId, 80);
    if (!orderId) throw new ApiError(400, 'PAID_ORDER_REQUIRED', 'Для активации подписки нужен оплаченный заказ.');
    const order = await (prisma as any).order.findFirst({
      where: { id: orderId, userId: user.id, deletedAt: null },
      include: { quote: true },
    });
    if (!order || order.paymentStatus !== 'PAID') throw new ApiError(409, 'PAID_ORDER_REQUIRED', 'Подписка активируется только после подтверждённой оплаты.');
    const plan = str(order.quote?.planId || body.plan || 'comfort', 40).toLowerCase();
    if (body.plan && str(body.plan, 40).toLowerCase() !== plan) throw new ApiError(409, 'SUBSCRIPTION_PLAN_MISMATCH', 'Тариф не совпадает с оплаченным предложением.');
    const deliveryAddressId = order.deliveryAddressId || optionalStr(body.deliveryAddressId, 80);
    if (!deliveryAddressId) throw new ApiError(409, 'DELIVERY_ADDRESS_REQUIRED', 'Для подписки нужен подтверждённый адрес доставки.');
    const existing = await (prisma as any).subscription.findFirst({ where: { userId: user.id, cancelledAt: null }, orderBy: { createdAt: 'desc' } });
    const data = {
      ...(existing?.data || {}),
      orderId: order.id,
      quoteId: order.quoteId,
      activatedFromPaidOrderAt: now().toISOString(),
      deliveryIncludedInPlan: true,
      deliveryFeeMinor: 0,
    };
    const payload = {
      plan,
      status: 'active',
      pauseUntil: null,
      skipNextBox: false,
      deliveryAddressId,
      deliveryWindow: optionalStr(body.deliveryWindow, 80),
      nextBillingDate: body.nextBillingDate ? new Date(body.nextBillingDate) : null,
      nextPreparationDate: body.nextPreparationDate ? new Date(body.nextPreparationDate) : null,
      nextDeliveryDate: body.nextDeliveryDate ? new Date(body.nextDeliveryDate) : null,
      cancelledAt: null,
      data,
    };
    const subscription = existing
      ? await (prisma as any).subscription.update({ where: { id: existing.id }, data: payload })
      : await (prisma as any).subscription.create({ data: { userId: user.id, ...payload } });
    await (prisma as any).auditLog.create({ data: { actorId: user.id, actorRole: 'USER', action: 'SUBSCRIPTION_ACTIVATED_FROM_PAID_ORDER', entityType: 'Subscription', entityId: subscription.id, metadata: { orderId: order.id, quoteId: order.quoteId, plan } } }).catch(() => null);
    return json(req, res, 200, appSubscriptionDto(subscription));
  }
  if (method === 'POST' && pathname === '/v1/subscription/actions') {
    const body = await readJson(req);
    const action = str(body.action, 40);
    const subscription = await (prisma as any).subscription.findFirst({ where: { userId: user.id, cancelledAt: null }, orderBy: { createdAt: 'desc' } });
    if (!subscription) throw new ApiError(404, 'SUBSCRIPTION_NOT_FOUND', 'Подписка не найдена.');
    const currentStatus = String(subscription.status || '').toLowerCase();
    if (currentStatus === 'cancelled' || currentStatus === 'expired') throw new ApiError(409, 'SUBSCRIPTION_NOT_ACTIVE', 'Эту подписку уже нельзя изменить.');
    const baseData = subscription.data && typeof subscription.data === 'object' ? subscription.data : {};
    let update: any;
    if (action === 'pause_until') {
      const pauseUntil = new Date(String(body.pauseUntil || ''));
      const max = future(366 * 24 * 60 * 60_000);
      if (Number.isNaN(pauseUntil.valueOf()) || pauseUntil <= now() || pauseUntil > max) throw new ApiError(400, 'SUBSCRIPTION_PAUSE_DATE_INVALID', 'Выберите будущую дату паузы не более чем на год.');
      update = { status: 'paused', pauseUntil, skipNextBox: false, data: { ...baseData, pauseMode: 'until', pauseUntil: pauseUntil.toISOString() } };
    } else if (action === 'pause_indefinite') {
      update = { status: 'paused', pauseUntil: null, skipNextBox: false, data: { ...baseData, pauseMode: 'indefinite', pauseUntil: null } };
    } else if (action === 'skip_next') {
      if (currentStatus !== 'active') throw new ApiError(409, 'SUBSCRIPTION_MUST_BE_ACTIVE', 'Сначала возобновите подписку.');
      update = { skipNextBox: true, data: { ...baseData, skipNextRequestedAt: now().toISOString() } };
    } else if (action === 'resume') {
      update = { status: 'active', pauseUntil: null, skipNextBox: false, data: { ...baseData, pauseMode: null, pauseUntil: null, resumedAt: now().toISOString() } };
    } else if (action === 'cancel') {
      const reason = optionalStr(body.reason, 500) || 'customer_request';
      update = { status: 'cancelled', cancelledAt: now(), pauseUntil: null, skipNextBox: false, data: { ...baseData, cancellationReason: reason, cancelledAt: now().toISOString() } };
    } else {
      throw new ApiError(400, 'SUBSCRIPTION_ACTION_INVALID', 'Неизвестное действие с подпиской.');
    }
    const updated = await (prisma as any).subscription.update({ where: { id: subscription.id }, data: update });
    await (prisma as any).auditLog.create({ data: { actorId: user.id, actorRole: 'USER', action: `SUBSCRIPTION_${action.toUpperCase()}`, entityType: 'Subscription', entityId: updated.id, metadata: { action } } }).catch(() => null);
    return json(req, res, 200, action === 'cancel' ? null : appSubscriptionDto(updated));
  }

  if (method === 'GET' && pathname === '/v1/delivery-addresses') {
    const items = await (prisma as any).deliveryAddress.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
    return json(req, res, 200, { items });
  }
  if (method === 'POST' && pathname === '/v1/delivery-addresses') {
    const body = await readJson(req);
    const validated = validateAddress(body);
    const zone = await checkDeliveryZone(validated.latitude, validated.longitude);
    if (bool(body.isDefault)) await (prisma as any).deliveryAddress.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
    const record = await (prisma as any).deliveryAddress.create({ data: {
      userId: user.id,
      label: str(body.label || 'home', 40),
      addressType: validated.addressType,
      handoffType: validated.handoffType,
      country: str(body.country || 'Armenia', 80),
      region: str(body.region || 'Shirak', 80),
      city: str(body.city || 'Gyumri', 80),
      district: optionalStr(body.district, 120),
      street: str(body.street || '', 120),
      house: str(body.house || '', 80),
      entrance: optionalStr(body.entrance, 40),
      floor: optionalStr(body.floor, 40),
      apartment: optionalStr(body.apartment, 40),
      postalCode: optionalStr(body.postalCode, 40),
      intercomCode: optionalStr(body.intercomCode, 60),
      instructions: optionalStr(body.instructions, 300),
      companyName: optionalStr(body.companyName, 120),
      contactPerson: optionalStr(body.contactPerson, 120),
      officeNumber: optionalStr(body.officeNumber, 80),
      hotelName: optionalStr(body.hotelName, 120),
      roomNumber: optionalStr(body.roomNumber, 80),
      landmark: optionalStr(body.landmark, 160),
      gateDetails: optionalStr(body.gateDetails, 160),
      leaveAtDoorLocation: optionalStr(body.leaveAtDoorLocation, 200),
      callOnArrival: bool(body.callOnArrival),
      doNotKnock: bool(body.doNotKnock),
      photoConfirmation: bool(body.photoConfirmation),
      recipientName: str(body.recipientName, 120),
      phone: str(body.phone, 40),
      latitude: validated.latitude,
      longitude: validated.longitude,
      formattedAddress: validated.formattedAddress,
      provider: str(body.provider || 'google', 40),
      providerPlaceId: optionalStr(body.providerPlaceId, 120),
      deliveryZoneId: zone.zoneId,
      deliveryFeeMinor: 0,
      estimatedMinutes: zone.etaMin,
      validationStatus: zone.available ? 'verified' : 'outside_zone',
      deliveryIncludedInPlan: true,
      planCode: optionalStr(body.planCode, 80),
      zoneVerifiedAt: zone.available ? now() : null,
      syncStatus: 'synced',
      isDefault: bool(body.isDefault),
    } });
    return json(req, res, 200, record);
  }
  const addressMatch = pathname.match(/^\/v1\/delivery-addresses\/([^/]+)(?:\/(set-default))?$/);
  if (addressMatch && method === 'PATCH') {
    const body = await readJson(req);
    const existingAddress = await (prisma as any).deliveryAddress.findFirst({ where: { id: addressMatch[1], userId: user.id } });
    if (!existingAddress) throw new ApiError(404, 'ADDRESS_NOT_FOUND', 'Адрес не найден.');
    const merged = { ...existingAddress, ...body };
    const validated = validateAddress(merged);
    const zone = await checkDeliveryZone(validated.latitude, validated.longitude, optionalStr(body.planCode, 80) || existingAddress.planCode);
    if (bool(merged.isDefault)) {
      await (prisma as any).deliveryAddress.updateMany({ where: { userId: user.id, isDefault: true, id: { not: existingAddress.id } }, data: { isDefault: false } });
    }
    const record = await (prisma as any).deliveryAddress.update({
      where: { id: existingAddress.id },
      data: {
        label: str(merged.label || 'home', 40),
        addressType: validated.addressType,
        handoffType: validated.handoffType,
        country: str(merged.country || 'Armenia', 80),
        region: str(merged.region || 'Shirak', 80),
        city: str(merged.city || 'Gyumri', 80),
        district: optionalStr(merged.district, 120),
        street: str(merged.street || '', 120),
        house: str(merged.house || '', 80),
        entrance: optionalStr(merged.entrance, 40),
        floor: optionalStr(merged.floor, 40),
        apartment: optionalStr(merged.apartment, 40),
        postalCode: optionalStr(merged.postalCode, 40),
        intercomCode: optionalStr(merged.intercomCode, 60),
        instructions: optionalStr(merged.instructions, 300),
        companyName: optionalStr(merged.companyName, 120),
        contactPerson: optionalStr(merged.contactPerson, 120),
        officeNumber: optionalStr(merged.officeNumber, 80),
        hotelName: optionalStr(merged.hotelName, 120),
        roomNumber: optionalStr(merged.roomNumber, 80),
        landmark: optionalStr(merged.landmark, 160),
        gateDetails: optionalStr(merged.gateDetails, 160),
        leaveAtDoorLocation: optionalStr(merged.leaveAtDoorLocation, 200),
        callOnArrival: bool(merged.callOnArrival),
        doNotKnock: bool(merged.doNotKnock),
        photoConfirmation: bool(merged.photoConfirmation),
        recipientName: str(merged.recipientName, 120),
        phone: str(merged.phone, 40),
        latitude: validated.latitude,
        longitude: validated.longitude,
        formattedAddress: validated.formattedAddress,
        provider: str(merged.provider || 'device', 40),
        providerPlaceId: optionalStr(merged.providerPlaceId, 120),
        deliveryZoneId: zone.zoneId,
        deliveryFeeMinor: 0,
        estimatedMinutes: zone.etaMin,
        validationStatus: zone.available ? 'verified' : 'outside_zone',
        deliveryIncludedInPlan: true,
        planCode: optionalStr(merged.planCode, 80),
        zoneVerifiedAt: zone.available ? now() : null,
        syncStatus: 'synced',
        isDefault: bool(merged.isDefault),
        updatedAt: now(),
      },
    });
    return json(req, res, 200, record);
  }
  if (addressMatch && method === 'DELETE') {
    await (prisma as any).deliveryAddress.deleteMany({ where: { id: addressMatch[1], userId: user.id } });
    return json(req, res, 200, { ok: true });
  }
  if (addressMatch && addressMatch[2] === 'set-default' && method === 'POST') {
    await (prisma as any).deliveryAddress.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
    await (prisma as any).deliveryAddress.updateMany({ where: { userId: user.id, id: addressMatch[1] }, data: { isDefault: true } });
    return json(req, res, 200, { ok: true });
  }

  if (method === 'POST' && pathname === '/v1/delivery/check-zone') {
    const body = await readJson(req);
    const subscription = await (prisma as any).subscription.findFirst({ where: { userId: user.id, cancelledAt: null }, orderBy: { createdAt: 'desc' } }).catch(() => null);
    return json(req, res, 200, await checkDeliveryZone(Number(body.latitude), Number(body.longitude), subscription?.plan || optionalStr(body.planCode, 80)));
  }
  if (method === 'POST' && pathname === '/v1/delivery/zones/check') {
    const body = await readJson(req);
    return json(req, res, 200, await checkDeliveryZone(Number(body.lat || body.latitude), Number(body.lng || body.longitude), optionalStr(body.planCode, 80)));
  }

  if (method === 'POST' && pathname === '/v1/orders/quote') {
    const body = await readJson(req);
    return json(req, res, 200, await calculateServerQuote(user.id, body));
  }
  if (method === 'GET' && pathname === '/v1/orders') {
    const orders = await (prisma as any).order.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, include: { items: { include: { product: true } }, quote: true } });
    return json(req, res, 200, { items: orders.map(orderFromDb) });
  }
  if (method === 'POST' && pathname === '/v1/orders') {
    const body = await readJson(req);
    const quoteId = str(body.quoteId, 80);
    if (!quoteId) throw new ApiError(400, 'QUOTE_REQUIRED', 'Сначала получите серверную цену.');
    const idempotencyKey = str(req.headers['idempotency-key'] || body.idempotencyKey, 120);
    if (!idempotencyKey) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Для создания заказа нужен idempotency key.');
    const existingOrder = await (prisma as any).order.findFirst({ where: { quoteId, userId: user.id }, include: { items: { include: { product: true } }, quote: true } });
    if (existingOrder) return json(req, res, 200, orderFromDb(existingOrder));
    const quote = await (prisma as any).orderQuote.findFirst({ where: { id: quoteId, userId: user.id }, include: { items: true, deliveryAddress: true } });
    if (!quote) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Цена не найдена.');
    if (quote.expiresAt <= now()) throw new ApiError(409, 'QUOTE_EXPIRED', 'Цена истекла. Обновите расчёт.');
    if (quote.usedAt) throw new ApiError(409, 'QUOTE_ALREADY_USED', 'Эта цена уже использована.');
    const validationErrors = Array.isArray(quote.validationErrors) ? quote.validationErrors : [];
    if (validationErrors.length) throw new ApiError(409, 'QUOTE_INVALID', 'Нельзя оформить заказ с ошибками в расчёте.', { validationErrors });
    const handoff = body.handoff || body.handoffSnapshot || {};
    if ((handoff.type || quote.deliveryAddress?.handoffType) === 'leave_at_door' && !handoff.exactPlace && !quote.deliveryAddress?.leaveAtDoorLocation) {
      throw new ApiError(400, 'HANDOFF_INVALID', 'Для доставки у двери укажите точное место.');
    }
    const order = await (prisma as any).$transaction(async (tx: any) => {
      const created = await tx.order.create({ data: {
        userId: user.id,
        quoteId: quote.id,
        deliveryAddressId: quote.deliveryAddressId,
        deliveryZoneId: quote.deliveryZoneId,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        totalMinor: quote.totalMinor,
        currency: quote.currency,
        recipientSnapshot: { recipientName: body.recipient?.name || quote.deliveryAddress?.recipientName, phone: quote.deliveryAddress?.phone },
        handoffSnapshot: handoff,
        deliverySnapshot: quote.deliveryAddress ? safeDeliveryAddressSnapshot(quote.deliveryAddress) : null,
        items: { create: quote.items.map((item: any) => ({ productId: item.productId, quantity: item.quantity, includedQuantity: item.includedQuantity, addOnQuantity: item.addOnQuantity, unitPriceMinor: item.unitPriceMinor, totalMinor: item.totalMinor })) },
      } });
      for (const item of quote.items) {
        const inventory = await tx.inventoryItem.findUnique({ where: { productId_warehouseId: { productId: item.productId, warehouseId: 'gyumri-main' } } });
        if (!inventory || inventory.availableQuantity - inventory.reservedQuantity < item.quantity) {
          throw new ApiError(409, 'OUT_OF_STOCK', 'Состав изменился: одного из товаров уже недостаточно. Обновите расчёт.');
        }
        const reserved = await tx.inventoryItem.updateMany({
          where: { id: inventory.id, reservedQuantity: inventory.reservedQuantity },
          data: { reservedQuantity: { increment: item.quantity } },
        });
        if (reserved.count !== 1) throw new ApiError(409, 'INVENTORY_CONFLICT', 'Склад изменился во время оформления. Повторите расчёт.');
      }
      await tx.orderQuote.update({ where: { id: quote.id, usedAt: null }, data: { usedAt: now() } });
      await tx.deliveryTask.create({ data: { orderId: created.id, status: 'CREATED', safePayload: { orderCode: created.id.slice(0, 8), formattedAddress: quote.deliveryAddress?.formattedAddress, recipientName: quote.deliveryAddress?.recipientName, phone: quote.deliveryAddress?.phone, handoff } } });
      return tx.order.findUnique({ where: { id: created.id }, include: { items: { include: { product: true } }, quote: true } });
    }, { isolationLevel: 'Serializable' });
    return json(req, res, 200, orderFromDb(order));
  }

  if (method === 'GET' && pathname === '/v1/payments/methods') {
    if (env.paymentProvider !== 'sandbox') {
      throw new ApiError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Платёжный провайдер ещё не подключён. Оформление остановлено.');
    }
    return json(req, res, 200, { items: [{ id: 'sandbox-card-4242', type: 'sandbox_card', brand: 'LOUSA Test Card', last4: '4242', expiresMonth: 12, expiresYear: 2030, demo: true }] });
  }

  if (method === 'POST' && pathname === '/v1/payments/intents') {
    if (env.paymentProvider !== 'sandbox') throw new ApiError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Реальный платёжный провайдер ещё не подключён.');
    const body = await readJson(req);
    const orderId = str(body.orderId, 80);
    const idempotencyKey = str(req.headers['idempotency-key'] || body.idempotencyKey || randomUUID(), 120);
    const order = await (prisma as any).order.findFirst({ where: { id: orderId, userId: user.id } });
    if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Заказ не найден.');
    if (order.status !== 'PENDING_PAYMENT') throw new ApiError(409, 'ORDER_NOT_PAYABLE', 'Заказ сейчас нельзя оплатить.');
    let intent = await (prisma as any).paymentIntent.findUnique({ where: { idempotencyKey } });
    if (!intent) {
      const providerIntentId = `sandbox_${randomUUID()}`;
      intent = await (prisma as any).paymentIntent.create({ data: { orderId: order.id, provider: env.paymentProvider, providerIntentId, idempotencyKey, status: 'requires_confirmation', amountMinor: order.totalMinor, currency: order.currency, clientSecret: env.paymentProvider === 'sandbox' ? `sandbox_secret_${providerIntentId}` : null, data: { sandbox: env.paymentProvider === 'sandbox' } } });
    }
    return json(req, res, 200, { id: intent.id, providerIntentId: intent.providerIntentId, status: intent.status, amountMinor: intent.amountMinor, currency: intent.currency, clientSecret: intent.clientSecret, demo: env.paymentProvider === 'sandbox' });
  }
  const paymentConfirm = pathname.match(/^\/v1\/payments\/intents\/([^/]+)\/confirm$/);
  if (paymentConfirm && method === 'POST') {
    if (env.paymentProvider !== 'sandbox') throw new ApiError(503, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'Реальное подтверждение платежа ещё не подключено.');
    const intent = await (prisma as any).paymentIntent.findFirst({ where: { id: paymentConfirm[1] }, include: { order: true } });
    if (!intent || intent.order.userId !== user.id) throw new ApiError(404, 'PAYMENT_INTENT_NOT_FOUND', 'Платёж не найден.');
    await (prisma as any).paymentIntent.update({ where: { id: intent.id }, data: { status: 'succeeded' } });
    await (prisma as any).order.update({ where: { id: intent.orderId }, data: { status: 'PAID', paymentStatus: 'PAID' } });
    await (prisma as any).paymentEvent.create({ data: { orderId: intent.orderId, paymentIntentId: intent.id, provider: intent.provider, providerEventId: `sandbox_event_${randomUUID()}`, type: 'payment_intent.succeeded', data: { sandbox: true } } });
    return json(req, res, 200, { id: intent.id, providerIntentId: intent.providerIntentId, status: 'succeeded', amountMinor: intent.amountMinor, currency: intent.currency, demo: true });
  }
  const paymentRefund = pathname.match(/^\/v1\/payments\/intents\/([^/]+)\/refund$/);
  if (paymentRefund && method === 'POST') {
    const intent = await (prisma as any).paymentIntent.findFirst({ where: { id: paymentRefund[1] }, include: { order: true } });
    if (!intent || intent.order.userId !== user.id) throw new ApiError(404, 'PAYMENT_INTENT_NOT_FOUND', 'Платёж не найден.');
    await (prisma as any).paymentIntent.update({ where: { id: intent.id }, data: { status: 'refunded' } });
    await (prisma as any).order.update({ where: { id: intent.orderId }, data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' } });
    return json(req, res, 200, { id: `refund_${randomUUID()}`, intentId: intent.id, amountMinor: intent.amountMinor, status: 'succeeded', reason: 'sandbox' });
  }

  if (method === 'GET' && pathname === '/v1/account/export') {
    const [periods, entries, addresses, orders, consents] = await Promise.all([
      (prisma as any).period.findMany({ where: { userId: user.id, deletedAt: null } }),
      (prisma as any).dailyEntry.findMany({ where: { userId: user.id, deletedAt: null } }).catch(() => []),
      (prisma as any).deliveryAddress.findMany({ where: { userId: user.id } }),
      (prisma as any).order.findMany({ where: { userId: user.id }, include: { items: { include: { product: true } } } }),
      (prisma as any).consentRecord.findMany({ where: { userId: user.id } }).catch(() => []),
    ]);
    return json(req, res, 200, { exportedAt: now().toISOString(), user: userPayload(user), periods: periods.map(periodFromDb), dailyEntries: entries, deliveryAddresses: addresses, orders: orders.map(orderFromDb), consents });
  }

  if (method === 'POST' && pathname === '/v1/account/deletion-request') {
    const request = await (prisma as any).accountDeletionRequest.create({ data: { userId: user.id, status: 'PENDING', metadata: { source: 'app' } } });
    return json(req, res, 200, { id: request.id, status: request.status, requestedAt: request.requestedAt.toISOString() });
  }
  if (method === 'POST' && pathname === '/v1/account/deletion-request/cancel') {
    await (prisma as any).accountDeletionRequest.updateMany({ where: { userId: user.id, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: now() } });
    return json(req, res, 200, { ok: true });
  }
  if (method === 'DELETE' && pathname === '/v1/account') {
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.session.updateMany({ where: { userId: user.id }, data: { revokedAt: now() } });
      await tx.period.updateMany({ where: { userId: user.id }, data: { deletedAt: now() } });
      await tx.diaryLog.updateMany({ where: { userId: user.id }, data: { deletedAt: now() } }).catch(() => null);
      await tx.dailyEntry.updateMany({ where: { userId: user.id }, data: { deletedAt: now() } }).catch(() => null);
      await tx.wellnessLog.updateMany({ where: { userId: user.id }, data: { deletedAt: now() } }).catch(() => null);
      await tx.deliveryAddress.deleteMany({ where: { userId: user.id } });
      await tx.accountDeletionRequest.updateMany({ where: { userId: user.id, status: 'PENDING' }, data: { status: 'COMPLETED', confirmedAt: now(), completedAt: now() } });
      await tx.user.update({ where: { id: user.id }, data: { status: 'deleted', deletedAt: now(), email: `deleted-${user.id}@deleted.lousa.local`, name: 'Deleted user', passwordHash: null } });
      await tx.auditLog.create({ data: { actorId: user.id, actorRole: 'USER', action: 'ACCOUNT_DELETED', entityType: 'User', entityId: user.id, metadata: { source: 'app' } } });
    });
    return json(req, res, 200, { ok: true });
  }

  throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
}

const server = createServer((req, res) => {
  router(req as AuthedRequest, res).catch((error) => errorResponse(req, res, error));
});

server.listen(env.port, env.apiHost, async () => {
  if (env.appEnv !== 'production') {
    try {
      await ensureDemoUser();
      await ensureCatalog();
    } catch (error) {
      console.warn('[LOUSA API] Startup seed skipped:', error instanceof Error ? error.message : error);
    }
  }
  console.log(`[LOUSA API] V9 listening on http://${env.apiHost}:${env.port} (${env.appEnv})`);
});
