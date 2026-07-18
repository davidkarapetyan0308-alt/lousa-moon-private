import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedStateStorage } from '../security/encryptedStateStorage';

import { ThemeName } from '../theme/tokens';
import { BoxPlanId } from '../data/boxCatalog';
import { addLocalDays, toLocalDateString } from '../utils/date';
import {
  AppNotificationItem,
  BoxFeedback,
  BoxOrder,
  BoxOrderStatus,
  BoxPreferences,
  FlowLevel,
  OnboardingProfile,
  PeriodRecord,
  PredictionEvaluation,
  CyclePrediction,
  CycleDayObservation,
  CycleObservationType,
  SubscriptionModel,
  DeliveryAddress,
  CommunicationStyle,
  InsightFeedback,
  InsightFeedbackResponse,
} from '../domain/models';
import { calculateCyclePrediction } from '../services/cyclePrediction';
import { migrateCycleStateToV6, confirmLegacyRecord } from '../services/migrations';
import { evaluatePrediction } from '../services/predictionAccuracy';
import { recommendBox } from '../services/boxRecommendation';
import { planBoxDelivery } from '../services/deliveryPlanning';
import { CycleValidationError, validateAndNormalizePeriodRecord, validateCycleObservationDate, validatePeriodRecordSet } from '../domain/cycleValidation';

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

// ========== USER STORE ==========
interface UserState {
  name: string;
  avatarUri: string | null;
  isPremium: boolean;
  theme: ThemeName;
  pinEnabled: boolean;
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  isOnboarded: boolean;
  language: 'en' | 'ru' | 'hy';
  isDemoMode: boolean;
  communicationStyle: CommunicationStyle;
  setName: (name: string) => void;
  setAvatar: (uri: string | null) => void;
  setPremium: (v: boolean) => void;
  setTheme: (t: ThemeName) => void;
  togglePin: () => void;
  toggleBiometric: () => void;
  toggleNotifications: () => void;
  setOnboarded: (v: boolean) => void;
  setLanguage: (lang: 'en' | 'ru' | 'hy') => void;
  setDemoMode: (value: boolean) => void;
  setCommunicationStyle: (value: CommunicationStyle) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      name: '',
      avatarUri: null,
      isPremium: false,
      theme: 'rose_gold',
      pinEnabled: false,
      biometricEnabled: false,
      notificationsEnabled: true,
      isOnboarded: false,
      language: 'ru',
      isDemoMode: false,
      communicationStyle: 'neutral',
      setName: (name) => set({ name }),
      setAvatar: (avatarUri) => set({ avatarUri }),
      setPremium: (isPremium) => set({ isPremium }),
      setTheme: (theme) => set({ theme }),
      togglePin: () => set((s) => ({ pinEnabled: !s.pinEnabled })),
      toggleBiometric: () => set((s) => ({ biometricEnabled: !s.biometricEnabled })),
      toggleNotifications: () => set((s) => ({ notificationsEnabled: !s.notificationsEnabled })),
      setOnboarded: (isOnboarded) => set({ isOnboarded }),
      setLanguage: (language) => set({ language }),
      setDemoMode: (isDemoMode) => set({ isDemoMode }),
      setCommunicationStyle: (communicationStyle) => set({ communicationStyle }),
    }),
    {
      name: 'lousa-user',
      version: 9,
      storage: createJSONStorage(() => encryptedStateStorage),
      migrate: (persisted: any) => {
        const avatarUri = typeof persisted?.avatarUri === 'string' ? persisted.avatarUri : null;
        const safeAvatarUri = avatarUri && !avatarUri.startsWith('data:') && !avatarUri.startsWith('blob:') ? avatarUri : null;
        return { ...persisted, avatarUri: safeAvatarUri, isDemoMode: Boolean(persisted?.isDemoMode), communicationStyle: persisted?.communicationStyle || 'neutral' };
      },
    }
  )
);

// ========== NOTIFICATION STORE ==========
export type NotificationPermissionState = 'unknown' | 'granted' | 'denied';
export type CheckInFrequency = 'twice_weekly' | 'three_weekly' | 'daily';

interface NotificationState {
  enabled: boolean;
  permissionStatus: NotificationPermissionState;
  privateMode: boolean;
  cycleEnabled: boolean;
  checkInEnabled: boolean;
  boxEnabled: boolean;
  lunarEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  checkInTime: string;
  checkInFrequency: CheckInFrequency;
  gentleSound: boolean;
  deliverySound: boolean;
  lastSyncedAt: string | null;
  inbox: AppNotificationItem[];
  setEnabled: (value: boolean) => void;
  setPermissionStatus: (value: NotificationPermissionState) => void;
  setPrivateMode: (value: boolean) => void;
  setCategory: (key: 'cycleEnabled' | 'checkInEnabled' | 'boxEnabled' | 'lunarEnabled', value: boolean) => void;
  setQuietHoursEnabled: (value: boolean) => void;
  setQuietHours: (start: string, end: string) => void;
  setCheckInTime: (value: string) => void;
  setCheckInFrequency: (value: CheckInFrequency) => void;
  setGentleSound: (value: boolean) => void;
  setDeliverySound: (value: boolean) => void;
  setLastSyncedAt: (value: string | null) => void;
  addInboxItem: (item: Omit<AppNotificationItem, 'id' | 'createdAt' | 'readAt'> & Partial<Pick<AppNotificationItem, 'id' | 'createdAt' | 'readAt'>>) => void;
  markInboxRead: (id: string) => void;
  markAllRead: () => void;
  clearInbox: () => void;
  resetNotifications: () => void;
}

const notificationDefaults = {
  enabled: false,
  permissionStatus: 'unknown' as NotificationPermissionState,
  privateMode: true,
  cycleEnabled: true,
  checkInEnabled: false,
  boxEnabled: true,
  lunarEnabled: false,
  quietHoursEnabled: true,
  quietStart: '21:30',
  quietEnd: '08:00',
  checkInTime: '19:00',
  checkInFrequency: 'twice_weekly' as CheckInFrequency,
  gentleSound: false,
  deliverySound: true,
  lastSyncedAt: null as string | null,
  inbox: [] as AppNotificationItem[],
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      ...notificationDefaults,
      setEnabled: (enabled) => set({ enabled }),
      setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
      setPrivateMode: (privateMode) => set({ privateMode }),
      setCategory: (key, value) => set({ [key]: value } as Pick<NotificationState, typeof key>),
      setQuietHoursEnabled: (quietHoursEnabled) => set({ quietHoursEnabled }),
      setQuietHours: (quietStart, quietEnd) => set({ quietStart, quietEnd }),
      setCheckInTime: (checkInTime) => set({ checkInTime }),
      setCheckInFrequency: (checkInFrequency) => set({ checkInFrequency }),
      setGentleSound: (gentleSound) => set({ gentleSound }),
      setDeliverySound: (deliverySound) => set({ deliverySound }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      addInboxItem: (item) => set((state) => ({
        inbox: [
          {
            ...item,
            id: item.id || makeId('notification'),
            createdAt: item.createdAt || nowIso(),
            readAt: item.readAt ?? null,
          } as AppNotificationItem,
          ...state.inbox,
        ].slice(0, 100),
      })),
      markInboxRead: (id) => set((state) => ({ inbox: state.inbox.map((item) => item.id === id ? { ...item, readAt: item.readAt || nowIso() } : item) })),
      markAllRead: () => set((state) => ({ inbox: state.inbox.map((item) => ({ ...item, readAt: item.readAt || nowIso() })) })),
      clearInbox: () => set({ inbox: [] }),
      resetNotifications: () => set({ ...notificationDefaults }),
    }),
    { name: 'lousa-notifications', version: 6, storage: createJSONStorage(() => encryptedStateStorage) }
  )
);

