export const AUTH_PAPER_MOON_PHASES = [
  'PRELOAD',
  'READY',
  'HOLD',
  'MOON_RISE',
  'CLOUDS_OPEN',
  'FORM_REVEAL',
  'SETTLE',
  'COMPLETE',
] as const;

export const AUTH_PAPER_MOON_TIMELINE = {
  normal: {
    moonDelay: 120,
    moonDuration: 1_800,
    cloudsFrontDelay: 280,
    cloudsBackDelay: 180,
    cloudsFrontDuration: 1_450,
    cloudsBackDuration: 1_650,
    veilDelay: 1_080,
    veilDuration: 620,
    formDelay: 1_350,
    formDuration: 700,
    overlayDelay: 2_450,
    overlayDuration: 450,
    totalMs: 2_900,
  },
  reduced: {
    // Reduced Motion is a calm hold, not a flash. The scene stays visible long
    // enough to communicate a deliberate launch without moving the artwork.
    moonDelay: 120,
    moonDuration: 1_500,
    cloudsFrontDelay: 120,
    cloudsBackDelay: 120,
    cloudsFrontDuration: 1_500,
    cloudsBackDuration: 1_500,
    veilDelay: 180,
    veilDuration: 760,
    formDelay: 320,
    formDuration: 760,
    overlayDelay: 1_420,
    overlayDuration: 580,
    totalMs: 2_000,
  },
  fallback: {
    // A failed bundled image must still produce a complete, calm handoff.
    moonDelay: 120,
    moonDuration: 1_500,
    cloudsFrontDelay: 120,
    cloudsBackDelay: 120,
    cloudsFrontDuration: 1_500,
    cloudsBackDuration: 1_500,
    veilDelay: 180,
    veilDuration: 760,
    formDelay: 320,
    formDuration: 760,
    overlayDelay: 1_300,
    overlayDuration: 600,
    totalMs: 1_900,
  },
} as const;

export const AUTH_PAPER_MOON_EMERGENCY_FINISH_MS = 11000;
// Android may occasionally skip an Image onLoad callback after a process restore.
// This is not allowed to keep the entire launch scene behind the native splash.
export const AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS = 1600;
// A React Native onLayout callback is expected on the root host, but a restored
// Android activity must never be able to suppress the whole launch scene if it
// arrives late or is missed by a renderer transition.
export const AUTH_PAPER_MOON_LAYOUT_TIMEOUT_MS = 320;
export const AUTH_PAPER_MOON_SPLASH_HANDOFF_TIMEOUT_MS = 750;

export function getAuthPaperMoonTimeline(reduceMotion: boolean) {
  return reduceMotion ? AUTH_PAPER_MOON_TIMELINE.reduced : AUTH_PAPER_MOON_TIMELINE.normal;
}

export function getStartupPaperMoonTimeline(reduceMotion: boolean, fallback: boolean) {
  if (fallback) return AUTH_PAPER_MOON_TIMELINE.fallback;
  return getAuthPaperMoonTimeline(reduceMotion);
}

export function getAuthPaperCloudTravel(sceneWidth: number, reduceMotion: boolean) {
  const safeWidth = Math.min(Math.max(sceneWidth, 320), 620);
  if (reduceMotion) {
    return {
      leftBack: -Math.min(safeWidth * 0.07, 30),
      leftFront: -Math.min(safeWidth * 0.09, 38),
      rightBack: Math.min(safeWidth * 0.07, 30),
      rightFront: Math.min(safeWidth * 0.09, 38),
    } as const;
  }
  return {
    leftBack: -safeWidth * 0.54,
    leftFront: -safeWidth * 0.72,
    rightBack: safeWidth * 0.54,
    rightFront: safeWidth * 0.72,
  } as const;
}

/** Keeps the rope bottom attached to the moon while its top remains fixed. */
export function getThreadHeightForMoonOffset(startHeight: number, moonTranslateY: number) {
  'worklet';
  return Math.max(0, startHeight + moonTranslateY);
}
