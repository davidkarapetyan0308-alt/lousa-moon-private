import {
  AuthService,
  BoxPreferenceService,
  CheckoutService,
  AccountService,
  CycleService,
  DeliveryService,
  DiaryService,
  NotificationService,
  OrderService,
  PaymentService,
  PredictionService,
  ProfileService,
  ServiceResult,
  SubscriptionService,
  CycleSettingsService,
} from '../contracts';
import {
  DailyLog,
  getCurrentCyclePrediction,
  seedDemoData,
  useBoxStore,
  useCycleStore,
  useNotificationStore,
  useUserStore,
  useWellnessStore,
} from '../../store';
import { sandboxPaymentProvider } from '../payment';
import { secureStorage, AUTH_TOKEN_KEYS } from '../security/secureStorage';

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T>(code: string, message: string, recoverable = true): ServiceResult<T> => ({
  ok: false,
  error: { code, message, recoverable },
});

/**
 * Local adapters keep screens independent from a future backend transport.
 * They are deterministic and never claim to perform real payment,
 * account authentication, fulfilment or courier operations.
 */
export const localAuthService: AuthService = {
  async signIn(email, password) {
    if (email.toLowerCase() === 'demo@lousa.app' && password === 'Lousa2026') {
      seedDemoData();
      const session = {
        userId: 'local-demo-user',
        sessionId: 'local-demo-session',
        accessToken: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
        demo: true,
      };
      await secureStorage.set('accessToken', session.accessToken);
      await secureStorage.set('refreshToken', session.refreshToken);
      await secureStorage.set('sessionId', session.sessionId);
      return ok(session);
    }
    return fail('BACKEND_REQUIRED', 'Server authentication is not connected.', false);
  },
  async signInWithGoogle() {
    return fail('BACKEND_REQUIRED', 'Google sign-in requires server verification.', false);
  },
  async register() {
    return fail('BACKEND_REQUIRED', 'Account registration requires the LOUSA API.', false);
  },
  async startPhoneAuth() {
    return fail('SMS_PROVIDER_REQUIRED', 'Phone authentication requires the LOUSA API and SMS provider.', false);
  },
  async verifyPhoneAuth() {
    return fail('SMS_PROVIDER_REQUIRED', 'Phone verification requires the LOUSA API and SMS provider.', false);
  },
  async verifyRegistration() {
    return fail('BACKEND_REQUIRED', 'Email verification requires the LOUSA API.', false);
  },
  async signOut() {
    await secureStorage.clear([...AUTH_TOKEN_KEYS]);
    useUserStore.setState({ isOnboarded: false, isDemoMode: false });
    return ok(undefined);
  },
  async signOutAll() {
    await secureStorage.clear([...AUTH_TOKEN_KEYS]);
    useUserStore.setState({ isOnboarded: false, isDemoMode: false });
    return ok(undefined);
  },
  async requestEmailCode() {
    return fail('BACKEND_REQUIRED', 'Email verification requires the LOUSA API.', false);
  },
  async verifyEmailCode() {
    return fail('BACKEND_REQUIRED', 'Email verification requires the LOUSA API.', false);
  },
  async requestPasswordReset() {
    return fail('BACKEND_REQUIRED', 'Password reset requires the LOUSA API.', false);
  },
  async resetPassword() {
    return fail('BACKEND_REQUIRED', 'Password reset requires the LOUSA API.', false);
  },
};

