import { OperationAbortedError, OperationTimeoutError, withTimeout } from '../src/shared/network/withTimeout';

describe('withTimeout', () => {
  it('returns a completed operation', async () => {
    await expect(withTimeout(async () => 'ok', { timeoutMs: 100, stage: 'test' })).resolves.toBe('ok');
  });

  it('rejects even when an SDK promise ignores AbortSignal', async () => {
    const neverSettles = new Promise<string>(() => undefined);
    await expect(withTimeout(() => neverSettles, { timeoutMs: 10, stage: 'native-sdk' }))
      .rejects.toBeInstanceOf(OperationTimeoutError);
  });

  it('propagates parent cancellation even when operation ignores AbortSignal', async () => {
    const controller = new AbortController();
    const operation = withTimeout(
      () => new Promise<string>(() => undefined),
      { timeoutMs: 1_000, stage: 'cancelled-stage', signal: controller.signal },
    );
    controller.abort();
    await expect(operation).rejects.toBeInstanceOf(OperationAbortedError);
  });
});
