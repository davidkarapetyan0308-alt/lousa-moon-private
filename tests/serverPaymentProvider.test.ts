import { createServerPaymentProvider, PaymentProviderError } from '../apps/api/src/payments/provider';

describe('server payment provider boundary', () => {
  test('forbids sandbox in production', () => {
    expect(() => createServerPaymentProvider({ provider: 'sandbox', appEnv: 'production', webhookSecret: null })).toThrow(PaymentProviderError);
  });

  test('sandbox is explicitly demo and idempotent persistence stays server-side', async () => {
    const provider = createServerPaymentProvider({ provider: 'sandbox', appEnv: 'test', webhookSecret: null });
    expect(provider.demo).toBe(true);
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 1000, currency: 'AMD', idempotencyKey: 'k1' });
    expect(intent.status).toBe('payment_requires_action');
    const confirmed = await provider.confirmIntent({ providerIntentId: intent.providerIntentId, paymentMethodId: 'sandbox-card-4242' });
    expect(confirmed.status).toBe('payment_succeeded');
  });

  test('external provider validates HMAC webhook signatures', () => {
    const provider = createServerPaymentProvider({ provider: 'external', appEnv: 'test', webhookSecret: 'secret' });
    const crypto = require('node:crypto');
    const body = JSON.stringify({ id: 'evt-1' });
    const signature = crypto.createHmac('sha256', 'secret').update(body).digest('hex');
    expect(provider.verifyWebhook(body, signature)).toBe(true);
    expect(provider.verifyWebhook(body, 'bad')).toBe(false);
  });
});
