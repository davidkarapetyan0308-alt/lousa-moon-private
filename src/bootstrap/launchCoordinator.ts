import * as SplashScreen from 'expo-splash-screen';

import { traceStartup } from './startupTrace';

let holdRequested = false;
let hidden = false;
let hidePromise: Promise<void> | null = null;

const HIDE_RETRY_DELAYS_MS = [0, 120, 320] as const;

function devLog(event: string, details?: string) {
  if (!__DEV__) return;
  const suffix = details ? ` ${details}` : '';
  console.log(`[LAUNCH] ${event} at=${Date.now()}${suffix}`);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Must be called at module scope before the first React render.
 * Holding the native splash prevents any blank React bootstrap frame from becoming visible.
 */
export function holdNativeSplashAtModuleLoad() {
  if (holdRequested) return;
  holdRequested = true;
  devLog('native_splash_hold_requested');
  traceStartup('NATIVE_SPLASH_HOLD_REQUESTED');
  void SplashScreen.preventAutoHideAsync()
    .then(() => { devLog('native_splash_held'); traceStartup('NATIVE_SPLASH_HELD'); })
    .catch((error: unknown) => {
      devLog('native_splash_hold_failed', error instanceof Error ? error.message : String(error));
    });
}

/**
 * Hides the native splash once. Concurrent callers share the same promise.
 * A failed async hide is retried; the final fallback uses the synchronous Expo API.
 * The hidden flag is set only after a hide call actually succeeds.
 */
export function hideNativeSplashOnce(reason: string): Promise<void> {
  if (hidden) return Promise.resolve();
  if (hidePromise) return hidePromise;

  hidePromise = (async () => {
    let lastError: unknown;
    for (let index = 0; index < HIDE_RETRY_DELAYS_MS.length; index += 1) {
      const delayMs = HIDE_RETRY_DELAYS_MS[index];
      if (delayMs > 0) await wait(delayMs);
      try {
        devLog('native_splash_hide_requested', `reason=${reason} attempt=${index + 1}`);
        traceStartup('NATIVE_SPLASH_HIDE_REQUESTED', `reason=${reason} attempt=${index + 1}`);
        await SplashScreen.hideAsync();
        hidden = true;
        devLog('native_splash_hidden', `reason=${reason} method=async attempt=${index + 1}`);
        traceStartup('NATIVE_SPLASH_HIDDEN', `reason=${reason}`);
        return;
      } catch (error: unknown) {
        lastError = error;
        devLog('native_splash_hide_retry', error instanceof Error ? error.message : String(error));
      }
    }

    try {
      SplashScreen.hide();
      hidden = true;
      devLog('native_splash_hidden', `reason=${reason} method=sync_fallback`);
      traceStartup('NATIVE_SPLASH_HIDDEN', `reason=${reason} sync_fallback`);
    } catch (error: unknown) {
      lastError = error;
      hidden = false;
      devLog('native_splash_hide_failed', error instanceof Error ? error.message : String(error));
      throw lastError;
    }
  })().finally(() => {
    hidePromise = null;
  });

  return hidePromise;
}

export function isNativeSplashHidden() {
  return hidden;
}

export function launchDevLog(event: string, details?: string) {
  devLog(event, details);
}
