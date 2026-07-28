import {
  AppNotificationItem,
  AdminV22SyncHealth,
  BoxFeedback,
  BoxOrder,
  BoxPreferences,
  CyclePrediction,
  CycleDayObservation,
  PeriodRecord,
  SubscriptionModel,
  OrderTimelineSnapshot,
  SupportTicket,
  CourierContact,
  OnboardingProfile,
} from '../../domain/models';
import { PaymentIntent, PaymentMethod, Refund } from '../payment';

export interface ServiceError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

export type AuthSessionState =
  | 'unauthenticated'
  | 'firebase_authenticated'
  | 'backend_session_pending'
  | 'authenticated'
  | 'guest'
  | 'local_limited_mode'
  | 'session_expired'
  | 'session_error';

export interface SessionInfo {
  userId: string;
  sessionId: string;
  accessToken?: string;
  refreshToken?: string;
  demo: boolean;
  email?: string;
  phone?: string;
  name?: string;
  avatarUri?: string | null;
  isNewUser?: boolean;
  sessionState?: AuthSessionState;
  backendSessionReady?: boolean;
  limitedReason?: string;
}

export interface AuthService {
  signIn(email: string, password: string): Promise<ServiceResult<SessionInfo>>;
  signInWithGoogle?(idToken: string, context?: { attemptId?: string }): Promise<ServiceResult<SessionInfo>>;
  startPhoneAuth?(input: { phone: string; language?: 'ru' | 'en' | 'hy' }): Promise<ServiceResult<{ expiresAt: string; resendAfterSeconds?: number; smsDelivery?: { provider: string; configured: boolean; devMode?: boolean }; devCode?: string }>>;
  verifyPhoneAuth?(input: { phone: string; code: string }): Promise<ServiceResult<SessionInfo>>;
  register?(input: { name: string; email: string; password: string; language?: 'ru' | 'en' | 'hy' }): Promise<ServiceResult<{ expiresAt: string; resendAfterSeconds?: number; emailDelivery?: { provider: string; configured: boolean; devMode?: boolean }; devCode?: string; firebaseSessionReady?: boolean; firebaseEmailVerificationSent?: boolean; session?: SessionInfo }>>;
  verifyRegistration?(email: string, code: string): Promise<ServiceResult<SessionInfo>>;
  resendRegistrationVerification?(): Promise<ServiceResult<{ resendAfterSeconds?: number }>>;
  signOut(): Promise<ServiceResult<void>>;
  signOutAll?(): Promise<ServiceResult<void>>;
  refreshSession?(): Promise<ServiceResult<SessionInfo>>;
  retryBackendSession?(): Promise<ServiceResult<SessionInfo>>;
  requestEmailCode?(email: string): Promise<ServiceResult<{ expiresAt: string }>>;
  verifyEmailCode?(email: string, code: string): Promise<ServiceResult<SessionInfo>>;
  requestPasswordReset?(email: string, language?: 'ru' | 'en' | 'hy'): Promise<ServiceResult<{ emailDelivery?: { provider: string; configured: boolean; devMode?: boolean }; devCode?: string } | void>>;
  resetPassword?(input: { email: string; code: string; newPassword: string }): Promise<ServiceResult<void>>;
}

export interface CycleService {
  listPeriods(): Promise<ServiceResult<PeriodRecord[]>>;
  savePeriod(record: PeriodRecord): Promise<ServiceResult<PeriodRecord>>;
  deletePeriod(id: string): Promise<ServiceResult<void>>;
  restoreLastDeleted?(): Promise<ServiceResult<PeriodRecord | null>>;
  updatePeriod?(id: string, patch: Partial<PeriodRecord>): Promise<ServiceResult<PeriodRecord>>;
  listObservations?(): Promise<ServiceResult<CycleDayObservation[]>>;
  saveObservation?(observation: CycleDayObservation): Promise<ServiceResult<CycleDayObservation>>;
  deleteObservation?(id: string): Promise<ServiceResult<void>>;
}


export interface CycleSettingsPayload {
  averageCycleLength: number;
  averagePeriodLength: number;
  onboardingProfile: OnboardingProfile;
  schemaVersion: number;
}

export interface CycleSettingsService {
  getSettings(): Promise<ServiceResult<CycleSettingsPayload | null>>;
  saveSettings(settings: CycleSettingsPayload): Promise<ServiceResult<CycleSettingsPayload>>;
}

export interface PredictionService {
  getPrediction(): Promise<ServiceResult<CyclePrediction>>;
}

export interface DiaryService<TLog = unknown> {
  listLogs(): Promise<ServiceResult<TLog[]>>;
  saveLog(log: TLog): Promise<ServiceResult<TLog>>;
  deleteLog?(date: string): Promise<ServiceResult<void>>;
  restoreLastDeleted?(): Promise<ServiceResult<TLog | null>>;
}

