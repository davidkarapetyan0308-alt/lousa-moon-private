import {
  buildDailyInsight,
  buildImmediateCheckInResponse,
  buildLatestCycleStory,
  buildWeeklySummary,
  calculateGentleProgress,
  selectProgressiveProfilePrompt,
  selectTodayPriority,
  shouldShowContextualBox,
} from '../src/services/engagement';
import type { BoxOrder, CyclePrediction, InsightFeedback } from '../src/domain/models';
import type { DailyLog } from '../src/store';
import { period } from './helpers';

const prediction: CyclePrediction = {
  mostLikelyStart: '2026-07-10',
  earliestStart: '2026-07-09',
  latestStart: '2026-07-11',
  medianCycleLength: 28,
  weightedCycleLength: 28,
  averagePeriodLength: 5,
  variabilityDays: 2,
  completedCyclesCount: 4,
  confirmedPeriodsCount: 5,
  confidence: 'medium',
  reasons: [],
  lastConfirmedStart: '2026-06-12',
  dataQualityScore: 75,
};

function log(date: string, patch: Partial<DailyLog> = {}): DailyLog {
  return {
    date,
    mood: null,
    symptoms: [],
    energy: 3,
    water: 0,
    sleep: 7,
    notes: '',
    flow: null,
    painLevel: null,
    productsUsed: null,
    nightLeak: false,
    basalTemperature: null,
    cervicalMucus: null,
    lhTest: null,
    ...patch,
  };
}

function order(patch: Partial<BoxOrder> = {}): BoxOrder {
  return {
    id: 'order-1',
    subscriptionId: 'sub-1',
    cyclePredictionSnapshot: prediction,
    plannedDeliveryDate: '2026-07-05',
    deliveryRange: { earliest: '2026-07-05', latest: '2026-07-05' },
    preparationDeadline: '2026-07-03',
    customizationDeadline: '2026-07-02',
    status: 'scheduled',
    items: [],
    statusHistory: [],
    demo: true,
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
    ...patch,
  };
}

