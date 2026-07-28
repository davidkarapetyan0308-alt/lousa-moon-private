import type {
  AppNotificationItem,
  AdminV22SyncHealth,
  BoxFeedback,
  BoxOrder,
  BoxPreferences,
  CyclePrediction,
  CycleDayObservation,
  PeriodRecord,
  SubscriptionModel,
  SupportTicket,
  CourierContact,
  OrderTimelineSnapshot,
} from '../../domain/models';
import type {
  AuthService,
  BoxPreferenceService,
  CycleService,
  OrderService,
  PaymentService,
  PredictionService,
  NotificationService,
  SupportService,
  AdminV22SyncService,
  ServiceError,
  ServiceResult,
  SubscriptionService,
  CheckoutService,
  AccountService,
  CycleSettingsService,
} from '../contracts';
import type { PaymentIntent, PaymentMethod, Refund } from '../payment';
import { getUserFacingErrorMessage } from '../errorMessages';
import { assertApiEnvironmentReady } from '../apiEnvironment';
import { AUTH_TOKEN_KEYS, secureStorage } from '../security/secureStorage';
import { getStoredAuthSessionState, setStoredAuthSessionState } from '../../features/auth/session/sessionState';


interface ApiErrorEnvelope {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(error: ServiceError): ServiceResult<T> => ({ ok: false, error });

function friendlyApiMessage(code: string, fallback: string) {
  return getUserFacingErrorMessage({ code, message: fallback }, fallback);
}

const PUBLIC_AUTH_PATHS = ['/v1/auth/register', '/v1/auth/verify-email', '/v1/auth/login', '/v1/auth/google', '/v1/auth/phone/start', '/v1/auth/phone/verify', '/v1/auth/password/forgot', '/v1/auth/password/reset', '/v1/auth/firebase/session', '/v1/auth/refresh'];

function isPublicAuthPath(path: string) {
  return PUBLIC_AUTH_PATHS.some((entry) => path === entry);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ServiceResult<T>> {
  try {
    const sessionState = await getStoredAuthSessionState();
    if (sessionState === 'guest' && !isPublicAuthPath(path)) {
      return fail({
        code: 'GUEST_ACCOUNT_REQUIRED',
        message: 'Для синхронизации, адреса, оплаты и LOUSA BOX нужен аккаунт. Локальные данные гостя остаются на устройстве.',
        recoverable: false,
      });
    }
    if ((sessionState === 'local_limited_mode' || sessionState === 'backend_session_pending') && !isPublicAuthPath(path)) {
      return fail({
        code: 'BACKEND_SESSION_PENDING',
        message: 'Вход подтверждён, но серверная сессия ещё не создана. Повторите подключение к сервису.',
        recoverable: true,
      });
    }
    const apiUrl = assertApiEnvironmentReady();
    const token = await secureStorage.get('accessToken');
    const headers = new Headers(init.headers || {});
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const envelope = (payload || {}) as ApiErrorEnvelope;
      const code = envelope.error?.code || `HTTP_${response.status}`;
      const rawMessage = envelope.error?.message || 'LOUSA API request failed.';
      return fail({
        code,
        message: friendlyApiMessage(code, rawMessage),
        recoverable: response.status >= 500 || response.status === 408 || response.status === 429,
        details: envelope.error?.details,
      });
    }
    return ok(payload as T);
  } catch (error) {
    const errorCode = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
    const code = errorCode || 'NETWORK_ERROR';
    return fail({
      code,
      message: friendlyApiMessage(code, error instanceof Error ? error.message : 'Request failed.'),
      recoverable: code === 'NETWORK_ERROR',
    });
  }
}

export const apiAuthService: AuthService = {
  async register(input) {
    return request<{ expiresAt: string; resendAfterSeconds?: number; emailDelivery?: { provider: string; configured: boolean; devMode?: boolean }; devCode?: string }>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async verifyRegistration(email, code) {
    const result = await request<{ user: { id: string }; accessToken: string; refreshToken: string; demo?: boolean }>('/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    if (!result.ok) return result;
    await secureStorage.set('accessToken', result.data.accessToken);
    await secureStorage.set('refreshToken', result.data.refreshToken);
    await secureStorage.set('sessionId', result.data.user.id);
    await setStoredAuthSessionState('authenticated');
    return ok({
      userId: result.data.user.id,
      sessionId: result.data.user.id,
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      demo: Boolean(result.data.demo),
      sessionState: 'authenticated',
      backendSessionReady: true,
    });
  },
  async signIn(email, password) {
    const result = await request<{ user: { id: string; email?: string; phone?: string; name?: string; avatarUri?: string | null }; accessToken: string; refreshToken: string; demo?: boolean }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!result.ok) return result;
    await secureStorage.set('accessToken', result.data.accessToken);
    await secureStorage.set('refreshToken', result.data.refreshToken);
    await secureStorage.set('sessionId', result.data.user.id);
    await setStoredAuthSessionState('authenticated');
    return ok({
      userId: result.data.user.id,
      sessionId: result.data.user.id,
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      demo: Boolean(result.data.demo),
      email: result.data.user.email,
      phone: result.data.user.phone,
      name: result.data.user.name,
      avatarUri: result.data.user.avatarUri ?? null,
      sessionState: 'authenticated',
      backendSessionReady: true,
    });
  },
  async signInWithGoogle(idToken) {
    const result = await request<{
      user: { id: string; email: string; name: string; avatarUri?: string | null };
      accessToken: string;
      refreshToken: string;
      demo?: boolean;
      isNewUser?: boolean;
    }>('/v1/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    if (!result.ok) return result;
    await secureStorage.set('accessToken', result.data.accessToken);
    await secureStorage.set('refreshToken', result.data.refreshToken);
    await secureStorage.set('sessionId', result.data.user.id);
    await setStoredAuthSessionState('authenticated');
    return ok({
      userId: result.data.user.id,
      sessionId: result.data.user.id,
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      demo: Boolean(result.data.demo),
      email: result.data.user.email,
      name: result.data.user.name,
      avatarUri: result.data.user.avatarUri ?? null,
      isNewUser: Boolean(result.data.isNewUser),
    });
  },
  async startPhoneAuth(input) {
    return request<{ expiresAt: string; resendAfterSeconds?: number; smsDelivery?: { provider: string; configured: boolean; devMode?: boolean }; devCode?: string }>('/v1/auth/phone/start', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async verifyPhoneAuth(input) {
    const result = await request<{
      user: { id: string; email?: string; phone?: string; name?: string; avatarUri?: string | null };
      accessToken: string;
      refreshToken: string;
      demo?: boolean;
      isNewUser?: boolean;
    }>('/v1/auth/phone/verify', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!result.ok) return result;
    await secureStorage.set('accessToken', result.data.accessToken);
    await secureStorage.set('refreshToken', result.data.refreshToken);
    await secureStorage.set('sessionId', result.data.user.id);
    await setStoredAuthSessionState('authenticated');
    return ok({
      userId: result.data.user.id,
      sessionId: result.data.user.id,
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      demo: Boolean(result.data.demo),
      email: result.data.user.email,
      phone: result.data.user.phone,
      name: result.data.user.name,
      avatarUri: result.data.user.avatarUri ?? null,
      isNewUser: Boolean(result.data.isNewUser),
    });
  },
  async signOut() {
    const result = await request<{ ok: boolean }>('/v1/auth/logout', { method: 'POST' });
    await secureStorage.clear([...AUTH_TOKEN_KEYS]);
    return result.ok ? ok(undefined) : result;
  },
  async signOutAll() {
    const result = await request<{ ok: boolean }>('/v1/auth/logout-all', { method: 'POST' });
    await secureStorage.clear([...AUTH_TOKEN_KEYS]);
    return result.ok ? ok(undefined) : result;
  },
  async refreshSession() {
    const refreshToken = await secureStorage.get('refreshToken');
    if (!refreshToken) {
      return fail({ code: 'NO_REFRESH_TOKEN', message: 'No refresh token is available.', recoverable: false });
    }
    const result = await request<{ user: { id: string }; accessToken: string; refreshToken: string; demo?: boolean }>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    if (!result.ok) return result;
    await secureStorage.set('accessToken', result.data.accessToken);
    await secureStorage.set('refreshToken', result.data.refreshToken);
    await secureStorage.set('sessionId', result.data.user.id);
    await setStoredAuthSessionState('authenticated');
    return ok({
      userId: result.data.user.id,
      sessionId: result.data.user.id,
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
      demo: Boolean(result.data.demo),
      sessionState: 'authenticated',
      backendSessionReady: true,
    });
  },
  async requestPasswordReset(email, language) {
    const result = await request<{ ok: boolean; emailDelivery?: { provider: string; configured: boolean; devMode?: boolean }; devCode?: string }>('/v1/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email, language }),
    });
    return result.ok ? ok({ emailDelivery: result.data.emailDelivery, devCode: result.data.devCode }) : result;
  },
  async resetPassword(input) {
    const result = await request<{ ok: boolean }>('/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return result.ok ? ok(undefined) : result;
  },
};

export const apiCycleService: CycleService = {
  async listPeriods() {
    const result = await request<{ items: PeriodRecord[] }>('/v1/periods');
    return result.ok ? ok(result.data.items) : result;
  },
  async savePeriod(record) {
    return request<PeriodRecord>('/v1/periods', { method: 'POST', body: JSON.stringify(record) });
  },
  async deletePeriod(id) {
    const result = await request<{ ok: boolean }>(`/v1/periods/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return result.ok ? ok(undefined) : result;
  },
  updatePeriod(id, patch) {
    return request<PeriodRecord>(`/v1/periods/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
  async listObservations() {
    const result = await request<{ items: CycleDayObservation[] }>('/v1/cycle/observations');
    return result.ok ? ok(result.data.items) : result;
  },
  saveObservation(observation) {
    return request<CycleDayObservation>('/v1/cycle/observations', { method: 'POST', body: JSON.stringify(observation) });
  },
  async deleteObservation(id) {
    const result = await request<{ ok: boolean }>(`/v1/cycle/observations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return result.ok ? ok(undefined) : result;
  },
};


export type CycleSyncRequestMeta = {
  operationId: string;
  localRevision: number;
  expectedServerRevision: number | null;
};

export const apiCycleSyncTransport = {
  savePeriod(record: PeriodRecord, meta: CycleSyncRequestMeta) {
    return request<PeriodRecord>('/v1/periods', { method: 'POST', body: JSON.stringify({ ...record, _sync: meta }) });
  },
  async deletePeriod(id: string, meta: CycleSyncRequestMeta) {
    const result = await request<{ ok: boolean }>(`/v1/periods/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ _sync: meta }) });
    return result.ok ? ok(undefined) : result;
  },
  saveObservation(observation: CycleDayObservation, meta: CycleSyncRequestMeta) {
    return request<CycleDayObservation>('/v1/cycle/observations', { method: 'POST', body: JSON.stringify({ ...observation, _sync: meta }) });
  },
  async deleteObservation(id: string, meta: CycleSyncRequestMeta) {
    const result = await request<{ ok: boolean }>(`/v1/cycle/observations/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ _sync: meta }) });
    return result.ok ? ok(undefined) : result;
  },
};


export const apiCycleSettingsService: CycleSettingsService = {
  getSettings() {
    return request('/v1/cycle/settings');
  },
  saveSettings(settings) {
    return request('/v1/cycle/settings', { method: 'PUT', body: JSON.stringify(settings) });
  },
};

export const apiPredictionService: PredictionService = {
  getPrediction() {
    return request<CyclePrediction>('/v1/prediction');
  },
};

export const apiBoxPreferenceService: BoxPreferenceService = {
  getPreferences() {
    return request<BoxPreferences>('/v1/box/preferences');
  },
  savePreferences(preferences) {
    return request<BoxPreferences>('/v1/box/preferences', { method: 'PUT', body: JSON.stringify(preferences) });
  },
};

export const apiSubscriptionService: SubscriptionService = {
  getSubscription() {
    return request<SubscriptionModel | null>('/v1/subscription');
  },
  saveSubscription(subscription) {
    return request<SubscriptionModel>('/v1/subscription', { method: 'POST', body: JSON.stringify(subscription) });
  },
  updateSubscription(input) {
    return request<SubscriptionModel | null>('/v1/subscription/actions', { method: 'POST', body: JSON.stringify(input) });
  },
};

export const apiOrderService: OrderService = {
  async listOrders() {
    const result = await request<{ items: BoxOrder[] }>('/v1/orders');
    return result.ok ? ok(result.data.items) : result;
  },
  async listActiveOrders() {
    const result = await request<{ items: BoxOrder[] }>('/v1/app/orders/active');
    return result.ok ? ok(result.data.items) : result;
  },
  getOrderDetail(orderId) {
    return request<BoxOrder>(`/v1/app/orders/${encodeURIComponent(orderId)}`);
  },
  getOrderTimeline(orderId) {
    return request<OrderTimelineSnapshot>(`/v1/app/orders/${encodeURIComponent(orderId)}/timeline`);
  },
  saveOrder(order) {
    return request<BoxOrder>('/v1/orders', { method: 'POST', body: JSON.stringify(order) });
  },
  saveFeedback(feedback: BoxFeedback) {
    return request<BoxFeedback>(`/v1/orders/${encodeURIComponent(feedback.orderId)}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  },
};

export const apiAccountService: AccountService = {
  requestDeletion() {
    return request('/v1/account/deletion-request', { method: 'POST' });
  },
  async cancelDeletion() {
    const result = await request<{ ok: boolean }>('/v1/account/deletion-request/cancel', { method: 'POST' });
    return result.ok ? ok(undefined) : result;
  },
  async deleteAccount() {
    const result = await request<{ ok: boolean }>('/v1/account', { method: 'DELETE' });
    if (result.ok) await secureStorage.clear([...AUTH_TOKEN_KEYS]);
    return result.ok ? ok(undefined) : result;
  },
};

export const apiCheckoutService: CheckoutService = {
  createQuote(input) {
    return request('/v1/orders/quote', { method: 'POST', body: JSON.stringify(input) });
  },
  createOrder(input) {
    return request('/v1/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(input),
    });
  },
};

export const apiPaymentService: PaymentService = {
  async listPaymentMethods() {
    const result = await request<{ items: PaymentMethod[] }>('/v1/payments/methods');
    return result.ok ? ok(result.data.items) : result;
  },
  createPayment(input) {
    return request<PaymentIntent>('/v1/payments/intents', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(input),
    });
  },
  confirmPayment(intentId, paymentMethodId) {
    return request<PaymentIntent>(`/v1/payments/intents/${encodeURIComponent(intentId)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId }),
    });
  },
  refundPayment(input) {
    return request<Refund>(`/v1/payments/intents/${encodeURIComponent(input.intentId)}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amountMinor: input.amountMinor, reason: input.reason }),
    });
  },
};


