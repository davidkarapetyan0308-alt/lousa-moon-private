# LOUSA MOON 1.18.21 build 132 - Paper Moon startup guarantee

## Problem addressed

Build 131 correctly moved the Paper Moon scene above the route screens, but the
scene still waited for `NavigationCoordinator` to report that hydration and an
auth redirect had fully settled. On a restored Android process, Expo Router can
delay that report long enough for the animation to appear absent.

## Build 132 behavior

The Paper Moon scene now begins when all of its own visual prerequisites are
ready and the persistent root `Stack` has rendered two frames. It does not wait
for SecureStore hydration, Firebase session recovery, or an auth redirect.

```text
native splash
  -> root Stack mounts
  -> first two root frames
  -> Paper Moon assets/layout ready
  -> native splash hides
  -> Paper Moon animation plays
  -> route remains interactive below the completed overlay
```

Two bounded protections prevent a missing animation:

1. A 1.6-second root-frame watchdog releases the route handoff if Expo Router
   never reports a root frame after Android process restoration.
2. A 1.6-second image-decode watchdog replaces any layers that fail to emit
   `Image.onLoad` with the calm native fallback. The fallback still plays for
   about 1.9 seconds and never flashes through.

`startWhenReady` remains only as a final handoff gate. If the visual timeline
finishes before the root frame signal, the overlay waits instead of disappearing
early; once the signal arrives it completes immediately.

## Verification included

- TypeScript compilation.
- Jest contracts for the root-frame start and Android image-decode timeout.
- `npm run verify:paper-moon-entry` static startup contract.
- Full QA APK build and APK metadata/bundle verification.

## Android device acceptance

Install the Build 132 QA APK over Build 131, force-stop it, then cold start it
three times: once logged out, once with a stored session, and once with Android
Reduce Motion enabled. Each launch must show the Paper Moon scene for roughly
5.4 seconds (or about 2 seconds for Reduce Motion/fallback) before the content
becomes interactive.
