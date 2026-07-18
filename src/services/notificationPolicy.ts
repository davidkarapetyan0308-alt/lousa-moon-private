import { toLocalDateString } from '../utils/date';

export type NotificationPolicyCategory = 'cycle' | 'checkin' | 'box' | 'lunar' | 'system';

export interface NotificationPolicyCandidate {
  key: string;
  category: NotificationPolicyCategory;
  date: Date;
  priority: number;
}

/**
 * Keep notification delivery calm: at most two notifications per local day
 * and at most one notification from each category per local day.
 */
export function capNotificationCandidates<T extends NotificationPolicyCandidate>(candidates: T[]): T[] {
  const sorted = [...candidates].sort((a, b) => a.date.getTime() - b.date.getTime() || b.priority - a.priority);
  const perDay = new Map<string, number>();
  const categoryDay = new Set<string>();
  const result: T[] = [];

  for (const item of sorted) {
    const day = toLocalDateString(item.date);
    const count = perDay.get(day) || 0;
    const categoryKey = `${day}:${item.category}`;
    if (count >= 2 || categoryDay.has(categoryKey)) continue;
    perDay.set(day, count + 1);
    categoryDay.add(categoryKey);
    result.push(item);
  }
  return result;
}

export function parseClock(value: string, fallbackHour = 19): { hour: number; minute: number } {
  const [rawHour, rawMinute] = value.split(':').map(Number);
  return {
    hour: Number.isFinite(rawHour) ? Math.max(0, Math.min(23, rawHour)) : fallbackHour,
    minute: Number.isFinite(rawMinute) ? Math.max(0, Math.min(59, rawMinute)) : 0,
  };
}

export function moveDateOutsideQuietHours(date: Date, start: string, end: string, enabled: boolean): Date {
  if (!enabled) return new Date(date);
  const startClock = parseClock(start, 21);
  const endClock = parseClock(end, 8);
  const startMinutes = startClock.hour * 60 + startClock.minute;
  const endMinutes = endClock.hour * 60 + endClock.minute;
  const valueMinutes = date.getHours() * 60 + date.getMinutes();
  const overnight = startMinutes > endMinutes;
  const isQuiet = overnight
    ? valueMinutes >= startMinutes || valueMinutes < endMinutes
    : valueMinutes >= startMinutes && valueMinutes < endMinutes;
  if (!isQuiet) return new Date(date);

  const result = new Date(date);
  if (overnight && valueMinutes >= startMinutes) result.setDate(result.getDate() + 1);
  result.setHours(endClock.hour, endClock.minute, 0, 0);
  return result;
}
