import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type ProviderPaymentStatus =
  | 'payment_created'
  | 'payment_requires_action'
  | 'payment_processing'
  | 'payment_authorized'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_cancelled'
  | 'payment_refunded'
  | 'payment_partially_refunded'
  | 'payment_disputed';

export type ProviderPaymentMethod = {
  id: string;
  type: 'sandbox_card' | 'tokenized_card';
  brand: string;
  last4: string;
  expiresMonth: number;
  expiresYear: number;
  demo: boolean;
};

export type ProviderIntentResult = {
  providerIntentId: string;
  status: ProviderPaymentStatus;
  clientSecret: string | null;
  requiresActionUrl?: string | null;
  demo: boolean;
};

export type ProviderRefundResult = {
  providerRefundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountMinor: number;
  demo: boolean;
};

export class PaymentProviderError extends Error {
  constructor(public code: string, message: string, public recoverable = false) {
    super(message);
  }
}

export interface ServerPaymentProvider {
  readonly name: string;
  readonly demo: boolean;
  listPaymentMethods(): Promise<ProviderPaymentMethod[]>;
  createIntent(input: { orderId: string; amountMinor: number; currency: string; idempotencyKey: string }): Promise<ProviderIntentResult>;
  confirmIntent(input: { providerIntentId: string; paymentMethodId: string }): Promise<ProviderIntentResult>;
  refund(input: { providerIntentId: string; amountMinor: number; reason?: string }): Promise<ProviderRefundResult>;
  verifyWebhook(rawBody: string, signature: string): boolean;
}

class SandboxServerPaymentProvider implements ServerPaymentProvider {
  readonly name = 'sandbox';
  readonly demo = true;

  async listPaymentMethods(): Promise<ProviderPaymentMethod[]> {
    return [{
      id: 'sandbox-card-4242',
      type: 'sandbox_card',
      brand: 'LOUSA Test Card',
      last4: '4242',
      expiresMonth: 12,
      expiresYear: 2030,
      demo: true,
    }];
  }

  async createIntent(input: { amountMinor: number }): Promise<ProviderIntentResult> {
    if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
      throw new PaymentProviderError('PAYMENT_AMOUNT_INVALID', 'Payment amount must be greater than zero.');
    }
    const providerIntentId = `sandbox_${randomUUID()}`;
    return {
      providerIntentId,
      status: 'payment_requires_action',
      clientSecret: `sandbox_secret_${providerIntentId}`,
      demo: true,
    };
  }

  async confirmIntent(input: { providerIntentId: string; paymentMethodId: string }): Promise<ProviderIntentResult> {
    if (input.paymentMethodId !== 'sandbox-card-4242') {
      throw new PaymentProviderError('PAYMENT_METHOD_NOT_FOUND', 'Sandbox payment method was not found.');
    }
    return {
      providerIntentId: input.providerIntentId,
      status: 'payment_succeeded',
      clientSecret: null,
      demo: true,
    };
  }

  async refund(input: { amountMinor: number }): Promise<ProviderRefundResult> {
    if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
      throw new PaymentProviderError('REFUND_AMOUNT_INVALID', 'Refund amount must be greater than zero.');
    }
    return {
      providerRefundId: `sandbox_refund_${randomUUID()}`,
      status: 'succeeded',
      amountMinor: Math.round(input.amountMinor),
      demo: true,
    };
  }

  verifyWebhook(_rawBody: string, signature: string) {
    return signature === 'sandbox-test-signature';
  }
}

class ExternalProviderBoundary implements ServerPaymentProvider {
  readonly demo = false;

  constructor(public readonly name: string, private readonly webhookSecret: string | null) {}

  private unavailable(): never {
    throw new PaymentProviderError(
      'PAYMENT_PROVIDER_IMPLEMENTATION_MISSING',
      `Payment provider ${this.name} is configured but its production adapter is not installed.`,
    );
  }

  async listPaymentMethods(): Promise<ProviderPaymentMethod[]> { return this.unavailable(); }
  async createIntent(): Promise<ProviderIntentResult> { return this.unavailable(); }
  async confirmIntent(): Promise<ProviderIntentResult> { return this.unavailable(); }
  async refund(): Promise<ProviderRefundResult> { return this.unavailable(); }

  verifyWebhook(rawBody: string, signature: string) {
    if (!this.webhookSecret || !signature) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const actual = signature.replace(/^sha256=/i, '').trim();
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  }
}

export function createServerPaymentProvider(input: { provider: string; appEnv: string; webhookSecret: string | null }): ServerPaymentProvider {
  if (input.provider === 'sandbox') {
    if (input.appEnv === 'production') {
      throw new PaymentProviderError(
        'SANDBOX_PAYMENT_FORBIDDEN_IN_PRODUCTION',
        'PAYMENT_PROVIDER=sandbox is forbidden when APP_ENV=production.',
      );
    }
    return new SandboxServerPaymentProvider();
  }
  return new ExternalProviderBoundary(input.provider, input.webhookSecret);
}
