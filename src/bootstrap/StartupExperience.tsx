import React, { ReactNode } from 'react';

import { AuthPaperRevealGate } from '../features/auth/components/AuthPaperReveal';

type StartupExperienceProps = {
  /** True only after a real route is mounted under the persistent root Stack. */
  routeReady: boolean;
  children: ReactNode;
};

/**
 * The one cold-start visual owner for the whole application. It deliberately
 * wraps the root navigation tree rather than an auth route, so an existing
 * session, a guest session and an unauthenticated launch receive the same
 * stable Paper Moon handoff.
 */
export function StartupExperience({ routeReady, children }: StartupExperienceProps) {
  return (
    <AuthPaperRevealGate active startWhenReady={routeReady}>
      {children}
    </AuthPaperRevealGate>
  );
}

