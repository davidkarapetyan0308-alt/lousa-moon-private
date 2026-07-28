export type PaymentIntentStatus =
  | 'created'
  | 'requires_action'
  | 'processing'
  | 'authorized'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed';

export interface PaymentMethod {
  id: string;
  type: 'sandbox_card' | 'tokenized_card';
  brand: string;
  last4: string;
  expiresMonth: number;
  expiresYear: number;
  demo: boolean;
}

export interface PaymentIntent {
  id: string;
  orderId: string;
  amountMinor: number;
  currency: 'AMD';
  status: PaymentIntentStatus;
  idempotencyKey: string;
  paymentMethodId?: string | null;
  requiresActionUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  demo: boolean;
}

export interface Refund {
  id: string;
  paymentIntentId: string;
  amountMinor: number;
  status: 'pending' | 'succeeded' | 'failed';
  reason?: string;
  createdAt: string;
  demo: boolean;
}

export interface PaymentProvider {
  listPaymentMethods(): Promise<PaymentMethod[]>;
  createIntent(input: { orderId: string; amountMinor: number; currency: 'AMD'; idempotencyKey: string }): Promise<PaymentIntent>;
  confirmIntent(intentId: string, paymentMethodId: string): Promise<PaymentIntent>;
  getIntent(intentId: string): Promise<PaymentIntent | null>;
  refund(input: { intentId: string; amountMinor?: number; reason?: string }): Promise<Refund>;
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export class SandboxPaymentProvider implements PaymentProvider {
  private methods: PaymentMethod[] = [{
    id: 'sandbox-card-4242',
    type: 'sandbox_card',
    brand: 'LOUSA Test Card',
    last4: '4242',
    expiresMonth: 12,
    expiresYear: 2030,
    demo: true,
  }];

  private intents = new Map<string, PaymentIntent>();
  private idempotency = new Map<string, string>();

  async listPaymentMethods() {
    return [...this.methods];
  }

  async createIntent(input: { orderId: string; amountMinor: number; currency: 'AMD'; idempotencyKey: string }) {
    const existingId = this.idempotency.get(input.idempotencyKey);
    if (existingId) return this.intents.get(existingId)!;
    if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) throw new Error('PAYMENT_AMOUNT_INVALID');
    const now = new Date().toISOString();
    const intent: PaymentIntent = {
      id: makeId('sandbox-intent'),
      orderId: input.orderId,
      amountMinor: Math.round(input.amountMinor),
      currency: input.currency,
      status: 'created',
      idempotencyKey: input.idempotencyKey,
      paymentMethodId: null,
      requiresActionUrl: null,
      createdAt: now,
      updatedAt: now,
      demo: true,
    };
    this.intents.set(intent.id, intent);
    this.idempotency.set(input.idempotencyKey, intent.id);
    return intent;
  }

  async confirmIntent(intentId: string, paymentMethodId: string) {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error('PAYMENT_INTENT_NOT_FOUND');
    if (!this.methods.some((item) => item.id === paymentMethodId)) throw new Error('PAYMENT_METHOD_NOT_FOUND');
    if (intent.status === 'succeeded') return intent;
    const next: PaymentIntent = {
      ...intent,
      status: 'succeeded',
      paymentMethodId,
      updatedAt: new Date().toISOString(),
      demo: true,
    };
    this.intents.set(intentId, next);
    return next;
  }

  async getIntent(intentId: string) {
    return this.intents.get(intentId) || null;
  }

  async refund(input: { intentId: string; amountMinor?: number; reason?: string }) {
    const intent = this.intents.get(input.intentId);
    if (!intent) throw new Error('PAYMENT_INTENT_NOT_FOUND');
    if (intent.status !== 'succeeded' && intent.status !== 'refunded') throw new Error('PAYMENT_NOT_REFUNDABLE');
    const amountMinor = input.amountMinor ?? intent.amountMinor;
    if (amountMinor <= 0 || amountMinor > intent.amountMinor) throw new Error('REFUND_AMOUNT_INVALID');
    const refund: Refund = {
      id: makeId('sandbox-refund'),
      paymentIntentId: intent.id,
      amountMinor,
      status: 'succeeded',
      reason: input.reason,
      createdAt: new Date().toISOString(),
      demo: true,
    };
    this.intents.set(intent.id, { ...intent, status: amountMinor === intent.amountMinor ? 'refunded' : 'succeeded', updatedAt: new Date().toISOString() });
    return refund;
  }
}

export const sandboxPaymentProvider = new SandboxPaymentProvider();
