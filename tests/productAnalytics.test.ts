import {
  sanitizeAnalyticsPayload,
  setProductAnalyticsSink,
  trackProductEvent,
} from '../src/services/productAnalytics';

describe('privacy-preserving product analytics', () => {
  afterEach(() => setProductAnalyticsSink(null));

  test('keeps only allow-listed non-sensitive dimensions', () => {
    expect(sanitizeAnalyticsPayload({
      language: 'ru',
      response: 'helpful',
      pain: 8,
      period_date: '2026-07-05',
      notes: 'private',
      unknown: 'discard me',
    })).toEqual({ language: 'ru', response: 'helpful' });
  });

  test('does not throw or store anything when no sink is configured', async () => {
    await expect(trackProductEvent('quick_checkin_completed', { language: 'ru' })).resolves.toBeUndefined();
  });

  test('sends a sanitized event to the configured sink', async () => {
    const records: unknown[] = [];
    setProductAnalyticsSink((record) => { records.push(record); });
    await trackProductEvent('insight_feedback_submitted', {
      language: 'en', response: 'helpful', symptom: 'fatigue', address: 'private',
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ event: 'insight_feedback_submitted', payload: { language: 'en', response: 'helpful' } });
  });
});