export type SubscriptionAction =
  | { action: 'pause_until'; pauseUntil: string }
  | { action: 'pause_indefinite' }
  | { action: 'skip_next' }
  | { action: 'resume' }
  | { action: 'cancel'; reason?: string };

export type SubscriptionActivationInput = {
  orderId: string;
  plan: SubscriptionModel['plan'];
  deliveryAddressId: string;
  deliveryWindow?: string;
  preferredDeliveryDate?: string | null;
  preferredWeekday?: number | null;
};

export interface SubscriptionService {
  getSubscription(): Promise<ServiceResult<SubscriptionModel | null>>;
  saveSubscription(subscription: SubscriptionActivationInput): Promise<ServiceResult<SubscriptionModel>>;
  updateSubscription(input: SubscriptionAction): Promise<ServiceResult<SubscriptionModel | null>>;
}

export interface OrderService {
  listOrders(): Promise<ServiceResult<BoxOrder[]>>;
  listActiveOrders?(): Promise<ServiceResult<BoxOrder[]>>;
  getOrderDetail?(orderId: string): Promise<ServiceResult<BoxOrder>>;
  getOrderTimeline?(orderId: string): Promise<ServiceResult<OrderTimelineSnapshot>>;
  saveOrder(order: BoxOrder): Promise<ServiceResult<BoxOrder>>;
  saveFeedback(feedback: BoxFeedback): Promise<ServiceResult<BoxFeedback>>;
}

export interface DeliveryService {
  getOrderStatus(orderId: string): Promise<ServiceResult<BoxOrder>>;
}

export interface NotificationService {
  listInbox(): Promise<ServiceResult<AppNotificationItem[]>>;
  markRead(id: string): Promise<ServiceResult<void>>;
  markAllRead?(): Promise<ServiceResult<void>>;
  clear?(): Promise<ServiceResult<void>>;
}

export interface SupportService {
  listTickets(): Promise<ServiceResult<SupportTicket[]>>;
  getTicket(ticketId: string): Promise<ServiceResult<SupportTicket>>;
  createTicket(input: { subject: string; message: string; category?: string; orderId?: string | null }): Promise<ServiceResult<SupportTicket>>;
  sendMessage(ticketId: string, message: string): Promise<ServiceResult<SupportTicket>>;
  closeTicket(ticketId: string): Promise<ServiceResult<SupportTicket>>;
  getCourierContact(orderId: string): Promise<ServiceResult<CourierContact>>;
  sendCourierMessage(orderId: string, message: string): Promise<ServiceResult<{ ok: boolean; ticketId: string; message: string }>>;
}

export interface AdminV22SyncService {
  health(): Promise<ServiceResult<AdminV22SyncHealth>>;
}

export interface ProfileService<TProfile = unknown> {
  getProfile(): Promise<ServiceResult<TProfile>>;
  saveProfile(profile: TProfile): Promise<ServiceResult<TProfile>>;
}

export interface BoxPreferenceService {
  getPreferences(): Promise<ServiceResult<BoxPreferences>>;
  savePreferences(preferences: BoxPreferences): Promise<ServiceResult<BoxPreferences>>;
}

export interface PaymentService {
  listPaymentMethods(): Promise<ServiceResult<PaymentMethod[]>>;
  createPayment(input: { orderId: string; amountMinor: number; idempotencyKey: string }): Promise<ServiceResult<PaymentIntent>>;
  confirmPayment(intentId: string, paymentMethodId: string): Promise<ServiceResult<PaymentIntent>>;
  refundPayment(input: { intentId: string; amountMinor?: number; reason?: string }): Promise<ServiceResult<Refund>>;
}

export interface CheckoutSelectionItem {
  sku: string;
  quantity: number;
}

export interface ServerOrderQuote {
  quoteId: string;
  expiresAt: string;
  currency: 'AMD';
  basePriceMinor: number;
  includedItems: Array<{ productId: string; sku?: string; name?: string; quantity: number }>;
  addOns: Array<{ productId: string; sku?: string; name?: string; quantity: number; unitPriceMinor: number; totalMinor: number }>;
  addOnTotalMinor: number;
  deliveryFeeMinor: number;
  discountMinor: number;
  totalMinor: number;
  validationErrors: string[];
  warnings: string[];
}

export interface CheckoutService {
  createQuote(input: { planId: string; deliveryAddressId: string; selectedItems: CheckoutSelectionItem[]; preferences?: BoxPreferences }): Promise<ServiceResult<ServerOrderQuote>>;
  createOrder(input: { quoteId: string; idempotencyKey: string; recipient?: { name?: string }; handoff?: Record<string, unknown> }): Promise<ServiceResult<BoxOrder>>;
}

export interface AccountService {
  requestDeletion(): Promise<ServiceResult<{ id: string; status: string; requestedAt: string }>>;
  cancelDeletion(): Promise<ServiceResult<void>>;
  deleteAccount(): Promise<ServiceResult<void>>;
}
