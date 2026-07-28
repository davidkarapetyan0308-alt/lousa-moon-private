import { resolveStartupDestination } from '../src/bootstrap/startupNavigation';

const base = {
  hydrated: true,
  sessionChecked: true,
  isOnboarded: false,
  isGuestMode: false,
  guestAuthFlowActive: false,
  migrationReviewRequired: false,
  segments: [] as string[],
};

describe('resolveStartupDestination', () => {
  it('does not navigate before local session resolution', () => {
    expect(resolveStartupDestination({ ...base, hydrated: false })).toBeNull();
    expect(resolveStartupDestination({ ...base, sessionChecked: false })).toBeNull();
  });

  it('sends an unauthenticated cold start to the login route', () => {
    expect(resolveStartupDestination(base)).toBe('/auth/login');
  });

  it('sends an authenticated cold start to tabs', () => {
    expect(resolveStartupDestination({ ...base, isOnboarded: true })).toBe('/(tabs)');
  });

  it('does not redirect when the correct route is already active', () => {
    expect(resolveStartupDestination({ ...base, segments: ['auth', 'login'] })).toBeNull();
    expect(resolveStartupDestination({ ...base, isOnboarded: true, segments: ['(tabs)'] })).toBeNull();
  });

  it('prioritizes migration review for authenticated users', () => {
    expect(resolveStartupDestination({
      ...base,
      isOnboarded: true,
      migrationReviewRequired: true,
      segments: ['(tabs)'],
    })).toBe('/screens/period-review');
  });

  it('allows a guest to stay in the explicit auth flow', () => {
    expect(resolveStartupDestination({
      ...base,
      isOnboarded: true,
      isGuestMode: true,
      guestAuthFlowActive: true,
      segments: ['auth', 'login'],
    })).toBeNull();
  });
});
