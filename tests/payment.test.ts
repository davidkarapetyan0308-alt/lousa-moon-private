import { SandboxPaymentProvider } from '../src/services/payment';

describe('SandboxPaymentProvider', () => {
  test('lists only clearly marked sandbox methods', async () => {
    const provider = new SandboxPaymentProvider();
    const methods = await provider.listPaymentMethods();
    expect(methods).toHaveLength(1);
    expect(methods[0].demo).toBe(true);
    expect(methods[0].type).toBe('sandbox_card');
  });

  test.each([0, -1, -500, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid amount %s', async (amountMinor) => {
    const provider = new SandboxPaymentProvider();
    await expect(provider.createIntent({ orderId: 'o1', amountMinor, currency: 'AMD', idempotencyKey: `bad-${amountMinor}` })).rejects.toThrow('PAYMENT_AMOUNT_INVALID');
  });

  test('creates a demo intent in AMD', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 14900, currency: 'AMD', idempotencyKey: 'key-1' });
    expect(intent.status).toBe('created');
    expect(intent.currency).toBe('AMD');
    expect(intent.demo).toBe(true);
  });

  test('rounds fractional minor amount', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 14900.7, currency: 'AMD', idempotencyKey: 'round' });
    expect(intent.amountMinor).toBe(14901);
  });

  test('idempotency returns the same intent', async () => {
    const provider = new SandboxPaymentProvider();
    const one = await provider.createIntent({ orderId: 'o1', amountMinor: 1000, currency: 'AMD', idempotencyKey: 'same' });
    const two = await provider.createIntent({ orderId: 'o2', amountMinor: 9999, currency: 'AMD', idempotencyKey: 'same' });
    expect(two.id).toBe(one.id);
    expect(two.amountMinor).toBe(1000);
  });

  test('confirms an intent with sandbox card', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 1000, currency: 'AMD', idempotencyKey: 'confirm' });
    const confirmed = await provider.confirmIntent(intent.id, 'sandbox-card-4242');
    expect(confirmed.status).toBe('succeeded');
    expect(confirmed.paymentMethodId).toBe('sandbox-card-4242');
  });

  test('confirmation is idempotent', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 1000, currency: 'AMD', idempotencyKey: 'confirm-twice' });
    const one = await provider.confirmIntent(intent.id, 'sandbox-card-4242');
    const two = await provider.confirmIntent(intent.id, 'sandbox-card-4242');
    expect(two).toEqual(one);
  });

  test('rejects missing intent', async () => {
    const provider = new SandboxPaymentProvider();
    await expect(provider.confirmIntent('missing', 'sandbox-card-4242')).rejects.toThrow('PAYMENT_INTENT_NOT_FOUND');
  });

  test('rejects missing method', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 1000, currency: 'AMD', idempotencyKey: 'bad-method' });
    await expect(provider.confirmIntent(intent.id, 'missing')).rejects.toThrow('PAYMENT_METHOD_NOT_FOUND');
  });

  test('returns intent by id', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 1000, currency: 'AMD', idempotencyKey: 'get' });
    await expect(provider.getIntent(intent.id)).resolves.toEqual(intent);
    await expect(provider.getIntent('none')).resolves.toBeNull();
  });

  test('full refund marks intent refunded', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 2000, currency: 'AMD', idempotencyKey: 'refund-full' });
    await provider.confirmIntent(intent.id, 'sandbox-card-4242');
    const refund = await provider.refund({ intentId: intent.id, reason: 'test' });
    expect(refund.amountMinor).toBe(2000);
    expect((await provider.getIntent(intent.id))?.status).toBe('refunded');
  });

  test('partial refund keeps payment succeeded', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 2000, currency: 'AMD', idempotencyKey: 'refund-part' });
    await provider.confirmIntent(intent.id, 'sandbox-card-4242');
    const refund = await provider.refund({ intentId: intent.id, amountMinor: 500 });
    expect(refund.amountMinor).toBe(500);
    expect((await provider.getIntent(intent.id))?.status).toBe('succeeded');
  });

  test.each([0, -1, 2001])('rejects invalid refund amount %s', async (amountMinor) => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 2000, currency: 'AMD', idempotencyKey: `refund-bad-${amountMinor}` });
    await provider.confirmIntent(intent.id, 'sandbox-card-4242');
    await expect(provider.refund({ intentId: intent.id, amountMinor })).rejects.toThrow('REFUND_AMOUNT_INVALID');
  });

  test('rejects refund before payment succeeds', async () => {
    const provider = new SandboxPaymentProvider();
    const intent = await provider.createIntent({ orderId: 'o1', amountMinor: 2000, currency: 'AMD', idempotencyKey: 'refund-before' });
    await expect(provider.refund({ intentId: intent.id })).rejects.toThrow('PAYMENT_NOT_REFUNDABLE');
  });
});