export const localCycleService: CycleService = {
  async listPeriods() {
    return ok(useCycleStore.getState().periodRecords);
  },
  async savePeriod(record) {
    const state = useCycleStore.getState();
    const exists = state.periodRecords.some((item) => item.id === record.id);
    if (exists) state.updatePeriodRecord(record.id, record);
    else state.addPeriodRecord(record);
    const saved = useCycleStore.getState().periodRecords.find((item) => item.id === record.id) || record;
    return ok(saved);
  },
  async deletePeriod(id) {
    useCycleStore.getState().softDeletePeriodRecord(id);
    return ok(undefined);
  },
  async restoreLastDeleted() {
    const before = useCycleStore.getState().deletedPeriodRecords[0] || null;
    useCycleStore.getState().restoreLastDeletedPeriod();
    return ok(before);
  },
  async updatePeriod(id, patch) {
    useCycleStore.getState().updatePeriodRecord(id, patch);
    const updated = useCycleStore.getState().periodRecords.find((item) => item.id === id);
    return updated ? ok(updated) : fail('PERIOD_NOT_FOUND', 'Cycle record not found.', true);
  },
  async listObservations() {
    return ok(useCycleStore.getState().cycleObservations);
  },
  async saveObservation(observation) {
    useCycleStore.getState().setCycleObservation(observation.date, observation.type, observation.periodRecordId);
    const saved = useCycleStore.getState().cycleObservations.find((item) => item.date === observation.date && item.type === observation.type) || observation;
    return ok(saved);
  },
  async deleteObservation(id) {
    const item = useCycleStore.getState().cycleObservations.find((entry) => entry.id === id);
    if (!item) return fail('CYCLE_OBSERVATION_NOT_FOUND', 'Cycle observation not found.', true);
    useCycleStore.getState().removeCycleObservation(item.date, item.type);
    return ok(undefined);
  },
};


export const localCycleSettingsService: CycleSettingsService = {
  async getSettings() {
    const cycle = useCycleStore.getState();
    return ok({
      averageCycleLength: cycle.avgCycleLength,
      averagePeriodLength: cycle.avgPeriodLength,
      onboardingProfile: cycle.onboardingProfile,
      schemaVersion: Number(cycle.onboardingProfile.questionnaireSchemaVersion || 1),
    });
  },
  async saveSettings(settings) {
    useCycleStore.getState().setCycleLength(settings.averageCycleLength);
    useCycleStore.getState().setPeriodLength(settings.averagePeriodLength);
    useCycleStore.getState().setOnboardingProfile(settings.onboardingProfile);
    return ok(settings);
  },
};

export const localPredictionService: PredictionService = {
  async getPrediction() {
    return ok(getCurrentCyclePrediction());
  },
};

export const localDiaryService: DiaryService<DailyLog> = {
  async listLogs() {
    return ok(Object.values(useWellnessStore.getState().dailyLogs));
  },
  async saveLog(log) {
    useWellnessStore.getState().saveLog(log);
    return ok(useWellnessStore.getState().getLog(log.date));
  },
  async deleteLog(date) {
    useWellnessStore.getState().clearLog(date);
    return ok(undefined);
  },
  async restoreLastDeleted() {
    const before = useWellnessStore.getState().deletedLogs[0] || null;
    useWellnessStore.getState().restoreLastDeletedLog();
    return ok(before);
  },
};

export const localSubscriptionService: SubscriptionService = {
  async getSubscription() {
    return ok(useBoxStore.getState().subscription);
  },
  async saveSubscription() {
    return fail('BACKEND_REQUIRED', 'A server-confirmed paid order is required before a subscription can be activated.', false);
  },
  async updateSubscription() {
    return fail('BACKEND_REQUIRED', 'Subscription changes require the LOUSA API.', false);
  },
};

export const localOrderService: OrderService = {
  async listOrders() {
    return ok(useBoxStore.getState().orders);
  },
  async saveOrder(order) {
    useBoxStore.setState((state) => ({
      orders: [order, ...state.orders.filter((item) => item.id !== order.id)],
    }));
    return ok(order);
  },
  async saveFeedback(feedback) {
    useBoxStore.getState().addFeedback({
      orderId: feedback.orderId,
      enoughItems: feedback.enoughItems,
      tooFewCategories: feedback.tooFewCategories,
      tooManyCategories: feedback.tooManyCategories,
      likedItems: feedback.likedItems,
      removeItems: feedback.removeItems,
      replaceItems: feedback.replaceItems,
      allergyReaction: feedback.allergyReaction,
      irritationReaction: feedback.irritationReaction,
      packagingRating: feedback.packagingRating,
      deliveryRating: feedback.deliveryRating,
      note: feedback.note,
    });
    return ok(feedback);
  },
};

