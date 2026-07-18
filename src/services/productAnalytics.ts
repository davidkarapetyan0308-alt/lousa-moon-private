/**
 * Privacy-preserving product analytics boundary.
 *
 * Only event names and a tiny allow-listed set of non-sensitive dimensions may
 * leave the app. Cycle dates, symptoms, notes, pain, addresses and box contents
 * are intentionally rejected here, even if a caller passes them by mistake.
 */
export type ProductAnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'first_prediction_viewed'
  | 'quick_checkin_completed'
  | 'detailed_log_opened'
  | 'insight_viewed'
  | 'insight_feedback_submitted'
  | 'weekly_summary_opened'
  | 'cycle_story_opened'
  | 'period_confirmed'
  | 'box_customization_opened'
  | 'box_feedback_completed'
  | 'notification_category_changed';

export type SafeAnalyticsValue = string | number | boolean | null;
export type SafeAnalyticsPayload = Record<string, SafeAnalyticsValue>;

const ALLOWED_PAYLOAD_KEYS = new Set([
  'language',
  'source',
  'screen',
  'response',
  'category',
  'style',
  'step',
  'completed',
  'has_history',
  'has_prediction',
  'confidence_band',
  'entry_mode',
  'demo',
]);

const FORBIDDEN_KEY_PARTS = [
  'date', 'period', 'cycle_start', 'symptom', 'pain', 'note', 'address',
  'phone', 'email', 'flow', 'temperature', 'mucus', 'lh', 'product', 'item',
  'allergy', 'medication', 'location', 'name',
];

export interface ProductAnalyticsRecord {
  event: ProductAnalyticsEvent;
  payload: SafeAnalyticsPayload;
  createdAt: string;
}

export type ProductAnalyticsSink = (record: ProductAnalyticsRecord) => void | Promise<void>;

let sink: ProductAnalyticsSink | null = null;

export function setProductAnalyticsSink(nextSink: ProductAnalyticsSink | null): void {
  sink = nextSink;
}

export function sanitizeAnalyticsPayload(payload: Record<string, unknown> = {}): SafeAnalyticsPayload {
  const safe: SafeAnalyticsPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    const lower = key.toLowerCase();
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) continue;
    if (FORBIDDEN_KEY_PARTS.some((part) => lower.includes(part))) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      safe[key] = value as SafeAnalyticsValue;
    }
  }
  return safe;
}

export async function trackProductEvent(
  event: ProductAnalyticsEvent,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!sink) return;
  await sink({ event, payload: sanitizeAnalyticsPayload(payload), createdAt: new Date().toISOString() });
}
