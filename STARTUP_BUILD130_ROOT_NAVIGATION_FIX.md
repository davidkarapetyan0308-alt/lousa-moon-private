# LOUSA MOON 1.18.20 build 131 — Root navigation startup fix

## Exact device error

Build 129 displayed:

`Attempted to navigate before mounting the Root Layout component. Ensure the Root Layout component is rendering a Slot, or other navigator on the first render.`

The error occurred because `NavigationWrapper` returned `null` while persisted state was hydrating. The same component then called `router.replace(...)`. At that moment the root `Stack` was not mounted, so Expo Router rejected the navigation operation.

## Root cause

The previous tree was effectively:

`RootLayout → AppShell → NavigationWrapper → null`

and only after hydration:

`NavigationWrapper effect → router.replace(...)`

The navigator was inside the conditional wrapper, so the redirect could run before a navigation container existed.

## Build 131 architecture

The new tree is always:

`RootLayout → AppShell → Stack + NavigationCoordinator`

- `Stack` is rendered unconditionally on the first React render.
- `app/index.tsx` is a lightweight startup route behind the held native splash.
- `NavigationCoordinator` is a sibling of the mounted `Stack`, never its parent.
- Redirects are allowed only when `useRootNavigationState()?.key` exists.
- Hydration can no longer replace the root navigator with `null`.
- A delayed redirect retry also checks navigator readiness.
- The wrong destination is never revealed by a route-stability bypass.

This follows Expo Router's documented requirement that the root layout render a `Slot` or navigator on its first render; conditional auth/loading logic must not prevent the root navigator from mounting.

## Files changed

- `src/bootstrap/AppShell.tsx`
- `src/bootstrap/startupNavigation.ts`
- `app/index.tsx`
- `tests/startupNavigation.test.ts`
- `scripts/verify-build130-root-navigation.js`
- `scripts/verify-paper-moon-entry.js`
- `scripts/verify-single-stage-auth-intro.js`
- version/build and handoff files

## Verification completed

- Full static verification: PASS.
- Root navigation startup contract: PASS.
- Paper Moon entry contract: PASS.
- Single-stage auth intro contract: PASS.
- 197 TS/TSX files parsed with zero syntax errors.
- 570 relative imports checked with zero missing targets.
- Startup destination behavior scenarios: 7/7 PASS.

## Not yet proven

A QA release APK was not produced in this environment because `npm ci` received HTTP 503 while downloading `zustand-4.5.7`. Device installation and cold-start recording are still required.