// ========== CYCLE STORE ==========
const defaultOnboardingProfile: OnboardingProfile = {
  goals: ['track'],
  cycleContext: 'prefer_not_to_say',
  factors: ['prefer_not_to_say'],
  regularity: 'unknown',
  shortestCycle: null,
  longestCycle: null,
  periodLengthKnown: false,
  completedAt: null,
  consentVersion: null,
  sensitiveDataConsentAt: null,
  onboardingStep: 0,
  onboardingCompleted: false,
  questionnaireStatus: 'partial',
  questionnaireSchemaVersion: null,
};

interface CycleEditSnapshot {
  periodRecords: PeriodRecord[];
  cycleObservations: CycleDayObservation[];
  at: string;
}

interface CycleState {
  // Legacy compatibility fields
  lastPeriodStart: string | null;
  avgCycleLength: number;
  avgPeriodLength: number;
  periodHistory: string[];
  // Domain model
  periodRecords: PeriodRecord[];
  deletedPeriodRecords: PeriodRecord[];
  onboardingProfile: OnboardingProfile;
  migrationReviewRequired: boolean;
  migrationIssues: string[];
  migrationCompletedAt: string | null;
  predictionSnapshots: CyclePrediction[];
  predictionEvaluations: PredictionEvaluation[];
  cycleObservations: CycleDayObservation[];
  deletedCycleObservations: CycleDayObservation[];
  cycleEditHistory: CycleEditSnapshot[];
  setLastPeriod: (date: string) => void;
  setCycleLength: (len: number) => void;
  setPeriodLength: (len: number) => void;
  addPeriodStart: (date: string) => void;
  removePeriodStart: (date: string) => void;
  addPeriodRecord: (record: Omit<PeriodRecord, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<PeriodRecord, 'id'>>) => void;
  updatePeriodRecord: (id: string, patch: Partial<PeriodRecord>) => void;
  removePeriodRecord: (id: string) => void;
  softDeletePeriodRecord: (id: string) => void;
  restoreLastDeletedPeriod: () => void;
  confirmPeriodRecord: (id: string) => void;
  setPeriodEnd: (id: string, endDate: string | null) => void;
  setFlowForDate: (id: string, date: string, flow: FlowLevel | null) => void;
  setPeriodDayDetails: (id: string, date: string, details: { pain?: number | null; productsUsed?: number | null; nightLeak?: boolean | null; symptoms?: string[]; note?: string | null }) => void;
  mergePeriodRecords: (primaryId: string, secondaryId: string) => void;
  splitPeriodRecord: (id: string, splitDate: string) => void;
  setOnboardingProfile: (patch: Partial<OnboardingProfile>) => void;
  replacePeriodRecords: (records: PeriodRecord[]) => void;
  ensureLegacyMigration: () => void;
  completeMigrationReview: () => void;
  capturePredictionSnapshot: () => CyclePrediction;
  setCycleObservation: (date: string, type: CycleObservationType, periodRecordId?: string | null) => void;
  removeCycleObservation: (date: string, type?: CycleObservationType) => void;
  restoreLastDeletedObservation: () => void;
  applyCycleDayObservation: (date: string, type: CycleObservationType, flow?: FlowLevel | null) => void;
  removeCycleDayEntry: (date: string) => void;
  undoLastCycleEdit: () => void;
}

function deriveLegacyFields(records: PeriodRecord[], fallbackCycle = 28, fallbackPeriod = 5) {
  const prediction = calculateCyclePrediction(records, { fallbackCycleLength: fallbackCycle, fallbackPeriodLength: fallbackPeriod });
  const starts = records.filter((record) => record.confirmed && !record.deletedAt && !record.needsReview).map((record) => record.startDate).sort();
  return {
    lastPeriodStart: starts[starts.length - 1] || null,
    periodHistory: starts,
    avgCycleLength: Math.max(21, Math.min(45, Math.round(prediction.weightedCycleLength ?? prediction.medianCycleLength ?? fallbackCycle))),
    avgPeriodLength: Math.max(2, Math.min(10, Math.round(prediction.averagePeriodLength ?? fallbackPeriod))),
  };
}

function predictionForState(state: Pick<CycleState, 'periodRecords' | 'avgCycleLength' | 'avgPeriodLength' | 'onboardingProfile' | 'cycleObservations'>) {
  return calculateCyclePrediction(state.periodRecords, {
    fallbackCycleLength: state.avgCycleLength,
    fallbackPeriodLength: state.avgPeriodLength,
    cycleContext: state.onboardingProfile.cycleContext,
    factors: state.onboardingProfile.factors,
    negativeBleedingDates: state.cycleObservations
      .filter((item) => item.type === 'no_bleeding' && !item.deletedAt)
      .map((item) => item.date),
  });
}

function evaluateSnapshots(snapshots: CyclePrediction[], actualStartDate: string, existing: PredictionEvaluation[]) {
  const additions = snapshots
    .map((snapshot) => evaluatePrediction(snapshot, actualStartDate))
    .filter((value): value is PredictionEvaluation => Boolean(value))
    .filter((value) => !existing.some((item) => item.id === value.id));
  return [...additions, ...existing].slice(0, 100);
}

