/**
 * LOUSA MOON — deterministic astronomical phase approximation.
 * This is a visual astronomy feature. It is never used to infer health,
 * mood, fertility, or menstrual-cycle outcomes.
 */

export const SYNODIC_MONTH_DAYS = 29.53058770576;
export const KNOWN_NEW_MOON_UTC = '2000-01-06T18:14:00Z';
const KNOWN_NEW_MOON_MS = new Date(KNOWN_NEW_MOON_UTC).getTime();

export type MoonPhaseName =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

export type SupportedLanguage = 'ru' | 'en' | 'hy';

const PHASES: MoonPhaseName[] = [
  'new_moon',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full_moon',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent',
];

const PHASE_LABELS: Record<SupportedLanguage, Record<MoonPhaseName, string>> = {
  ru: {
    new_moon: 'Новолуние',
    waxing_crescent: 'Растущий серп',
    first_quarter: 'Первая четверть',
    waxing_gibbous: 'Растущая выпуклая Луна',
    full_moon: 'Полнолуние',
    waning_gibbous: 'Убывающая выпуклая Луна',
    last_quarter: 'Последняя четверть',
    waning_crescent: 'Убывающий серп',
  },
  en: {
    new_moon: 'New Moon',
    waxing_crescent: 'Waxing Crescent',
    first_quarter: 'First Quarter',
    waxing_gibbous: 'Waxing Gibbous',
    full_moon: 'Full Moon',
    waning_gibbous: 'Waning Gibbous',
    last_quarter: 'Last Quarter',
    waning_crescent: 'Waning Crescent',
  },
  hy: {
    new_moon: 'Նորալուսին',
    waxing_crescent: 'Աճող մահիկ',
    first_quarter: 'Առաջին քառորդ',
    waxing_gibbous: 'Աճող ուռուցիկ լուսին',
    full_moon: 'Լիալուսին',
    waning_gibbous: 'Նվազող ուռուցիկ լուսին',
    last_quarter: 'Վերջին քառորդ',
    waning_crescent: 'Նվազող մահիկ',
  },
};

const PHASE_EMOJI: Record<MoonPhaseName, string> = {
  new_moon: '🌑',
  waxing_crescent: '🌒',
  first_quarter: '🌓',
  waxing_gibbous: '🌔',
  full_moon: '🌕',
  waning_gibbous: '🌖',
  last_quarter: '🌗',
  waning_crescent: '🌘',
};

export function getMoonPhaseLabel(phase: MoonPhaseName, language: SupportedLanguage = 'ru'): string {
  return PHASE_LABELS[language]?.[phase] || PHASE_LABELS.en[phase];
}

export interface MoonPhaseData {
  phase: MoonPhaseName;
  label: string;
  emoji: string;
  illumination: number;
  age: number;
  daysUntilFull: number;
  daysUntilNew: number;
  isWaxing: boolean;
  description: string;
  emotionalState: string;
  advice: string;
}

function validTimestamp(date: Date) {
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

/**
 * Calculate an approximate moon phase for a given instant.
 * Phase classification uses the nearest of eight standard phase points,
 * while illumination remains continuous from 0 to 1.
 */
export function getMoonPhase(date: Date = new Date()): MoonPhaseData {
  const diffDays = (validTimestamp(date) - KNOWN_NEW_MOON_MS) / 86_400_000;
  const age = ((diffDays % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const normalized = age / SYNODIC_MONTH_DAYS;
  const phaseIndex = Math.round(normalized * 8) % 8;
  const phase = PHASES[phaseIndex];
  const phaseAngle = normalized * 2 * Math.PI;
  const illumination = (1 - Math.cos(phaseAngle)) / 2;
  const fullMoonAge = SYNODIC_MONTH_DAYS / 2;
  const daysUntilFull = age <= fullMoonAge
    ? fullMoonAge - age
    : SYNODIC_MONTH_DAYS - age + fullMoonAge;
  const rawDaysUntilNew = SYNODIC_MONTH_DAYS - age;
  const daysUntilNew = rawDaysUntilNew > SYNODIC_MONTH_DAYS - 0.02 ? 0 : rawDaysUntilNew;
  const isWaxing = age > 0 && age < fullMoonAge;

  return {
    phase,
    label: PHASE_LABELS.en[phase],
    emoji: PHASE_EMOJI[phase],
    illumination: Math.round(illumination * 1000) / 1000,
    age: Math.round(age * 10) / 10,
    daysUntilFull: Math.round(daysUntilFull * 10) / 10,
    daysUntilNew: Math.round(daysUntilNew * 10) / 10,
    isWaxing,
    description: `${Math.round(illumination * 100)}% of the lunar disk is illuminated in this approximation.`,
    emotionalState: 'No emotional, medical, or fertility meaning is inferred from the Moon phase.',
    advice: 'Use this as a visual astronomical rhythm only.',
  };
}

/** Approximate moonrise/moonset display. Not used for medical or delivery logic. */
export function getMoonTimes(date: Date = new Date()): { rise: string; set: string } {
  const { age } = getMoonPhase(date);
  const riseHour = (18 + (age * 50 / 60)) % 24;
  const setHour = (riseHour + 12) % 24;
  const formatTime = (value: number) => {
    const hours = Math.floor(value);
    const minutes = Math.floor((value - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };
  return { rise: formatTime(riseHour), set: formatTime(setHour) };
}

export function getMonthPhases(year: number, month: number): MoonPhaseData[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => getMoonPhase(new Date(year, month, index + 1)));
}
