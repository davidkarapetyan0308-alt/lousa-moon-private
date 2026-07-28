# Paper Moon root cause and startup contract

## Confirmed source-level causes in earlier builds

- AppShell was loaded after the first React render through a guarded dynamic `require()`.
- Route settlement happened separately from root module loading.
- Deferred services were delayed by timers/InteractionManager but not tied to actual Paper Moon completion.
- Reanimated animations can continue on the UI thread while JS-side deferred tasks begin, so `InteractionManager` alone is not a reliable intro gate.
- Previous checks were mostly source-string guards and could not prove installed APK behavior.

## Build 128 contract

For unauthenticated launches:

1. Native splash remains visible.
2. Local session restore resolves the destination.
3. Auth intro completion becomes a required startup gate.
4. Auth screen and all Paper Moon layers mount behind native splash.
5. All five image layers report successful load and layout completes.
6. Two rendered frames pass.
7. Native splash hides.
8. One Paper Moon timeline starts.
9. Intro completion releases deferred services.

For authenticated launches, intro is marked not required and native splash is released after stable navigation layout.
