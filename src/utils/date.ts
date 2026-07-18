/** Local-date helpers. Avoids UTC date shifts caused by toISOString(). */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromLocalDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, Math.max(0, month - 1), day, 12, 0, 0, 0);
}

export function addLocalDays(value: string | Date, days: number): Date {
  const date = typeof value === 'string' ? fromLocalDateString(value) : new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function differenceInLocalDays(later: Date, earlier: Date): number {
  const a = new Date(later.getFullYear(), later.getMonth(), later.getDate(), 12);
  const b = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate(), 12);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function formatHumanDate(value: string, locale: 'en' | 'ru' | 'hy' = 'ru'): string {
  const localeMap = { en: 'en-US', ru: 'ru-RU', hy: 'hy-AM' } as const;
  return fromLocalDateString(value).toLocaleDateString(localeMap[locale], {
    day: 'numeric',
    month: 'long',
  });
}
