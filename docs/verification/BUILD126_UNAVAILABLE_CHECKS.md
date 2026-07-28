# Build 126 unavailable checks

`npm ci` could not complete because the configured package registry returned HTTP 503 for `zustand-4.5.7.tgz`.

Consequently, the following checks were not executed in this environment:

- semantic TypeScript typecheck using the project dependencies;
- ESLint;
- Jest;
- Gradle QA release APK;
- APK verification;
- physical Android device QA.

This does not replace Android device testing.
