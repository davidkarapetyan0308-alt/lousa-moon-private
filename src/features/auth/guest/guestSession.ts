import { useBoxStore, useCycleStore, useNotificationStore, useUserStore } from '../../../store';
import { clearBackendSessionTokens, clearPendingFirebaseExchange, setStoredAuthSessionState } from '../session/sessionState';
import { enqueueCycleSettingsSync, flushCycleSettingsSync } from '../../../services/cycleSettingsSync';
import { enqueueCycleSync, flushCycleSyncQueue, type CycleSyncOperation } from '../../../services/cycleSync';

export type GuestLanguage = 'ru' | 'en' | 'hy';

const GUEST_NAMES: Record<GuestLanguage, string> = {
  ru: 'Гость',
  en: 'Guest',
  hy: 'Հյուր',
};

/**
 * Starts a local-only LOUSA session.
 *
 * No Firebase user, backend token, server account or demo data is created.
 * Existing local cycle/wellness data is intentionally preserved.
 */
export async function enterGuestSession(language: GuestLanguage) {
  await Promise.all([clearBackendSessionTokens(), clearPendingFirebaseExchange()]);
  await setStoredAuthSessionState('guest');
  const current = useUserStore.getState();
  // Account-scoped commerce and remote notification data must never leak into
  // a local guest session. Cycle/wellness/preferences remain on-device.
  if (!current.isGuestMode) {
    useBoxStore.setState({
      isSubscribed: false,
      address: '',
      deliveryAddress: null,
      phone: '',
      deliveryNote: '',
      status: 'scheduled',
      paused: false,
      subscription: null,
      orders: [],
      feedback: [],
    });
    useNotificationStore.setState({ inbox: [], lastSyncedAt: null });
  }

  useUserStore.setState({
    name: current.isGuestMode && current.name ? current.name : GUEST_NAMES[language],
    avatarUri: current.isGuestMode ? current.avatarUri : null,
    isPremium: false,
    isOnboarded: true,
    isDemoMode: false,
    isGuestMode: true,
    guestAuthFlowActive: false,
    guestStartedAt: current.isGuestMode && current.guestStartedAt ? current.guestStartedAt : new Date().toISOString(),
    sessionState: 'guest',
    sessionError: null,
  });
}

export function beginGuestAccountUpgrade() {
  useUserStore.setState({ guestAuthFlowActive: true });
}

export function returnToGuestSession() {
  useUserStore.setState({
    isOnboarded: true,
    isGuestMode: true,
    guestAuthFlowActive: false,
    sessionState: 'guest',
    sessionError: null,
  });
  void setStoredAuthSessionState('guest');
}

export function finishGuestUpgradeLocally() {
  useUserStore.setState({
    isGuestMode: false,
    guestAuthFlowActive: false,
    guestStartedAt: null,
    sessionState: 'authenticated',
    sessionError: null,
  });
  void setStoredAuthSessionState('authenticated');
}

export function hasGuestCycleData() {
  const cycle = useCycleStore.getState();
  return cycle.periodRecords.length > 0 || cycle.cycleObservations.length > 0 || cycle.onboardingProfile.onboardingCompleted;
}

/**
 * Queues local guest cycle data only after a new account has been authenticated.
 * This is intentionally not called automatically for an existing account because
 * silently merging two histories could corrupt the user's server timeline.
 */
export async function queueGuestCycleDataForNewAccount() {
  await setStoredAuthSessionState('authenticated');
  const cycle = useCycleStore.getState();
  const operations: CycleSyncOperation[] = [];

  cycle.periodRecords.forEach((record) => {
    operations.push({
      kind: record.deletedAt ? 'delete_period' : 'upsert_period',
      payload: record.deletedAt ? { id: record.id } : record,
    } as CycleSyncOperation);
  });
  cycle.cycleObservations.forEach((observation) => {
    operations.push({
      kind: observation.deletedAt ? 'delete_observation' : 'upsert_observation',
      payload: observation.deletedAt ? { id: observation.id } : observation,
    } as CycleSyncOperation);
  });

  if (operations.length) await enqueueCycleSync(operations);
  if (cycle.onboardingProfile.onboardingCompleted) {
    await enqueueCycleSettingsSync({
      averageCycleLength: cycle.avgCycleLength,
      averagePeriodLength: cycle.avgPeriodLength,
      onboardingProfile: cycle.onboardingProfile,
      schemaVersion: 3,
    });
  }

  await Promise.allSettled([flushCycleSettingsSync(), flushCycleSyncQueue()]);
}
