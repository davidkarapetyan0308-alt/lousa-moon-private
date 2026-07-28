export type StartupDestination = '/auth/login' | '/screens/period-review' | '/(tabs)' | null;

export type ResolveStartupDestinationInput = {
  hydrated: boolean;
  sessionChecked: boolean;
  isOnboarded: boolean;
  isGuestMode: boolean;
  guestAuthFlowActive: boolean;
  migrationReviewRequired: boolean;
  segments: readonly string[];
};

export function resolveStartupDestination({
  hydrated,
  sessionChecked,
  isOnboarded,
  isGuestMode,
  guestAuthFlowActive,
  migrationReviewRequired,
  segments,
}: ResolveStartupDestinationInput): StartupDestination {
  if (!hydrated || !sessionChecked) return null;

  const firstSegment = segments[0];
  const inAuthGroup = firstSegment === 'auth';
  const inStartupRoute = segments.length === 0 || firstSegment === 'index';
  const inMigrationReview = segments.join('/') === 'screens/period-review';
  const guestMayUseAuth = isGuestMode && guestAuthFlowActive && inAuthGroup;

  if (!isOnboarded && !inAuthGroup) return '/auth/login';
  if (isOnboarded && migrationReviewRequired && !inMigrationReview && !guestMayUseAuth) {
    return '/screens/period-review';
  }
  if (isOnboarded && (inAuthGroup || inStartupRoute) && !guestMayUseAuth) return '/(tabs)';
  return null;
}