export const useCycleStore = create<CycleState>()(
  persist(
    (set, get) => ({
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
      cycleEditHistory: [],
      setLastPeriod: (date) => {
        const state = get();
        validateAndNormalizePeriodRecord({ startDate: date, endDate: null, confirmed: true, source: 'user', flowByDay: { [date]: 'medium' } }, state.periodRecords, {
          ignoreId: state.periodRecords.find((record) => record.startDate === date)?.id,
        });
        const snapshot = predictionForState(state);
        const existing = state.periodRecords.find((record) => record.startDate === date && !record.deletedAt);
        const now = nowIso();
        const records = existing
          ? state.periodRecords.map((record) => record.id === existing.id ? { ...record, confirmed: true, needsReview: false, updatedAt: now } : record)
          : [...state.periodRecords, {
              id: makeId('period'),
              startDate: date,
              endDate: null,
              confirmed: true,
              source: 'user' as const,
              flowByDay: { [date]: 'medium' as FlowLevel },
              createdAt: now,
              updatedAt: now,
            }];
        const snapshots = snapshot.mostLikelyStart ? [snapshot, ...state.predictionSnapshots].slice(0, 24) : state.predictionSnapshots;
        set({
          periodRecords: records,
          predictionSnapshots: snapshots,
          predictionEvaluations: evaluateSnapshots(snapshots, date, state.predictionEvaluations),
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        });
      },
      setCycleLength: (avgCycleLength) => set({ avgCycleLength: Math.max(21, Math.min(45, Math.round(avgCycleLength))) }),
      setPeriodLength: (avgPeriodLength) => set({ avgPeriodLength: Math.max(2, Math.min(10, Math.round(avgPeriodLength))) }),
      addPeriodStart: (date) => get().setLastPeriod(date),
      removePeriodStart: (date) => set((state) => {
        const removed = state.periodRecords.filter((record) => record.startDate === date);
        const records = state.periodRecords.filter((record) => record.startDate !== date);
        return {
          periodRecords: records,
          deletedPeriodRecords: [...removed.map((item) => ({ ...item, deletedAt: nowIso() })), ...state.deletedPeriodRecords].slice(0, 20),
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      addPeriodRecord: (input) => set((state) => {
        const now = nowIso();
        const id = input.id || makeId('period');
        const checked = validateAndNormalizePeriodRecord(input, state.periodRecords, {
          ignoreId: id,
          allowDemoFuture: input.source === 'demo',
        });
        const record: PeriodRecord = {
          id,
          startDate: checked.startDate,
          endDate: checked.endDate ?? null,
          confirmed: checked.confirmed ?? true,
          source: checked.source || 'user',
          needsReview: checked.needsReview,
          migrationNote: checked.migrationNote,
          flowByDay: checked.flowByDay || {},
          painByDay: checked.painByDay,
          productsUsedByDay: checked.productsUsedByDay,
          nightLeakageByDay: checked.nightLeakageByDay,
          symptomsByDay: checked.symptomsByDay,
          notesByDay: checked.notesByDay,
          notes: checked.notes,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        const records = [...state.periodRecords.filter((item) => item.id !== record.id), record]
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        const evaluations = record.confirmed
          ? evaluateSnapshots(state.predictionSnapshots, record.startDate, state.predictionEvaluations)
          : state.predictionEvaluations;
        return {
          periodRecords: records,
          predictionEvaluations: evaluations,
          migrationReviewRequired: records.some((item) => item.needsReview || (item.source === 'legacy' && !item.confirmed)),
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      updatePeriodRecord: (id, patch) => set((state) => {
        const current = state.periodRecords.find((record) => record.id === id);
        if (!current) return state;
        const checked = validateAndNormalizePeriodRecord({ ...current, ...patch }, state.periodRecords, {
          ignoreId: id,
          allowDemoFuture: (patch.source || current.source) === 'demo',
        });
        const records = state.periodRecords.map((record) => record.id === id
          ? { ...record, ...checked, updatedAt: nowIso() } as PeriodRecord
          : record);
        return {
          periodRecords: records,
          migrationReviewRequired: records.some((item) => item.needsReview || (item.source === 'legacy' && !item.confirmed)),
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      removePeriodRecord: (id) => set((state) => {
        const records = state.periodRecords.filter((record) => record.id !== id);
        return { periodRecords: records, ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength) };
      }),
      softDeletePeriodRecord: (id) => set((state) => {
        const removed = state.periodRecords.find((record) => record.id === id);
        if (!removed) return state;
        const records = state.periodRecords.filter((record) => record.id !== id);
        return {
          periodRecords: records,
          deletedPeriodRecords: [{ ...removed, deletedAt: nowIso() }, ...state.deletedPeriodRecords].slice(0, 20),
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      restoreLastDeletedPeriod: () => set((state) => {
        const [record, ...rest] = state.deletedPeriodRecords;
        if (!record) return state;
        const restored = { ...record, deletedAt: null, updatedAt: nowIso() };
        const records = [...state.periodRecords.filter((item) => item.id !== restored.id), restored].sort((a, b) => a.startDate.localeCompare(b.startDate));
        return { periodRecords: records, deletedPeriodRecords: rest, ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength) };
      }),
      confirmPeriodRecord: (id) => set((state) => {
        const records = state.periodRecords.map((record) => record.id === id ? confirmLegacyRecord(record) : record);
        return {
          periodRecords: records,
          migrationReviewRequired: records.some((item) => item.needsReview || (item.source === 'legacy' && !item.confirmed)),
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      setPeriodEnd: (id, endDate) => get().updatePeriodRecord(id, { endDate }),
      setFlowForDate: (id, date, flow) => set((state) => {
        const records = state.periodRecords.map((record) => {
          if (record.id !== id) return record;
          const next = { ...record.flowByDay };
          if (flow) next[date] = flow;
          else delete next[date];
          return { ...record, flowByDay: next, updatedAt: nowIso() };
        });
        return { periodRecords: records, ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength) };
      }),
      setPeriodDayDetails: (id, date, details) => set((state) => {
        const records = state.periodRecords.map((record) => {
          if (record.id !== id) return record;
          const painByDay = { ...(record.painByDay || {}) };
          const productsUsedByDay = { ...(record.productsUsedByDay || {}) };
          const nightLeakageByDay = { ...(record.nightLeakageByDay || {}) };
          const symptomsByDay = { ...(record.symptomsByDay || {}) };
          const notesByDay = { ...(record.notesByDay || {}) };
          if (details.pain == null) delete painByDay[date]; else painByDay[date] = Math.max(0, Math.min(10, Math.round(details.pain)));
          if (details.productsUsed == null) delete productsUsedByDay[date]; else productsUsedByDay[date] = Math.max(0, Math.min(30, Math.round(details.productsUsed)));
          if (details.nightLeak == null) delete nightLeakageByDay[date]; else nightLeakageByDay[date] = details.nightLeak;
          if (details.symptoms) symptomsByDay[date] = details.symptoms;
          if (details.note == null || !details.note.trim()) delete notesByDay[date]; else notesByDay[date] = details.note.trim();
          return { ...record, painByDay, productsUsedByDay, nightLeakageByDay, symptomsByDay, notesByDay, updatedAt: nowIso() };
        });
        return { periodRecords: records };
      }),
      mergePeriodRecords: (primaryId, secondaryId) => set((state) => {
        const primary = state.periodRecords.find((item) => item.id === primaryId);
        const secondary = state.periodRecords.find((item) => item.id === secondaryId);
        if (!primary || !secondary || primary.id === secondary.id) return state;
        const merged: PeriodRecord = {
          ...primary,
          startDate: primary.startDate < secondary.startDate ? primary.startDate : secondary.startDate,
          endDate: [primary.endDate, secondary.endDate].filter(Boolean).sort().pop() || null,
          confirmed: primary.confirmed || secondary.confirmed,
          needsReview: Boolean(primary.needsReview || secondary.needsReview),
          flowByDay: { ...primary.flowByDay, ...secondary.flowByDay },
          painByDay: { ...(primary.painByDay || {}), ...(secondary.painByDay || {}) },
          productsUsedByDay: { ...(primary.productsUsedByDay || {}), ...(secondary.productsUsedByDay || {}) },
          nightLeakageByDay: { ...(primary.nightLeakageByDay || {}), ...(secondary.nightLeakageByDay || {}) },
          symptomsByDay: { ...(primary.symptomsByDay || {}), ...(secondary.symptomsByDay || {}) },
          notesByDay: { ...(primary.notesByDay || {}), ...(secondary.notesByDay || {}) },
          updatedAt: nowIso(),
        };
        const records = state.periodRecords.filter((item) => item.id !== primaryId && item.id !== secondaryId).concat(merged).sort((a, b) => a.startDate.localeCompare(b.startDate));
        return { periodRecords: records, ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength) };
      }),
      splitPeriodRecord: (id, splitDate) => set((state) => {
        const source = state.periodRecords.find((item) => item.id === id);
        if (!source || splitDate <= source.startDate || (source.endDate && splitDate > source.endDate)) return state;
        const now = nowIso();
        const firstFlow = Object.fromEntries(Object.entries(source.flowByDay).filter(([date]) => date < splitDate));
        const secondFlow = Object.fromEntries(Object.entries(source.flowByDay).filter(([date]) => date >= splitDate));
        const first: PeriodRecord = { ...source, endDate: toLocalDateString(addLocalDays(splitDate, -1)), flowByDay: firstFlow, updatedAt: now };
        const second: PeriodRecord = { ...source, id: makeId('period'), startDate: splitDate, flowByDay: secondFlow, createdAt: now, updatedAt: now };
        const records = state.periodRecords.filter((item) => item.id !== id).concat(first, second).sort((a, b) => a.startDate.localeCompare(b.startDate));
        return { periodRecords: records, ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength) };
      }),
      setOnboardingProfile: (patch) => set((state) => ({ onboardingProfile: { ...state.onboardingProfile, ...patch } })),
      replacePeriodRecords: (records) => set((state) => {
        const validated = validatePeriodRecordSet(records);
        return {
          periodRecords: validated,
          migrationReviewRequired: validated.some((item) => item.needsReview || (item.source === 'legacy' && !item.confirmed)),
          ...deriveLegacyFields(validated, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      ensureLegacyMigration: () => set((state) => {
        if (state.periodRecords.length && state.migrationCompletedAt) return state;
        const migration = migrateCycleStateToV6(state);
        return {
          ...state,
          periodRecords: migration.periodRecords,
          migrationReviewRequired: migration.needsReview,
          migrationIssues: migration.issues,
          migrationCompletedAt: migration.migratedAt,
          ...deriveLegacyFields(migration.periodRecords, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      completeMigrationReview: () => set((state) => ({
        migrationReviewRequired: state.periodRecords.some((item) => item.needsReview || (item.source === 'legacy' && !item.confirmed)),
      })),
      setCycleObservation: (date, type, periodRecordId = null) => set((state) => {
        date = validateCycleObservationDate(date);
        const now = nowIso();
        const previous = state.cycleObservations.filter((item) => item.date === date && !item.deletedAt);
        const sameType = previous.find((item) => item.type === type);
        const observation: CycleDayObservation = sameType
          ? { ...sameType, periodRecordId: periodRecordId ?? sameType.periodRecordId ?? null, updatedAt: now }
          : { id: makeId('cycle-observation'), date, type, source: 'user', periodRecordId, createdAt: now, updatedAt: now, deletedAt: null };
        const cycleObservations = [
          ...state.cycleObservations.filter((item) => item.date !== date),
          observation,
        ].sort((a, b) => a.date.localeCompare(b.date));
        const replaced = previous.filter((item) => item.id !== observation.id);
        return {
          cycleObservations,
          deletedCycleObservations: [
            ...replaced.map((item) => ({ ...item, deletedAt: now, updatedAt: now })),
            ...state.deletedCycleObservations,
          ].slice(0, 50),
        };
      }),
      removeCycleObservation: (date, type) => set((state) => {
        const removed = state.cycleObservations.filter((item) => item.date === date && (!type || item.type === type));
        if (!removed.length) return state;
        return {
          cycleObservations: state.cycleObservations.filter((item) => !removed.some((removedItem) => removedItem.id === item.id)),
          deletedCycleObservations: [
            ...removed.map((item) => ({ ...item, deletedAt: nowIso(), updatedAt: nowIso() })),
            ...state.deletedCycleObservations,
          ].slice(0, 50),
        };
      }),
      restoreLastDeletedObservation: () => set((state) => {
        const [observation, ...rest] = state.deletedCycleObservations;
        if (!observation) return state;
        const restored = { ...observation, deletedAt: null, updatedAt: nowIso() };
        return {
          cycleObservations: [...state.cycleObservations.filter((item) => item.date !== restored.date), restored].sort((a, b) => a.date.localeCompare(b.date)),
          deletedCycleObservations: rest,
        };
      }),
      applyCycleDayObservation: (date, type, flow = null) => set((state) => {
        date = validateCycleObservationDate(date);
        const now = nowIso();
        const snapshot: CycleEditSnapshot = {
          periodRecords: state.periodRecords.map((record) => ({ ...record, flowByDay: { ...record.flowByDay } })),
          cycleObservations: state.cycleObservations.map((item) => ({ ...item })),
          at: now,
        };
        let records = state.periodRecords.map((record) => ({ ...record, flowByDay: { ...record.flowByDay } }));
        const exactStart = records.find((record) => record.startDate === date && !record.deletedAt);
        const containing = records.find((record) => {
          if (record.deletedAt) return false;
          const end = record.endDate || record.startDate;
          return (date >= record.startDate && date <= end) || Boolean(record.flowByDay[date]);
        });
        let periodRecordId: string | null = containing?.id || exactStart?.id || null;
        const removedRecords: PeriodRecord[] = [];

        if (type === 'period_start') {
          if (exactStart) {
            records = records.map((record) => record.id === exactStart.id
              ? { ...record, confirmed: true, needsReview: false, flowByDay: { ...record.flowByDay, [date]: flow || record.flowByDay[date] || 'medium' }, updatedAt: now }
              : record);
            periodRecordId = exactStart.id;
          } else {
            const record: PeriodRecord = {
              id: makeId('period'),
              startDate: date,
              endDate: null,
              confirmed: true,
              source: 'user',
              flowByDay: { [date]: flow || 'medium' },
              createdAt: now,
              updatedAt: now,
            };
            records = [...records, record].sort((a, b) => a.startDate.localeCompare(b.startDate));
            periodRecordId = record.id;
          }
        } else if (type === 'period_day' && containing) {
          records = records.map((record) => record.id === containing.id
            ? { ...record, flowByDay: { ...record.flowByDay, [date]: flow || record.flowByDay[date] || 'medium' }, updatedAt: now }
            : record);
          periodRecordId = containing.id;
        } else if (type === 'period_end' && containing) {
          records = records.map((record) => record.id === containing.id
            ? { ...record, endDate: date, flowByDay: { ...record.flowByDay, [date]: flow || record.flowByDay[date] || 'medium' }, updatedAt: now }
            : record);
          periodRecordId = containing.id;
        } else if ((type === 'spotting' || type === 'no_bleeding') && exactStart) {
          removedRecords.push(exactStart);
          records = records.filter((record) => record.id !== exactStart.id);
          periodRecordId = null;
        } else if ((type === 'spotting' || type === 'no_bleeding') && containing) {
          records = records.map((record) => {
            if (record.id !== containing.id) return record;
            const nextFlow = { ...record.flowByDay };
            delete nextFlow[date];
            return { ...record, flowByDay: nextFlow, endDate: record.endDate === date ? null : record.endDate, updatedAt: now };
          });
          periodRecordId = null;
        }

        const previousObservations = state.cycleObservations.filter((item) => item.date === date && !item.deletedAt);
        const sameType = previousObservations.find((item) => item.type === type);
        const observation: CycleDayObservation = sameType
          ? { ...sameType, periodRecordId, updatedAt: now, deletedAt: null }
          : { id: makeId('cycle-observation'), date, type, source: 'user', periodRecordId, createdAt: now, updatedAt: now, deletedAt: null };
        const observations = [...state.cycleObservations.filter((item) => item.date !== date), observation].sort((a, b) => a.date.localeCompare(b.date));
        const replaced = previousObservations.filter((item) => item.id !== observation.id);
        return {
          periodRecords: records,
          cycleObservations: observations,
          deletedPeriodRecords: [...removedRecords.map((record) => ({ ...record, deletedAt: now })), ...state.deletedPeriodRecords].slice(0, 20),
          deletedCycleObservations: [...replaced.map((item) => ({ ...item, deletedAt: now, updatedAt: now })), ...state.deletedCycleObservations].slice(0, 50),
          cycleEditHistory: [snapshot, ...state.cycleEditHistory].slice(0, 12),
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      removeCycleDayEntry: (date) => set((state) => {
        date = validateCycleObservationDate(date);
        const now = nowIso();
        const matchingObservations = state.cycleObservations.filter((item) => item.date === date && !item.deletedAt);
        const exactStart = state.periodRecords.find((record) => record.startDate === date && !record.deletedAt);
        const containing = state.periodRecords.find((record) => {
          if (record.deletedAt) return false;
          const end = record.endDate || record.startDate;
          return (date >= record.startDate && date <= end) || Boolean(record.flowByDay[date]);
        });
        if (!matchingObservations.length && !exactStart && !containing) return state;
        const snapshot: CycleEditSnapshot = {
          periodRecords: state.periodRecords.map((record) => ({ ...record, flowByDay: { ...record.flowByDay } })),
          cycleObservations: state.cycleObservations.map((item) => ({ ...item })),
          at: now,
        };
        let records = state.periodRecords.map((record) => ({ ...record, flowByDay: { ...record.flowByDay } }));
        const removedRecords: PeriodRecord[] = [];
        if (exactStart) {
          removedRecords.push(exactStart);
          records = records.filter((record) => record.id !== exactStart.id);
        } else if (containing) {
          records = records.map((record) => {
            if (record.id !== containing.id) return record;
            const flowByDay = { ...record.flowByDay };
            delete flowByDay[date];
            return { ...record, flowByDay, endDate: record.endDate === date ? null : record.endDate, updatedAt: now };
          });
        }
        return {
          periodRecords: records,
          cycleObservations: state.cycleObservations.filter((item) => item.date !== date),
          deletedPeriodRecords: [...removedRecords.map((record) => ({ ...record, deletedAt: now })), ...state.deletedPeriodRecords].slice(0, 20),
          deletedCycleObservations: [...matchingObservations.map((item) => ({ ...item, deletedAt: now, updatedAt: now })), ...state.deletedCycleObservations].slice(0, 50),
          cycleEditHistory: [snapshot, ...state.cycleEditHistory].slice(0, 12),
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      undoLastCycleEdit: () => set((state) => {
        const [snapshot, ...rest] = state.cycleEditHistory;
        if (!snapshot) return state;
        const records = snapshot.periodRecords.map((record) => ({ ...record, flowByDay: { ...record.flowByDay } }));
        return {
          periodRecords: records,
          cycleObservations: snapshot.cycleObservations.map((item) => ({ ...item })),
          cycleEditHistory: rest,
          ...deriveLegacyFields(records, state.avgCycleLength, state.avgPeriodLength),
        };
      }),
      capturePredictionSnapshot: () => {
        const state = get();
        const prediction = predictionForState(state);
        if (prediction.mostLikelyStart) set({ predictionSnapshots: [prediction, ...state.predictionSnapshots].slice(0, 24) });
        return prediction;
      },
    }),
    {
      name: 'lousa-cycle',
      version: 10,
      storage: createJSONStorage(() => encryptedStateStorage),
      migrate: (persisted: any) => {
        const state = persisted || {};
        const migration = migrateCycleStateToV6(state);
        return {
          ...state,
          periodRecords: migration.periodRecords,
          deletedPeriodRecords: Array.isArray(state.deletedPeriodRecords) ? state.deletedPeriodRecords : [],
          onboardingProfile: { ...defaultOnboardingProfile, ...(state.onboardingProfile || {}) },
          migrationReviewRequired: migration.needsReview,
          migrationIssues: migration.issues,
          migrationCompletedAt: migration.migratedAt,
          predictionSnapshots: Array.isArray(state.predictionSnapshots) ? state.predictionSnapshots : [],
          predictionEvaluations: Array.isArray(state.predictionEvaluations) ? state.predictionEvaluations : [],
          cycleObservations: Array.isArray(state.cycleObservations) ? state.cycleObservations : [],
          deletedCycleObservations: Array.isArray(state.deletedCycleObservations) ? state.deletedCycleObservations : [],
          cycleEditHistory: [],
          ...deriveLegacyFields(migration.periodRecords.filter((record: PeriodRecord) => {
            try {
              validateAndNormalizePeriodRecord(record, [], { ignoreId: record.id, allowDemoFuture: record.source === 'demo' });
              return true;
            } catch (error) {
              return error instanceof CycleValidationError ? false : true;
            }
          }), state.avgCycleLength || 28, state.avgPeriodLength || 5),
        };
      },
    }
  )
);

// ========== MOOD/WELLNESS STORE ==========
export type MoodType = 'calm' | 'happy' | 'sad' | 'tired' | 'anxious' | 'irritable';
export type SymptomType =
  | 'headache'
  | 'migraine'
  | 'cramps'
  | 'fatigue'
  | 'cravings'
  | 'chills'
  | 'bloating'
  | 'backpain'
  | 'insomnia'
  | 'breast_tenderness'
  | 'nausea'
  | 'skin_irritation'
  | 'other';

export interface DailyLog {
  id?: string;
  date: string;
  mood: MoodType | null;
  symptoms: SymptomType[];
  energy: number;
  water: number;
  sleep: number;
  notes: string;
  flow: FlowLevel | null;
  painLevel: number | null;
  painArea?: string | null;
  productsUsed: number | null;
  nightLeak: boolean;
  medicationNote?: string;
  basalTemperature: number | null;
  temperatureTime?: string | null;
  temperatureDisturbed?: boolean;
  cervicalMucus: 'dry' | 'sticky' | 'creamy' | 'watery' | 'egg_white' | null;
  lhTest: 'negative' | 'high' | 'peak' | 'unknown' | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

interface WellnessState {
  dailyLogs: Record<string, DailyLog>;
  deletedLogs: DailyLog[];
  todayLog: () => DailyLog;
  getLog: (date: string) => DailyLog;
  saveLog: (log: DailyLog) => void;
  setMood: (date: string, mood: MoodType) => void;
  toggleSymptom: (date: string, symptom: SymptomType) => void;
  setEnergy: (date: string, energy: number) => void;
  addWater: (date: string) => void;
  setSleep: (date: string, hours: number) => void;
  setNotes: (date: string, notes: string) => void;
  setFlow: (date: string, flow: FlowLevel | null) => void;
  setPainLevel: (date: string, value: number | null) => void;
  setPainArea: (date: string, value: string | null) => void;
  setProductsUsed: (date: string, value: number | null) => void;
  setNightLeak: (date: string, value: boolean) => void;
  setMedicationNote: (date: string, value: string) => void;
  setFertilitySignal: (date: string, patch: Pick<Partial<DailyLog>, 'basalTemperature' | 'temperatureTime' | 'temperatureDisturbed' | 'cervicalMucus' | 'lhTest'>) => void;
  clearLog: (date: string) => void;
  restoreLastDeletedLog: () => void;
}

const defaultLog = (date: string): DailyLog => ({
  id: `log-${date}`,
  date,
  mood: null,
  symptoms: [],
  energy: 3,
  water: 0,
  sleep: 7,
  notes: '',
  flow: null,
  painLevel: null,
  painArea: null,
  productsUsed: null,
  nightLeak: false,
  medicationNote: '',
  basalTemperature: null,
  temperatureTime: null,
  temperatureDisturbed: false,
  cervicalMucus: null,
  lhTest: null,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  deletedAt: null,
});

const updateLog = (state: WellnessState, date: string, patch: Partial<DailyLog>) => {
  const current = state.dailyLogs[date] || defaultLog(date);
  return {
    dailyLogs: {
      ...state.dailyLogs,
      [date]: {
        ...current,
        ...patch,
        id: current.id || `log-${date}`,
        date,
        createdAt: current.createdAt || nowIso(),
        updatedAt: nowIso(),
        deletedAt: null,
      },
    },
  };
};

export const useWellnessStore = create<WellnessState>()(
  persist(
    (set, get) => ({
      dailyLogs: {},
      deletedLogs: [],
      todayLog: () => get().dailyLogs[toLocalDateString()] || defaultLog(toLocalDateString()),
      getLog: (date) => get().dailyLogs[date] || defaultLog(date),
      saveLog: (log) => set((state) => updateLog(state, log.date, log)),
      setMood: (date, mood) => set((state) => updateLog(state, date, { mood })),
      toggleSymptom: (date, symptom) => set((state) => {
        const log = state.dailyLogs[date] || defaultLog(date);
        const symptoms = log.symptoms.includes(symptom) ? log.symptoms.filter((value) => value !== symptom) : [...log.symptoms, symptom];
        return updateLog(state, date, { symptoms });
      }),
      setEnergy: (date, energy) => set((state) => updateLog(state, date, { energy: Math.max(1, Math.min(5, Math.round(energy))) })),
      addWater: (date) => set((state) => {
        const log = state.dailyLogs[date] || defaultLog(date);
        return updateLog(state, date, { water: Math.min(12, log.water + 1) });
      }),
      setSleep: (date, sleep) => set((state) => updateLog(state, date, { sleep: Math.max(0, Math.min(16, sleep)) })),
      setNotes: (date, notes) => set((state) => updateLog(state, date, { notes })),
      setFlow: (date, flow) => set((state) => updateLog(state, date, { flow })),
      setPainLevel: (date, painLevel) => set((state) => updateLog(state, date, { painLevel: painLevel == null ? null : Math.max(0, Math.min(10, Math.round(painLevel))) })),
      setPainArea: (date, painArea) => set((state) => updateLog(state, date, { painArea })),
      setProductsUsed: (date, productsUsed) => set((state) => updateLog(state, date, { productsUsed: productsUsed == null ? null : Math.max(0, Math.min(30, Math.round(productsUsed))) })),
      setNightLeak: (date, nightLeak) => set((state) => updateLog(state, date, { nightLeak })),
      setMedicationNote: (date, medicationNote) => set((state) => updateLog(state, date, { medicationNote })),
      setFertilitySignal: (date, patch) => set((state) => updateLog(state, date, patch)),
      clearLog: (date) => set((state) => {
        const dailyLogs = { ...state.dailyLogs };
        const removed = dailyLogs[date];
        delete dailyLogs[date];
        return {
          dailyLogs,
          deletedLogs: removed ? [{ ...removed, deletedAt: nowIso() }, ...state.deletedLogs].slice(0, 20) : state.deletedLogs,
        };
      }),
      restoreLastDeletedLog: () => set((state) => {
        const [log, ...rest] = state.deletedLogs;
        if (!log) return state;
        return {
          deletedLogs: rest,
          dailyLogs: { ...state.dailyLogs, [log.date]: { ...log, deletedAt: null, updatedAt: nowIso() } },
        };
      }),
    }),
    {
      name: 'lousa-wellness',
      version: 9,
      storage: createJSONStorage(() => encryptedStateStorage),
      migrate: (persisted: any) => {
        const logs = persisted?.dailyLogs || {};
        const migrated = Object.fromEntries(Object.entries(logs).map(([date, raw]: [string, any]) => [date, {
          ...defaultLog(date),
          ...raw,
          id: raw.id || `log-${date}`,
          energy: raw.energy > 5 ? Math.max(1, Math.min(5, Math.round(raw.energy / 20))) : Math.max(1, Math.min(5, raw.energy || 3)),
          mood: ['energetic', 'sensitive', 'romantic', 'tired'].includes(raw.mood) ? null : raw.mood,
          symptoms: (raw.symptoms || []).filter((symptom: string) => !['energetic', 'sensitive', 'romantic'].includes(symptom)),
          createdAt: raw.createdAt || nowIso(),
          updatedAt: raw.updatedAt || nowIso(),
          deletedAt: null,
        }]));
        return { ...persisted, dailyLogs: migrated, deletedLogs: Array.isArray(persisted?.deletedLogs) ? persisted.deletedLogs : [] };
      },
    }
  )
);

// ========== LOUSA BOX STORE ==========
export type DeliveryStatus = 'scheduled' | 'packing' | 'courier' | 'delivered';

const defaultBoxPreferences: BoxPreferences = {
  menstrualProducts: ['pads'],
  primaryProduct: 'pads',
  dailyQuantityEstimate: 5,
  periodLengthEstimate: 5,
  flowProfile: ['medium', 'medium', 'medium', 'light', 'light'],
  nightProtection: true,
  applicatorPreference: 'no_preference',
  wingPreference: 'wings',
  reusableProducts: false,
  skinSensitivity: false,
  fragranceFree: true,
  foodAllergies: [],
  cosmeticAllergies: [],
  dislikedItems: [],
  heatPadPreference: 'exclude',
  teaPreference: 'none',
  chocolatePreference: 'none',
  structuredAllergens: [],
  allowSubstitutions: false,
  substitutionPolicy: 'none',
};

interface BoxState {
  // Legacy compatibility
  isSubscribed: boolean;
  planId: BoxPlanId;
  address: string;
  deliveryAddress: DeliveryAddress | null;
  phone: string;
  deliveryNote: string;
  productType: 'pads' | 'tampons' | 'mixed';
  absorbency: 'regular' | 'super';
  fragranceFree: boolean;
  dietaryNote: string;
  deliveryWindow: string;
  nextDeliveryDate: string;
  status: DeliveryStatus;
  paused: boolean;
  // New model
  preferences: BoxPreferences;
  subscription: SubscriptionModel | null;
  orders: BoxOrder[];
  feedback: BoxFeedback[];
  subscribe: (payload: { planId: BoxPlanId; address: string; deliveryAddress?: DeliveryAddress | null; phone: string; deliveryNote?: string; productType?: 'pads' | 'tampons' | 'mixed'; absorbency?: 'regular' | 'super'; fragranceFree?: boolean; dietaryNote?: string; deliveryWindow?: string; nextDeliveryDate?: string }) => void;
  cancel: () => void;
  togglePause: () => void;
  pause: (mode: 'skip_next' | 'until' | 'indefinite', until?: string) => void;
  resume: () => void;
  syncPauseState: () => void;
  setStatus: (status: DeliveryStatus) => void;
  setOrderStatus: (orderId: string, status: BoxOrderStatus, note?: string) => void;
  setAddress: (address: string) => void;
  setDeliveryAddress: (address: DeliveryAddress | null) => void;
  updatePreferences: (patch: Partial<BoxPreferences>) => void;
  createRecommendedOrder: () => void;
  addFeedback: (feedback: Omit<BoxFeedback, 'createdAt'>) => void;
  applyServerSubscription: (subscription: SubscriptionModel | null) => void;
  replaceOrdersFromServer: (orders: BoxOrder[]) => void;
}

function defaultDeliveryDate(): string {
  return toLocalDateString(addLocalDays(new Date(), 7));
}

function mapLegacyStatus(status: DeliveryStatus): BoxOrderStatus {
  if (status === 'packing') return 'packing';
  if (status === 'courier') return 'out_for_delivery';
  if (status === 'delivered') return 'delivered';
  return 'scheduled';
}

function mapOrderStatus(status: BoxOrderStatus): DeliveryStatus {
  if (status === 'packing' || status === 'ready') return 'packing';
  if (status === 'courier_assigned' || status === 'out_for_delivery') return 'courier';
  if (status === 'delivered') return 'delivered';
  return 'scheduled';
}

export const useBoxStore = create<BoxState>()(
  persist(
    (set, get) => ({
      isSubscribed: false,
      planId: 'comfort',
      address: '',
      deliveryAddress: null,
      phone: '',
      deliveryNote: '',
      productType: 'pads',
      absorbency: 'regular',
      fragranceFree: true,
      dietaryNote: '',
      deliveryWindow: '10:00–14:00',
      nextDeliveryDate: defaultDeliveryDate(),
      status: 'scheduled',
      paused: false,
      preferences: defaultBoxPreferences,
      subscription: null,
      orders: [],
      feedback: [],
      subscribe: ({ planId, address, deliveryAddress = null, phone, deliveryNote = '', productType = 'pads', absorbency = 'regular', fragranceFree = true, dietaryNote = '', deliveryWindow = '10:00–14:00', nextDeliveryDate }) => {
        const now = nowIso();
        const cycle = useCycleStore.getState();
        cycle.ensureLegacyMigration();
        const prediction = calculateCyclePrediction(useCycleStore.getState().periodRecords, {
          fallbackCycleLength: cycle.avgCycleLength,
          fallbackPeriodLength: cycle.avgPeriodLength,
          cycleContext: cycle.onboardingProfile.cycleContext,
          factors: cycle.onboardingProfile.factors,
        });
        const delivery = planBoxDelivery({ prediction });
        const preferences: BoxPreferences = {
          ...get().preferences,
          primaryProduct: productType,
          menstrualProducts: [productType],
          fragranceFree,
          foodAllergies: dietaryNote ? [dietaryNote] : get().preferences.foodAllergies,
          periodLengthEstimate: prediction.averagePeriodLength || cycle.avgPeriodLength,
        };
        const recommendation = recommendBox({ plan: planId as any, preferences, periods: useCycleStore.getState().periodRecords, feedback: get().feedback, language: useUserStore.getState().language });
        const subscription: SubscriptionModel = {
          id: get().subscription?.id || makeId('subscription'),
          plan: planId as any,
          status: 'active',
          pauseUntil: null,
          skipNextBox: false,
          deliveryAddressId: 'local-primary',
          deliveryWindow,
          nextBillingDate: null,
          createdAt: get().subscription?.createdAt || now,
          updatedAt: now,
        };
        const plannedDate = nextDeliveryDate || delivery.targetDate || defaultDeliveryDate();
        const order: BoxOrder = {
          id: makeId('order'),
          cyclePredictionSnapshot: prediction,
          plannedDeliveryDate: plannedDate,
          deliveryRange: { earliest: delivery.earliestDate, latest: delivery.latestDate },
          preparationDeadline: delivery.preparationDeadline,
          customizationDeadline: delivery.customizationDeadline,
          status: 'awaiting_payment',
          paymentStatus: 'pending',
          currency: 'AMD',
          items: recommendation.items,
          statusHistory: [{ status: 'awaiting_payment', at: now, note: 'order_created' }],
          deliveryAddressSnapshot: deliveryAddress ? {
            recipientName: deliveryAddress.recipientName,
            phone: deliveryAddress.phone || phone,
            formattedAddress: deliveryAddress.formattedAddress || address,
            latitude: deliveryAddress.latitude,
            longitude: deliveryAddress.longitude,
            deliveryNote: deliveryAddress.instructions || deliveryNote,
            addressType: deliveryAddress.addressType,
            handoffType: deliveryAddress.handoffType,
            entrance: deliveryAddress.entrance,
            floor: deliveryAddress.floor,
            apartment: deliveryAddress.apartment,
            intercomCode: deliveryAddress.intercomCode,
            deliveryZoneId: deliveryAddress.deliveryZoneId,
            deliveryFeeMinor: deliveryAddress.deliveryFeeMinor,
            estimatedMinutes: deliveryAddress.estimatedMinutes,
          } : {
            recipientName: useUserStore.getState().name || 'LOUSA user',
            phone,
            formattedAddress: address,
            deliveryNote,
          },
          demo: false,
          createdAt: now,
          updatedAt: now,
        };
        set({
          isSubscribed: true,
          planId,
          address,
          deliveryAddress,
          phone,
          deliveryNote,
          productType,
          absorbency,
          fragranceFree,
          dietaryNote,
          deliveryWindow,
          nextDeliveryDate: plannedDate,
          status: 'scheduled',
          paused: false,
          preferences,
          subscription,
          orders: [order, ...get().orders.filter((item) => item.status !== 'draft')],
        });
      },
      cancel: () => set((state) => ({
        isSubscribed: false,
        status: 'scheduled',
        paused: false,
        subscription: state.subscription ? { ...state.subscription, status: 'cancelled', updatedAt: nowIso() } : null,
      })),
      togglePause: () => get().paused ? get().resume() : get().pause('indefinite'),
      pause: (mode, until) => set((state) => {
        const now = nowIso();
        const orders = state.orders.map((order, index) => {
          if (index !== 0 || !['draft', 'scheduled', 'customization_open'].includes(order.status)) return order;
          return {
            ...order,
            status: 'delayed' as const,
            updatedAt: now,
            statusHistory: [...order.statusHistory, { status: 'delayed' as const, at: now, note: `subscription_pause:${mode}` }],
          };
        });
        return {
          paused: true,
          status: 'scheduled' as const,
          orders,
          subscription: state.subscription ? {
            ...state.subscription,
            status: 'paused' as const,
            skipNextBox: mode === 'skip_next',
            pauseUntil: mode === 'until' ? until || null : null,
            updatedAt: now,
          } : null,
        };
      }),
      resume: () => set((state) => {
        const now = nowIso();
        const orders = state.orders.map((order, index) => {
          if (index !== 0 || order.status !== 'delayed') return order;
          return {
            ...order,
            status: 'scheduled' as const,
            updatedAt: now,
            statusHistory: [...order.statusHistory, { status: 'scheduled' as const, at: now, note: 'subscription_resumed' }],
          };
        });
        return {
          paused: false,
          orders,
          subscription: state.subscription ? { ...state.subscription, status: 'active' as const, skipNextBox: false, pauseUntil: null, updatedAt: now } : null,
        };
      }),
      syncPauseState: () => {
        const state = get();
        const pauseUntil = state.subscription?.pauseUntil;
        if (!state.paused || !pauseUntil) return;
        const today = toLocalDateString();
        if (pauseUntil <= today) state.resume();
      },
      setStatus: (status) => set((state) => {
        const current = state.orders[0];
        const mapped = mapLegacyStatus(status);
        const orders = current ? [{ ...current, status: mapped, updatedAt: nowIso(), statusHistory: [...current.statusHistory, { status: mapped, at: nowIso() }] }, ...state.orders.slice(1)] : state.orders;
        return { status, orders };
      }),
      setOrderStatus: (orderId, status, note) => set((state) => ({
        status: state.orders[0]?.id === orderId ? mapOrderStatus(status) : state.status,
        orders: state.orders.map((order) => order.id === orderId ? {
          ...order,
          status,
          updatedAt: nowIso(),
          statusHistory: [...order.statusHistory, { status, at: nowIso(), note }],
        } : order),
      })),
      setAddress: (address) => set({ address }),
      setDeliveryAddress: (deliveryAddress) => set({
        deliveryAddress,
        address: deliveryAddress?.formattedAddress || '',
        phone: deliveryAddress?.phone || get().phone,
        deliveryNote: deliveryAddress?.instructions || get().deliveryNote,
      }),
      updatePreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),
      createRecommendedOrder: () => {
        const state = get();
        if (!state.subscription) return;
        const cycle = useCycleStore.getState();
        const prediction = calculateCyclePrediction(cycle.periodRecords, {
          fallbackCycleLength: cycle.avgCycleLength,
          fallbackPeriodLength: cycle.avgPeriodLength,
          cycleContext: cycle.onboardingProfile.cycleContext,
          factors: cycle.onboardingProfile.factors,
        });
        const plan = planBoxDelivery({ prediction, paused: state.paused, skipNext: state.subscription.skipNextBox });
        const recommendation = recommendBox({ plan: state.planId as any, preferences: state.preferences, periods: cycle.periodRecords, feedback: state.feedback, language: useUserStore.getState().language });
        const now = nowIso();
        const order: BoxOrder = {
          id: makeId('order'),
          cyclePredictionSnapshot: prediction,
          plannedDeliveryDate: plan.targetDate,
          deliveryRange: { earliest: plan.earliestDate, latest: plan.latestDate },
          preparationDeadline: plan.preparationDeadline,
          customizationDeadline: plan.customizationDeadline,
          status: plan.mode === 'next_cycle' ? 'delayed' : 'scheduled',
          items: recommendation.items,
          statusHistory: [{ status: plan.mode === 'next_cycle' ? 'delayed' : 'scheduled', at: now, note: plan.reasons.join(',') }],
          demo: false,
          createdAt: now,
          updatedAt: now,
        };
        set({ orders: [order, ...state.orders], nextDeliveryDate: order.plannedDeliveryDate || state.nextDeliveryDate });
      },
      addFeedback: (feedback) => set((state) => ({ feedback: [{ ...feedback, createdAt: nowIso() }, ...state.feedback] })),
      applyServerSubscription: (subscription) => set((state) => ({
        subscription,
        isSubscribed: Boolean(subscription && subscription.status !== 'cancelled' && subscription.status !== 'expired'),
        paused: subscription?.status === 'paused',
        planId: subscription?.plan || state.planId,
        deliveryWindow: subscription?.deliveryWindow || state.deliveryWindow,
        nextDeliveryDate: subscription?.nextDeliveryDate || state.nextDeliveryDate,
      })),
      replaceOrdersFromServer: (orders) => set({ orders }),
    }),
    {
      name: 'lousa-box',
      version: 9,
      storage: createJSONStorage(() => encryptedStateStorage),
      migrate: (persisted: any) => ({
        ...persisted,
        preferences: { ...defaultBoxPreferences, ...(persisted?.preferences || {}), fragranceFree: persisted?.fragranceFree ?? persisted?.preferences?.fragranceFree ?? true },
        subscription: persisted?.subscription || (persisted?.isSubscribed ? {
          id: makeId('subscription'),
          plan: persisted.planId || 'comfort',
          status: persisted.paused ? 'paused' : 'active',
          pauseUntil: null,
          skipNextBox: false,
          deliveryAddressId: 'local-primary',
          deliveryWindow: persisted.deliveryWindow || '10:00–14:00',
          nextBillingDate: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        } : null),
        orders: persisted?.orders || [],
        feedback: persisted?.feedback || [],
        deliveryAddress: persisted?.deliveryAddress || null,
      }),
    }
  )
);

// Compatibility helpers for callers that need a current prediction.
export function getCurrentCyclePrediction() {
  const cycle = useCycleStore.getState();
  cycle.ensureLegacyMigration();
  const current = useCycleStore.getState();
  return calculateCyclePrediction(current.periodRecords, {
    fallbackCycleLength: current.avgCycleLength,
    fallbackPeriodLength: current.avgPeriodLength,
    cycleContext: current.onboardingProfile.cycleContext,
    factors: current.onboardingProfile.factors,
  });
}


// ========== CALM ENGAGEMENT STORE ==========
interface EngagementState {
  insightFeedback: InsightFeedback[];
  weeklySummariesOpened: number;
  cycleStoriesOpened: string[];
  lastProgressivePromptAt: string | null;
  dismissedProgressivePrompts: string[];
  quickCheckInCount: number;
  submitInsightFeedback: (insightId: string, response: InsightFeedbackResponse, date?: string) => void;
  markWeeklySummaryOpened: () => void;
  markCycleStoryOpened: (storyId: string) => void;
  markProgressivePromptShown: (promptId: string, date?: string) => void;
  dismissProgressivePrompt: (promptId: string) => void;
  recordQuickCheckIn: () => void;
  resetCalmEngagement: () => void;
}

const engagementDefaults = {
  insightFeedback: [] as InsightFeedback[],
  weeklySummariesOpened: 0,
  cycleStoriesOpened: [] as string[],
  lastProgressivePromptAt: null as string | null,
  dismissedProgressivePrompts: [] as string[],
  quickCheckInCount: 0,
};

export const useEngagementStore = create<EngagementState>()(
  persist(
    (set) => ({
      ...engagementDefaults,
      submitInsightFeedback: (insightId, response, date = toLocalDateString()) => set((state) => ({
        insightFeedback: [
          {
            id: makeId('insight-feedback'),
            insightId,
            date,
            response,
            createdAt: nowIso(),
          },
          ...state.insightFeedback.filter((item) => !(item.insightId === insightId && item.date === date)),
        ].slice(0, 300),
      })),
      markWeeklySummaryOpened: () => set((state) => ({ weeklySummariesOpened: state.weeklySummariesOpened + 1 })),
      markCycleStoryOpened: (storyId) => set((state) => ({ cycleStoriesOpened: Array.from(new Set([storyId, ...state.cycleStoriesOpened])).slice(0, 50) })),
      markProgressivePromptShown: (_promptId, date = toLocalDateString()) => set({ lastProgressivePromptAt: `${date}T12:00:00.000Z` }),
      dismissProgressivePrompt: (promptId) => set((state) => ({ dismissedProgressivePrompts: Array.from(new Set([promptId, ...state.dismissedProgressivePrompts])).slice(0, 50) })),
      recordQuickCheckIn: () => set((state) => ({ quickCheckInCount: state.quickCheckInCount + 1 })),
      resetCalmEngagement: () => set({ ...engagementDefaults }),
    }),
    {
      name: 'lousa-calm-engagement',
      version: 1,
      storage: createJSONStorage(() => encryptedStateStorage),
    }
  )
);

export function seedDemoData() {
  const today = new Date();
  const starts = [0, 28, 57, 85, 114, 142].map((daysAgo) => toLocalDateString(addLocalDays(today, -daysAgo))).sort();
  const records: PeriodRecord[] = starts.map((startDate, index) => {
    const created = nowIso();
    const endDate = toLocalDateString(addLocalDays(startDate, index % 3 === 0 ? 5 : 4));
    const flowByDay: Record<string, FlowLevel> = {};
    const levels: FlowLevel[] = ['medium', 'heavy', 'medium', 'light', 'light'];
    levels.forEach((flow, offset) => { flowByDay[toLocalDateString(addLocalDays(startDate, offset))] = flow; });
    return { id: `demo-period-${index}`, startDate, endDate, confirmed: true, source: 'demo', flowByDay, createdAt: created, updatedAt: created };
  });
  useCycleStore.getState().replacePeriodRecords(records);
  useCycleStore.getState().setOnboardingProfile({
    goals: ['track', 'symptoms', 'box'],
    cycleContext: 'natural',
    factors: ['none'],
    regularity: 'regular',
    shortestCycle: 28,
    longestCycle: 29,
    periodLengthKnown: true,
    completedAt: nowIso(),
  });
  useUserStore.setState({ name: 'Ани', isPremium: true, isOnboarded: true, isDemoMode: true, communicationStyle: 'warm' });

  const dailyLogs: Record<string, DailyLog> = {};
  for (let offset = 0; offset < 14; offset += 1) {
    const date = toLocalDateString(addLocalDays(today, -offset));
    dailyLogs[date] = {
      ...defaultLog(date),
      mood: offset % 4 === 0 ? 'calm' : offset % 4 === 1 ? 'happy' : offset % 4 === 2 ? 'anxious' : 'irritable',
      energy: 2 + (offset % 4),
      water: 4 + (offset % 4),
      sleep: 6.5 + (offset % 3) * 0.5,
      symptoms: offset % 3 === 0 ? ['cramps', 'fatigue'] : offset % 3 === 1 ? ['bloating'] : [],
      flow: offset >= 9 && offset <= 13 ? (offset === 10 ? 'heavy' : 'medium') : null,
      painLevel: offset >= 9 ? 4 : null,
    };
  }
  useWellnessStore.setState({ dailyLogs });

  useBoxStore.getState().updatePreferences({
    primaryProduct: 'mixed',
    menstrualProducts: ['pads', 'tampons'],
    dailyQuantityEstimate: 5,
    periodLengthEstimate: 5,
    flowProfile: ['medium', 'heavy', 'medium', 'light', 'light'],
    nightProtection: true,
    fragranceFree: true,
    heatPadPreference: 'include',
  });
  useBoxStore.getState().subscribe({
    planId: 'comfort',
    address: 'Гюмри, ул. Абовяна, 12',
    phone: '+374 99 000000',
    deliveryNote: 'Позвонить перед доставкой',
    productType: 'mixed',
    absorbency: 'super',
    fragranceFree: true,
    dietaryNote: 'Без орехов',
    deliveryWindow: '10:00–14:00',
  });
  const currentOrder = useBoxStore.getState().orders[0];
  if (currentOrder) useBoxStore.getState().setOrderStatus(currentOrder.id, 'out_for_delivery', 'demo_courier_en_route');

  useNotificationStore.setState({
    inbox: [
      { id: 'demo-notification-box', category: 'box', title: 'Курьер в пути', body: 'Демонстрационный заказ прибудет в выбранное окно.', privateBody: 'LOUSA — у тебя новое личное напоминание.', createdAt: nowIso(), readAt: null, route: '/(tabs)/box' },
      { id: 'demo-notification-cycle', category: 'cycle', title: 'Прогноз обновлён', body: 'Диапазон следующей менструации уточнён по истории циклов.', privateBody: 'LOUSA — у тебя новое личное напоминание.', createdAt: nowIso(), readAt: null, route: '/(tabs)/cycle' },
    ],
  });
}
