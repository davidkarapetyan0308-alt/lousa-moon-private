import type { FlowLevel, PeriodRecord } from '../domain/models';
import { seedDemoData, useBoxStore, useCycleStore, useEngagementStore, useUserStore, useWellnessStore } from '../store';
import { addLocalDays, toLocalDateString } from '../utils/date';

export type UxTestPersonaId = 'new_user' | 'regular_cycle' | 'irregular_cycle' | 'box_user' | 'minimal_history';

export interface UxTestPersona {
  id: UxTestPersonaId;
  title: string;
  description: string;
}

export const UX_TEST_PERSONAS: UxTestPersona[] = [
  { id: 'new_user', title: 'Новый пользователь', description: 'Нет истории, прогноз пока недоступен.' },
  { id: 'regular_cycle', title: 'Регулярный цикл', description: 'Шесть подтверждённых циклов и несколько дневниковых записей.' },
  { id: 'irregular_cycle', title: 'Нерегулярный цикл', description: 'Заметный разброс дат и осторожная уверенность прогноза.' },
  { id: 'box_user', title: 'Пользователь LOUSA BOX', description: 'Демо-подписка, заказ, доставка и персональные предпочтения.' },
  { id: 'minimal_history', title: 'Минимум данных', description: 'Один период и одна быстрая отметка.' },
];

function createPeriods(intervals: number[], firstDaysAgo: number): PeriodRecord[] {
  const starts: string[] = [];
  let cursor = toLocalDateString(addLocalDays(new Date(), -firstDaysAgo));
  starts.push(cursor);
  for (const interval of intervals) {
    cursor = toLocalDateString(addLocalDays(cursor, interval));
    starts.push(cursor);
  }
  return starts.map((startDate, index) => {
    const flowByDay: Record<string, FlowLevel> = {};
    ['medium', 'heavy', 'medium', 'light', 'light'].forEach((flow, day) => {
      flowByDay[toLocalDateString(addLocalDays(startDate, day))] = flow as FlowLevel;
    });
    return {
      id: `ux-${index}-${startDate}`,
      startDate,
      endDate: toLocalDateString(addLocalDays(startDate, 4)),
      confirmed: true,
      source: 'demo',
      flowByDay,
      createdAt: `${startDate}T12:00:00.000Z`,
      updatedAt: `${startDate}T12:00:00.000Z`,
    };
  });
}

function resetPersonaData(): void {
  useCycleStore.getState().replacePeriodRecords([]);
  useCycleStore.setState({
    periodHistory: [],
    periodRecords: [],
    deletedPeriodRecords: [],
    migrationReviewRequired: false,
    predictionSnapshots: [],
    predictionEvaluations: [],
  });
  useWellnessStore.setState({ dailyLogs: {}, deletedLogs: [] });
  useBoxStore.setState({ isSubscribed: false, subscription: null, orders: [], feedback: [], paused: false });
  useEngagementStore.getState().resetCalmEngagement();
}

function addDemoLogs(count: number): void {
  const logs = { ...useWellnessStore.getState().dailyLogs };
  for (let offset = 0; offset < count; offset += 1) {
    const date = toLocalDateString(addLocalDays(new Date(), -offset));
    logs[date] = {
      date,
      mood: offset % 3 === 0 ? 'tired' : offset % 2 === 0 ? 'calm' : 'happy',
      symptoms: offset % 3 === 0 ? ['fatigue'] : [],
      energy: offset % 3 === 0 ? 2 : 4,
      water: 5,
      sleep: 7,
      notes: '',
      flow: null,
      painLevel: offset % 4 === 0 ? 3 : null,
      productsUsed: null,
      nightLeak: false,
      basalTemperature: null,
      cervicalMucus: null,
      lhTest: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
  }
  useWellnessStore.setState({ dailyLogs: logs, deletedLogs: [] });
}

export function applyUxTestPersona(personaId: UxTestPersonaId): void {
  resetPersonaData();
  useUserStore.setState({ isOnboarded: true, isDemoMode: true, communicationStyle: 'warm', name: 'Ани' });

  if (personaId === 'box_user') {
    seedDemoData();
    return;
  }

  if (personaId === 'new_user') {
    useCycleStore.setState({ avgCycleLength: 28, avgPeriodLength: 5 });
    return;
  }

  if (personaId === 'minimal_history') {
    const records = createPeriods([], 12);
    useCycleStore.getState().replacePeriodRecords(records);
    addDemoLogs(1);
    return;
  }

  if (personaId === 'regular_cycle') {
    const records = createPeriods([28, 29, 28, 28, 29], 142);
    useCycleStore.getState().replacePeriodRecords(records);
    useCycleStore.setState({ avgCycleLength: 28, avgPeriodLength: 5 });
    addDemoLogs(7);
    return;
  }

  const records = createPeriods([24, 35, 27, 39, 25], 150);
  useCycleStore.getState().replacePeriodRecords(records);
  useCycleStore.setState({ avgCycleLength: 30, avgPeriodLength: 5 });
  addDemoLogs(5);
}
