import { normalizeThemeName } from '../src/theme/tokens';

describe('startup theme recovery', () => {
  test('accepts every current theme', () => {
    expect(normalizeThemeName('rose_gold')).toBe('rose_gold');
    expect(normalizeThemeName('pearl_white')).toBe('pearl_white');
    expect(normalizeThemeName('midnight_moon')).toBe('midnight_moon');
    expect(normalizeThemeName('moon_silver')).toBe('moon_silver');
    expect(normalizeThemeName('lavender_dream')).toBe('lavender_dream');
  });

  test('maps known legacy identifiers', () => {
    expect(normalizeThemeName('light')).toBe('rose_gold');
    expect(normalizeThemeName('dark')).toBe('midnight_moon');
    expect(normalizeThemeName('roseGold')).toBe('rose_gold');
  });

  test('never returns an invalid key for malformed persisted state', () => {
    expect(normalizeThemeName('removed-theme')).toBe('rose_gold');
    expect(normalizeThemeName(null)).toBe('rose_gold');
    expect(normalizeThemeName({})).toBe('rose_gold');
  });
});
