import { addLocalDays, toLocalDateString } from '../src/utils/date';
import { BoxPreferences, PeriodRecord } from '../src/domain/models';

export function period(startDate: string, endDate?: string | null, flow: PeriodRecord['flowByDay'] = {}): PeriodRecord {
  return {
    id: `period-${startDate}`,
    startDate,
    endDate: endDate ?? toLocalDateString(addLocalDays(startDate, 4)),
    confirmed: true,
    source: 'user',
    flowByDay: flow,
    createdAt: `${startDate}T12:00:00.000Z`,
    updatedAt: `${startDate}T12:00:00.000Z`,
  };
}

export function periodsFromIntervals(firstStart: string, intervals: number[]): PeriodRecord[] {
  const records = [period(firstStart)];
  let cursor = firstStart;
  for (const interval of intervals) {
    cursor = toLocalDateString(addLocalDays(cursor, interval));
    records.push(period(cursor));
  }
  return records;
}

export const basePreferences: BoxPreferences = {
  menstrualProducts: ['pads'],
  primaryProduct: 'pads',
  dailyQuantityEstimate: 5,
  periodLengthEstimate: 5,
  flowProfile: ['medium'],
  nightProtection: false,
  applicatorPreference: 'no_preference',
  wingPreference: 'wings',
  reusableProducts: false,
  skinSensitivity: false,
  fragranceFree: true,
  foodAllergies: [],
  cosmeticAllergies: [],
  dislikedItems: [],
  heatPadPreference: 'no_preference',
  teaPreference: 'herbal',
  chocolatePreference: 'dark',
};
