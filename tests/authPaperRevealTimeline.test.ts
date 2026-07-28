import {
  AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS,
  AUTH_PAPER_MOON_EMERGENCY_FINISH_MS,
  AUTH_PAPER_MOON_LAYOUT_TIMEOUT_MS,
  AUTH_PAPER_MOON_SPLASH_HANDOFF_TIMEOUT_MS,
  AUTH_PAPER_MOON_PHASES,
  AUTH_PAPER_MOON_TIMELINE,
  getAuthPaperCloudTravel,
  getAuthPaperMoonTimeline,
  getStartupPaperMoonTimeline,
  getThreadHeightForMoonOffset,
} from '../src/features/auth/components/authPaperRevealTimeline';

describe('global Paper Moon reveal', () => {
  it('runs the full welcome reveal in under five seconds', () => {
    expect(AUTH_PAPER_MOON_TIMELINE.normal.totalMs).toBe(2900);
  });

  it('keeps reduced motion visible instead of skipping it', () => {
    expect(AUTH_PAPER_MOON_TIMELINE.reduced.totalMs).toBeGreaterThanOrEqual(1800);
    expect(AUTH_PAPER_MOON_TIMELINE.reduced.totalMs).toBeLessThanOrEqual(2200);
  });

  it('keeps the fallback scene visible instead of flashing through an asset error', () => {
    expect(AUTH_PAPER_MOON_TIMELINE.fallback.totalMs).toBeGreaterThanOrEqual(1800);
  });

  it('brings the real registration interface into the centre while the paper scene opens', () => {
    expect(AUTH_PAPER_MOON_TIMELINE.normal.formDelay)
      .toBeGreaterThan(AUTH_PAPER_MOON_TIMELINE.normal.cloudsFrontDelay);
    expect(AUTH_PAPER_MOON_TIMELINE.normal.formDelay)
      .toBeGreaterThan(AUTH_PAPER_MOON_TIMELINE.normal.cloudsBackDelay);
  });

  it('moves left and right cloud groups in opposite directions', () => {
    const travel = getAuthPaperCloudTravel(393, false);
    expect(travel.leftBack).toBeLessThan(0);
    expect(travel.leftFront).toBeLessThan(travel.leftBack);
    expect(travel.rightBack).toBeGreaterThan(0);
    expect(travel.rightFront).toBeGreaterThan(travel.rightBack);
  });

  it('shortens the rope while the moon rises, keeping it attached to the moon', () => {
    expect(getThreadHeightForMoonOffset(260, 0)).toBe(260);
    expect(getThreadHeightForMoonOffset(260, -120)).toBe(140);
    expect(getThreadHeightForMoonOffset(260, -400)).toBe(0);
  });

  it('keeps the complete phase order', () => {
    expect(AUTH_PAPER_MOON_PHASES).toEqual([
      'PRELOAD',
      'READY',
      'HOLD',
      'MOON_RISE',
      'CLOUDS_OPEN',
      'FORM_REVEAL',
      'SETTLE',
      'COMPLETE',
    ]);
  });

  it('places emergency completion after the normal timeline', () => {
    expect(AUTH_PAPER_MOON_EMERGENCY_FINISH_MS)
      .toBeGreaterThan(AUTH_PAPER_MOON_TIMELINE.normal.totalMs);
  });

  it('releases a missing Android image decode into the calm fallback quickly', () => {
    expect(AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS).toBeLessThanOrEqual(2_000);
  });

  it('bounds Android layout and native-splash handoff before the scene starts', () => {
    expect(AUTH_PAPER_MOON_LAYOUT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(AUTH_PAPER_MOON_LAYOUT_TIMEOUT_MS).toBeLessThanOrEqual(500);
    expect(AUTH_PAPER_MOON_SPLASH_HANDOFF_TIMEOUT_MS).toBeGreaterThan(0);
    expect(AUTH_PAPER_MOON_SPLASH_HANDOFF_TIMEOUT_MS).toBeLessThanOrEqual(1_000);
  });

  it('selects the requested motion profile', () => {
    expect(getAuthPaperMoonTimeline(false)).toBe(AUTH_PAPER_MOON_TIMELINE.normal);
    expect(getAuthPaperMoonTimeline(true)).toBe(AUTH_PAPER_MOON_TIMELINE.reduced);
    expect(getStartupPaperMoonTimeline(false, true)).toBe(AUTH_PAPER_MOON_TIMELINE.fallback);
  });


  it('owns the intro above navigation instead of inside one auth route', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const loginSource = fs.readFileSync('app/auth/login.tsx', 'utf8');
    const startupSource = fs.readFileSync('src/bootstrap/StartupExperience.tsx', 'utf8');
    expect(startupSource).toContain('<AuthPaperRevealGate active startWhenReady={routeReady}>');
    expect(loginSource).not.toContain('AuthPaperRevealGate');
  });

});
