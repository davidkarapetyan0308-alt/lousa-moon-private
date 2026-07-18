import { getMoonShadowPath } from '../src/utils/moonRendering';

describe('LOUSA moon rendering geometry', () => {
  it('keeps full moon unshadowed and new moon outlined by a deterministic full-disk mask', () => {
    expect(getMoonShadowPath(1, 'full_moon')).toBe('');
    expect(getMoonShadowPath(0, 'new_moon')).toContain('A50 50');
  });

  it('renders waxing and waning crescents on opposite sides', () => {
    const waxing = getMoonShadowPath(0.2, 'waxing_crescent');
    const waning = getMoonShadowPath(0.2, 'waning_crescent');
    expect(waxing).not.toBe(waning);
    expect(waxing).toContain('A50 50 0 0 1');
    expect(waning).toContain('A50 50 0 0 0');
  });

  it('clamps out-of-range illumination instead of producing invalid SVG', () => {
    expect(getMoonShadowPath(2, 'full_moon')).toBe('');
    expect(getMoonShadowPath(-1, 'new_moon')).toContain('M50 0');
  });
});
