import * as FileSystem from 'expo-file-system';

import { AUTH_TOKEN_KEYS, secureStorage } from './security/secureStorage';
import { clearAllAuthSessionState } from '../features/auth/session/sessionState';
import { clearEncryptedUserState, encryptedStateStorage } from '../security/encryptedStateStorage';
import type { BoxPreferences, OnboardingProfile } from '../domain/models';
import { useBoxStore, useCycleStore, useEngagementStore, useNotificationStore, useUserStore, useWellnessStore } from '../store';
import { addLocalDays, toLocalDateString } from '../utils/date';

const defaultOnboardingProfile: OnboardingProfile = {
  goals: ['track'],
  cycleContext: 'prefer_not_to_say' as const,
  factors: ['prefer_not_to_say'],
  regularity: 'unknown' as const,
  shortestCycle: null,
  longestCycle: null,
  periodLengthKnown: false,
  completedAt: null,
  consentVersion: null,
  sensitiveDataConsentAt: null,
  onboardingStep: 0,
  onboardingCompleted: false,
};

const defaultBoxPreferences: BoxPreferences = {
  menstrualProducts: ['pads'],
  primaryProduct: 'pads' as const,
  dailyQuantityEstimate: 5,
  periodLengthEstimate: 5,
  flowProfile: ['medium', 'medium', 'medium', 'light', 'light'],
  nightProtection: true,
  applicatorPreference: 'no_preference' as const,
  wingPreference: 'wings' as const,
  reusableProducts: false,
  skinSensitivity: false,
  fragranceFree: true,
  foodAllergies: [] as string[],
  cosmeticAllergies: [] as string[],
  dislikedItems: [] as string[],
  heatPadPreference: 'exclude' as const,
  teaPreference: 'none' as const,
  chocolatePreference: 'none' as const,
};

async function removeLocalAvatar(uri: string | null) {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Local cleanup failure must not block account/data removal.
  }
}

/**
 * Removes all local LOUSA data and in-memory state. This does not claim to
 * delete a future server account; that requires an authenticated backend call.
 */
export async function clearAllLocalData(): Promise<void> {
  const avatarUri = useUserStore.getState().avatarUri;

  await removeLocalAvatar(avatarUri);
  await secureStorage.clear([...AUTH_TOKEN_KEYS]);
  await clearAllAuthSessionState();
  await clearEncryptedUserState();
  await Promise.all([
    'lousa-notifications',
    'lousa-sync-queue',
    'lousa-sync-queue-v1',
    'lousa-cycle-sync-v2',
    'lousa-cycle-settings-sync-v1',
    'lousa-address-draft-v2',
    'lousa-calm-engagement',
    'lousa-onboarding-draft-v7',
    'lousa-onboarding-draft-v8',
  ].map((key) => encryptedStateStorage.removeItem(key)));

  useUserStore.setState({
    name: '',
    avatarUri: null,
    isPremium: false,
    theme: 'rose_gold',
    pinEnabled: false,
    biometricEnabled: false,
    notificationsEnabled: false,
    isOnboarded: false,
    language: 'ru',
    isDemoMode: false,
    isGuestMode: false,
    guestAuthFlowActive: false,
    guestStartedAt: null,
    communicationStyle: 'neutral',
    sessionState: 'unauthenticated',
    sessionError: null,
  });

  useCycleStore.setState({
    lastPeriodStart: null,
    avgCycleLength: 28,
    avgPeriodLength: 5,
    periodHistory: [],
    periodRecords: [],
    deletedPeriodRecords: [],
    onboardingProfile: defaultOnboardingProfile,
    migrationReviewRequired: false,
    migrationIssues: [],
    migrationCompletedAt: null,
    predictionSnapshots: [],
    predictionEvaluations: [],
    cycleObservations: [],
    deletedCycleObservations: [],
  });

  useWellnessStore.setState({ dailyLogs: {}, deletedLogs: [] });
  useBoxStore.setState({
    isSubscribed: false,
    planId: 'comfort',
    address: '',
    phone: '',
    deliveryNote: '',
    productType: 'pads',
    absorbency: 'regular',
    fragranceFree: true,
    dietaryNote: '',
    deliveryWindow: '10:00–14:00',
    nextDeliveryDate: toLocalDateString(addLocalDays(new Date(), 7)),
    status: 'scheduled',
    paused: false,
    preferences: defaultBoxPreferences,
    subscription: null,
    orders: [],
    feedback: [],
  });
  useNotificationStore.getState().resetNotifications();
  useEngagementStore.getState().resetCalmEngagement();
}