export const apiSupportService: SupportService = {
  async listTickets() {
    const result = await request<{ items: SupportTicket[] }>('/v1/support/tickets');
    return result.ok ? ok(result.data.items) : result;
  },
  getTicket(ticketId: string) {
    return request<SupportTicket>(`/v1/support/tickets/${encodeURIComponent(ticketId)}`);
  },
  createTicket(input: { subject: string; message: string; category?: string; orderId?: string | null }) {
    return request<SupportTicket>('/v1/support/tickets', { method: 'POST', body: JSON.stringify(input) });
  },
  sendMessage(ticketId: string, message: string) {
    return request<SupportTicket>(`/v1/support/tickets/${encodeURIComponent(ticketId)}/messages`, { method: 'POST', body: JSON.stringify({ message }) });
  },
  closeTicket(ticketId: string) {
    return request<SupportTicket>(`/v1/support/tickets/${encodeURIComponent(ticketId)}/close`, { method: 'POST' });
  },
  getCourierContact(orderId: string) {
    return request<CourierContact>(`/v1/app/orders/${encodeURIComponent(orderId)}/courier-contact`);
  },
  sendCourierMessage(orderId: string, message: string) {
    return request<{ ok: boolean; ticketId: string; message: string }>(`/v1/app/orders/${encodeURIComponent(orderId)}/courier-message`, { method: 'POST', body: JSON.stringify({ message }) });
  },
};


export const apiNotificationService: NotificationService = {
  async listInbox() {
    const result = await request<{ items: AppNotificationItem[] }>('/v1/app/notifications');
    return result.ok ? ok(result.data.items) : result;
  },
  async markRead(id: string) {
    const result = await request<{ ok: boolean }>(`/v1/app/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
    return result.ok ? ok(undefined) : result;
  },
  async markAllRead() {
    const result = await request<{ ok: boolean }>('/v1/app/notifications/read-all', { method: 'POST' });
    return result.ok ? ok(undefined) : result;
  },
};

export const apiAdminV22SyncService: AdminV22SyncService = {
  health() {
    return request<AdminV22SyncHealth>('/v1/app/admin-v2-2-sync/health');
  },
};

export const apiServices = {
  auth: apiAuthService,
  cycle: apiCycleService,
  cycleSettings: apiCycleSettingsService,
  prediction: apiPredictionService,
  boxPreferences: apiBoxPreferenceService,
  subscription: apiSubscriptionService,
  orders: apiOrderService,
  payments: apiPaymentService,
  checkout: apiCheckoutService,
  account: apiAccountService,
  support: apiSupportService,
  notifications: apiNotificationService,
  adminV22Sync: apiAdminV22SyncService,
};