describe('LOUSA Calm engagement', () => {
  test('migration review is always the highest priority', () => {
    const result = selectTodayPriority({
      language: 'ru', today: '2026-07-05', migrationReviewRequired: true,
      prediction, todayLog: log('2026-07-05'), isOnboarded: true,
      confirmedPeriods: 6, orders: [order({ status: 'out_for_delivery' })],
    });
    expect(result.type).toBe('review_legacy_data');
    expect(result.priority).toBe(100);
  });

  test('delivery today outranks a quick check-in', () => {
    const result = selectTodayPriority({
      language: 'en', today: '2026-07-05', migrationReviewRequired: false,
      prediction, todayLog: log('2026-07-05'), isOnboarded: true,
      confirmedPeriods: 6, orders: [order({ status: 'out_for_delivery' })],
    });
    expect(result.type).toBe('delivery_today');
  });

  test('box deadline is shown only in the final two days', () => {
    const result = selectTodayPriority({
      language: 'ru', today: '2026-07-05', migrationReviewRequired: false,
      prediction, todayLog: log('2026-07-05', { mood: 'calm' }), isOnboarded: true,
      confirmedPeriods: 6,
      orders: [order({ customizationDeadline: '2026-07-07', plannedDeliveryDate: '2026-07-12', status: 'customization_open' })],
    });
    expect(result.type).toBe('box_deadline');
  });

  test('a completed check-in removes the routine daily priority', () => {
    const result = selectTodayPriority({
      language: 'ru', today: '2026-07-05', migrationReviewRequired: false,
      prediction: { ...prediction, earliestStart: '2026-07-10', latestStart: '2026-07-12' },
      todayLog: log('2026-07-05', { mood: 'happy' }), isOnboarded: true,
      confirmedPeriods: 4, orders: [],
    });
    expect(result.type).toBe('none');
  });

  test('feedback priority ignores delivered orders that already have feedback', () => {
    const delivered = order({ status: 'delivered', plannedDeliveryDate: '2026-07-01' });
    const result = selectTodayPriority({
      language: 'ru', today: '2026-07-05', migrationReviewRequired: false,
      prediction: { ...prediction, earliestStart: '2026-07-10', latestStart: '2026-07-12' },
      todayLog: log('2026-07-05', { mood: 'calm' }), isOnboarded: true,
      confirmedPeriods: 4, orders: [delivered], feedbackOrderIds: [delivered.id],
    });
    expect(result.type).toBe('none');
  });

  test('repeated low energy creates a gentle pace insight', () => {
    const logs = Object.fromEntries(['2026-07-01', '2026-07-02', '2026-07-03'].map((date) => [date, log(date, { energy: 1 })]));
    expect(buildDailyInsight({ language: 'en', logs, today: '2026-07-05' }).id).toBe('energy-gentle-pace');
  });

  test('not relevant feedback prevents the same insight from repeating', () => {
    const logs = Object.fromEntries(['2026-07-01', '2026-07-02', '2026-07-03'].map((date) => [date, log(date, { energy: 1 })]));
    const feedback: InsightFeedback[] = [{
      id: 'f1', insightId: 'energy-gentle-pace', date: '2026-07-04',
      response: 'not_relevant', createdAt: '2026-07-04T12:00:00.000Z',
    }];
    expect(buildDailyInsight({ language: 'en', logs, feedback, today: '2026-07-05' }).id).not.toBe('energy-gentle-pace');
  });

  test('brief communication returns a short acknowledgement', () => {
    const response = buildImmediateCheckInResponse({ language: 'ru', mood: 'calm', logs: {}, today: '2026-07-05', communicationStyle: 'brief' });
    expect(response).toBe('Записано.');
  });

  test('warm communication is warmer when there is no established pattern', () => {
    const response = buildImmediateCheckInResponse({ language: 'en', mood: 'calm', logs: {}, today: '2026-07-05', communicationStyle: 'warm' });
    expect(response).toContain('Thank you');
  });

  test('two previous matching moods produce an explainable pattern', () => {
    const logs = {
      a: log('2026-07-01', { mood: 'anxious' }),
      b: log('2026-07-03', { mood: 'anxious' }),
    };
    const response = buildImmediateCheckInResponse({ language: 'ru', mood: 'anxious', logs, today: '2026-07-05', communicationStyle: 'neutral' });
    expect(response).toContain('раньше чаще отмечала');
  });

  test('gentle progress counts unique care days and never uses a streak', () => {
    const progress = calculateGentleProgress({
      today: '2026-07-05',
      logs: {
        a: log('2026-07-01', { mood: 'calm' }),
        b: log('2026-07-03', { notes: 'test' }),
      },
      periods: [period('2026-05-01'), period('2026-05-29')],
      feedback: [],
    });
    expect(progress.careDaysThisMonth).toBe(2);
    expect(progress.confirmedCycles).toBe(2);
    expect(progress).not.toHaveProperty('streak');
  });

  test('weekly summary waits for at least two meaningful logs', () => {
    expect(buildWeeklySummary({ language: 'ru', today: '2026-07-05', logs: { a: log('2026-07-04', { mood: 'calm' }) } })).toBeNull();
  });

  test('weekly summary summarizes user entries without diagnosis', () => {
    const summary = buildWeeklySummary({ language: 'ru', today: '2026-07-05', logs: {
      a: log('2026-07-03', { mood: 'calm', energy: 2 }),
      b: log('2026-07-04', { mood: 'calm', energy: 4 }),
    } });
    expect(summary?.loggedDays).toBe(2);
    expect(summary?.averageEnergy).toBe(3);
    expect(summary?.observation).toContain('чаще встречалось');
  });

  test('cycle story requires two confirmed cycles', () => {
    expect(buildLatestCycleStory({ language: 'ru', periods: [period('2026-06-01')], logs: {} })).toBeNull();
  });

  test('cycle story contains a human-readable date range', () => {
    const story = buildLatestCycleStory({
      language: 'ru', periods: [period('2026-05-01'), period('2026-05-29')], logs: {},
    });
    expect(story).not.toBeNull();
    expect(story?.dateRange).not.toContain('2026-');
    expect(story?.highlights).toHaveLength(3);
  });

  test('progressive prompt is suppressed for seven days', () => {
    const prompt = selectProgressiveProfilePrompt({
      language: 'ru', periods: [period('2026-06-01')], periodLengthKnown: false,
      today: '2026-07-05', lastPromptAt: '2026-07-01T12:00:00.000Z',
    });
    expect(prompt).toBeNull();
  });

  test('progressive prompt asks for history when fewer than three periods exist', () => {
    const prompt = selectProgressiveProfilePrompt({
      language: 'en', periods: [period('2026-06-01')], periodLengthKnown: true,
      today: '2026-07-10', lastPromptAt: null,
    });
    expect(prompt?.id).toBe('add-period-history');
  });

  test('contextual box is hidden when nothing is time-sensitive', () => {
    expect(shouldShowContextualBox({ order: order({ plannedDeliveryDate: '2026-08-01', customizationDeadline: '2026-07-20' }), hasFeedback: false, today: '2026-07-05' })).toBe(false);
  });

  test('contextual box appears for delivery and feedback moments', () => {
    expect(shouldShowContextualBox({ order: order({ status: 'out_for_delivery' }), hasFeedback: false, today: '2026-07-05' })).toBe(true);
    expect(shouldShowContextualBox({ order: order({ status: 'delivered' }), hasFeedback: false, today: '2026-07-05' })).toBe(true);
    expect(shouldShowContextualBox({ order: order({ status: 'delivered' }), hasFeedback: true, today: '2026-07-05' })).toBe(false);
  });
});
