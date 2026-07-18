import { resolvePublicApiUrl } from '../apps/api/src/config/env';

describe('resolvePublicApiUrl', () => {
  it('keeps an explicitly configured public URL', () => {
    expect(resolvePublicApiUrl('https://api.lousa.example', 'ignored.onrender.com'))
      .toBe('https://api.lousa.example');
  });

  it('uses the HTTPS Render hostname when no explicit URL exists', () => {
    expect(resolvePublicApiUrl('', 'lousa-moon-api.onrender.com'))
      .toBe('https://lousa-moon-api.onrender.com');
  });

  it('returns null when no public hostname is configured', () => {
    expect(resolvePublicApiUrl('', '')).toBeNull();
  });
});