export const localDeliveryService: DeliveryService = {
  async getOrderStatus(orderId) {
    const order = useBoxStore.getState().orders.find((item) => item.id === orderId);
    return order ? ok(order) : fail('ORDER_NOT_FOUND', 'Order not found.');
  },
};

export const localNotificationService: NotificationService = {
  async listInbox() {
    return ok(useNotificationStore.getState().inbox);
  },
  async markRead(id) {
    useNotificationStore.getState().markInboxRead(id);
    return ok(undefined);
  },
  async markAllRead() {
    useNotificationStore.getState().markAllRead();
    return ok(undefined);
  },
  async clear() {
    useNotificationStore.getState().clearInbox();
    return ok(undefined);
  },
};

export type LocalProfile = Pick<ReturnType<typeof useUserStore.getState>, 'name' | 'avatarUri' | 'language' | 'isPremium' | 'isDemoMode'>;

export const localProfileService: ProfileService<LocalProfile> = {
  async getProfile() {
    const user = useUserStore.getState();
    return ok({ name: user.name, avatarUri: user.avatarUri, language: user.language, isPremium: user.isPremium, isDemoMode: user.isDemoMode });
  },
  async saveProfile(profile) {
    useUserStore.setState(profile);
    return ok(profile);
  },
};

export const localBoxPreferenceService: BoxPreferenceService = {
  async getPreferences() {
    return ok(useBoxStore.getState().preferences);
  },
  async savePreferences(preferences) {
    useBoxStore.setState({ preferences });
    return ok(preferences);
  },
};

export const localAccountService: AccountService = {
  async requestDeletion() { return fail('BACKEND_REQUIRED', 'Account deletion requires the LOUSA API.', false); },
  async cancelDeletion() { return fail('BACKEND_REQUIRED', 'Account deletion requires the LOUSA API.', false); },
  async deleteAccount() { return fail('BACKEND_REQUIRED', 'Account deletion requires the LOUSA API.', false); },
};

export const localCheckoutService: CheckoutService = {
  async createQuote() {
    return fail('BACKEND_REQUIRED', 'A verified server quote is required before checkout.', false);
  },
  async createOrder() {
    return fail('BACKEND_REQUIRED', 'A server order is required before payment.', false);
  },
};

export const localPaymentService: PaymentService = {
  async listPaymentMethods() {
    return ok(await sandboxPaymentProvider.listPaymentMethods());
  },
  async createPayment(input) {
    try {
      return ok(await sandboxPaymentProvider.createIntent({ ...input, currency: 'AMD' }));
    } catch (error) {
      return fail('SANDBOX_PAYMENT_ERROR', error instanceof Error ? error.message : 'Unknown payment error');
    }
  },
  async confirmPayment(intentId, paymentMethodId) {
    try {
      return ok(await sandboxPaymentProvider.confirmIntent(intentId, paymentMethodId));
    } catch (error) {
      return fail('SANDBOX_PAYMENT_ERROR', error instanceof Error ? error.message : 'Unknown payment error');
    }
  },
  async refundPayment(input) {
    try {
      return ok(await sandboxPaymentProvider.refund(input));
    } catch (error) {
      return fail('SANDBOX_PAYMENT_ERROR', error instanceof Error ? error.message : 'Unknown payment error');
    }
  },
};

export const localServices = {
  auth: localAuthService,
  cycle: localCycleService,
  cycleSettings: localCycleSettingsService,
  prediction: localPredictionService,
  diary: localDiaryService,
  subscription: localSubscriptionService,
  orders: localOrderService,
  delivery: localDeliveryService,
  notifications: localNotificationService,
  profile: localProfileService,
  boxPreferences: localBoxPreferenceService,
  payments: localPaymentService,
  checkout: localCheckoutService,
  account: localAccountService,
};
