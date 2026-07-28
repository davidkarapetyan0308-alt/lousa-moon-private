# LOUSA MOON 1.18.20 build 131 - Global Paper Moon startup repair

## Fixed issue

The Paper Moon animation previously lived only inside `app/auth/login.tsx`. A restored session or guest launch navigated directly to another route, so the animation either never mounted or appeared for a single unstable frame during a redirect.

## Build 131 ownership rule

`src/bootstrap/StartupExperience.tsx` now owns Paper Moon once above the persistent root `Stack`. It waits for `NavigationCoordinator` to report that the actual destination has committed for two animation frames. Login, guest and restored-session launches therefore share one stable handoff:

`native splash -> mounted Stack -> committed destination -> Paper Moon -> interactive destination`

## Failure behavior

- Paper assets preload and image decoding are still required for the normal scene.
- Each failed image gets one retry.
- A repeat failure switches only that image to a native fallback; it never finishes the intro immediately.
- The full fallback timeline remains visible for 1.9 seconds.
- Reduced Motion remains visible for 2.0 seconds.
- Startup trace records route readiness, first rendered Paper Moon frame, splash handoff, fallback and completion.

## Verification required on a phone

Run `npm run qa:paper-moon-device` with exactly one authorized Android device after installing the generated QA APK. Review the captured video for a cold launch, a restored session and Reduce Motion enabled.
