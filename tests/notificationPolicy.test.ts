import { capNotificationCandidates, moveDateOutsideQuietHours } from '../src/services/notificationPolicy';

function candidate(key: string, category: 'cycle' | 'checkin' | 'box' | 'lunar', hour: number, priority: number) {
  return { key, category, date: new Date(2026, 6, 5, hour, 0), priority };
}

describe('notification policy', () => {
  test('limits notifications to two per day and one per category', () => {
    const result = capNotificationCandidates([
      candidate('diary-1', 'checkin', 9, 20),
      candidate('diary-2', 'checkin', 10, 90),
      candidate('box', 'box', 11, 100),
      candidate('cycle', 'cycle', 12, 80),
    ]);
    expect(result).toHaveLength(2);
    expect(new Set(result.map((item) => item.category)).size).toBe(2);
  });

  test('moves a late notification to the end of quiet hours', () => {
    const original = new Date(2026, 6, 5, 23, 0);
    const moved = moveDateOutsideQuietHours(original, '21:30', '08:00', true);
    expect(moved.getDate()).toBe(6);
    expect(moved.getHours()).toBe(8);
  });

  test('leaves daytime notification unchanged', () => {
    const original = new Date(2026, 6, 5, 12, 0);
    const moved = moveDateOutsideQuietHours(original, '21:30', '08:00', true);
    expect(moved.getTime()).toBe(original.getTime());
  });
});
