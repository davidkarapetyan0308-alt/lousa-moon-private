export type StartupEvent =
  | 'JS_MODULE_LOADED'
  | 'STARTUP_EXPERIENCE_MOUNTED'
  | 'STARTUP_ASSET_PRELOAD_STARTED'
  | 'STARTUP_ASSET_READY'
  | 'STARTUP_ASSET_RETRY'
  | 'STARTUP_ASSET_FALLBACK'
  | 'STARTUP_FIRST_FRAME_READY'
  | 'STARTUP_NATIVE_SPLASH_HIDDEN'
  | 'STARTUP_ANIMATION_STARTED'
  | 'STARTUP_REDUCED_MOTION'
  | 'STARTUP_ANIMATION_COMPLETED'
  | 'STARTUP_DESTINATION_READY'
  | 'STARTUP_ROUTE_COMMITTED'
  | 'ROOT_LAYOUT_RENDER'
  | 'NATIVE_SPLASH_HOLD_REQUESTED'
  | 'NATIVE_SPLASH_HELD'
  | 'SESSION_RESTORE_STARTED'
  | 'SESSION_RESTORE_FINISHED'
  | 'INITIAL_ROUTE_RESOLVED'
  | 'AUTH_SCREEN_MOUNTED'
  | 'INTRO_COMPONENT_MOUNTED'
  | 'INTRO_ASSETS_PRELOAD_STARTED'
  | 'INTRO_ASSETS_PRELOAD_FINISHED'
  | 'INTRO_LAYOUT_READY'
  | 'INTRO_IMAGES_DECODED'
  | 'FIRST_PAPER_FRAME_READY'
  | 'NATIVE_SPLASH_HIDE_REQUESTED'
  | 'NATIVE_SPLASH_HIDDEN'
  | 'INTRO_TIMELINE_STARTED'
  | 'CLOUDS_STARTED'
  | 'MOON_STARTED'
  | 'FORM_REVEAL_STARTED'
  | 'INTRO_COMPLETED'
  | 'DEFERRED_BOOTSTRAP_STARTED'
  | 'STARTUP_FALLBACK';

type StartupRecord = { event: StartupEvent; elapsedMs: number; details?: string };

const startedAt = global.performance?.now?.() ?? Date.now();
const records: StartupRecord[] = [];

export function traceStartup(event: StartupEvent, details?: string) {
  const now = global.performance?.now?.() ?? Date.now();
  const record = { event, elapsedMs: Math.max(0, now - startedAt), details };
  records.push(record);
  if (__DEV__) {
    const suffix = details ? ` ${details}` : '';
    console.log(`[STARTUP +${record.elapsedMs.toFixed(1)}ms] ${event}${suffix}`);
  }
  return record;
}

export function getStartupTrace() {
  return records.slice();
}

traceStartup('JS_MODULE_LOADED');
