export class OperationTimeoutError extends Error {
  readonly code = 'OPERATION_TIMEOUT';

  constructor(
    public readonly stage: string,
    public readonly timeoutMs: number,
  ) {
    super(`${stage} exceeded ${timeoutMs}ms`);
    this.name = 'OperationTimeoutError';
  }
}

export class OperationAbortedError extends Error {
  readonly code = 'OPERATION_ABORTED';

  constructor(public readonly stage: string) {
    super(`${stage} was aborted`);
    this.name = 'OperationAbortedError';
  }
}

export type TimeoutOptions = {
  timeoutMs: number;
  stage: string;
  signal?: AbortSignal;
};

/**
 * Enforces a real upper bound even for native SDK promises that ignore AbortSignal.
 * The internal signal still cancels fetch/native operations that support it, while
 * Promise.race guarantees the caller is released at timeout.
 */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: TimeoutOptions,
): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let parentAbortHandler: (() => void) | null = null;

  const operationPromise = Promise.resolve().then(() => operation(controller.signal));
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new OperationTimeoutError(options.stage, options.timeoutMs);
      controller.abort();
      reject(error);
    }, options.timeoutMs);
  });

  const racers: Promise<T | never>[] = [operationPromise, timeoutPromise];
  if (options.signal) {
    racers.push(new Promise<never>((_resolve, reject) => {
      parentAbortHandler = () => {
        const error = new OperationAbortedError(options.stage);
        // React Native's AbortController typing intentionally supports no abort
        // reason. Keep cancellation portable across Android and Node/Jest.
        controller.abort();
        reject(error);
      };
      if (options.signal?.aborted) parentAbortHandler();
      else options.signal?.addEventListener('abort', parentAbortHandler, { once: true });
    }));
  }

  try {
    return await Promise.race(racers);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (options.signal && parentAbortHandler) {
      options.signal.removeEventListener('abort', parentAbortHandler);
    }
  }
}

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
