import {
  KNOWN_NEW_MOON_UTC,
  SYNODIC_MONTH_DAYS,
  getMoonPhase,
} from '../src/utils/moonPhase';

const DAY_MS = 86_400_000;
const reference = new Date(KNOWN_NEW_MOON_UTC).getTime();

function atAge(days: number) {
  return new Date(reference + days * DAY_MS);
}

describe('astronomical moon phase approximation', () => {
  it('recognizes the reference new moon without producing medical meaning', () => {
    const result = getMoonPhase(atAge(0));
    expect(result.phase).toBe('new_moon');
    expect(result.illumination).toBeLessThanOrEqual(0.001);
    expect(result.isWaxing).toBe(false);
    expect(result.emotionalState.toLowerCase()).toContain('no emotional');
  });

  it('recognizes first quarter, full moon, and last quarter around their phase points', () => {
    expect(getMoonPhase(atAge(SYNODIC_MONTH_DAYS / 4)).phase).toBe('first_quarter');
    const full = getMoonPhase(atAge(SYNODIC_MONTH_DAYS / 2));
    expect(full.phase).toBe('full_moon');
    expect(full.illumination).toBeGreaterThan(0.99);
    expect(getMoonPhase(atAge((SYNODIC_MONTH_DAYS * 3) / 4)).phase).toBe('last_quarter');
  });

  it('distinguishes waxing from waning at the same illumination neighborhood', () => {
    const waxing = getMoonPhase(atAge(SYNODIC_MONTH_DAYS * 0.15));
    const waning = getMoonPhase(atAge(SYNODIC_MONTH_DAYS * 0.85));
    expect(waxing.isWaxing).toBe(true);
    expect(waning.isWaxing).toBe(false);
    expect(waxing.phase).toBe('waxing_crescent');
    expect(waning.phase).toBe('waning_crescent');
  });

  it('is based on the instant, not the host timezone string', () => {
    const instantA = new Date('2026-07-12T20:00:00+04:00');
    const instantB = new Date('2026-07-12T16:00:00Z');
    expect(getMoonPhase(instantA)).toMatchObject(getMoonPhase(instantB));
  });
});
