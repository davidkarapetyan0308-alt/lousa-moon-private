# LOUSA MOON 1.18.22 build 133 - Native splash handoff fix

## Root cause

The earlier Paper Moon guards correctly waited for a visible React scene, but a
native `expo-splash-screen` failure was still treated as a fatal animation
failure. This happens on some Android process-restoration paths when the native
splash has already auto-hidden or no longer has a registered view.

The old handler then called `finishOnce('fallback')`, removing the React
overlay immediately. The user saw the normal application screen and concluded
that the animation never ran.

## Build 133 guarantee

Native splash handoff is no longer allowed to cancel the React intro.

```text
native splash hides successfully -> Paper Moon starts
native splash already hidden       -> Paper Moon starts
native splash API rejects          -> Paper Moon starts
native splash call times out       -> Paper Moon starts
```

The React Paper Moon scene has three bounded readiness paths:

1. Root Stack signal: two rendered frames, with a 1.6-second watchdog.
2. Layout signal: normal `onLayout`, with a 320ms watchdog.
3. Paper image decode: normal `Image.onLoad`, with a 1.6-second calm fallback.

The native splash request itself has a 750ms cap. When it fails, the event is
recorded as `native_splash_handoff_failed_continue_intro`, but the animation
always continues. No route, Firebase, network, or splash API state may call the
intro-completion path before the timeline finishes.

## Verification

- TypeScript compilation.
- Focused startup contracts for layout timeout and native splash handoff cap.
- Full Jest suite, lint and Paper Moon verifier.
- QA APK must contain the three new trace markers before distribution.

## Required device check

Install Build 133 over any previous QA build, force-stop the application, and
cold start it three times. It must show Paper Moon even if Android immediately
hides the native splash. Test both a signed-out account and a restored session.
