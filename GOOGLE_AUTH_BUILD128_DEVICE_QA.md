# Google Auth build 128 — Android Device QA

Status: **NOT EXECUTED IN THIS ENVIRONMENT**.

Before building, provide the stable QA keystore and ensure its SHA-1/SHA-256 is registered for `com.lousa.moon.qa`. Run `npm run verify:google-oauth-config` and do not continue on failure.

Required scenarios on a physical Android release QA APK:

1. new Google user;
2. existing Google user;
3. logout and login again;
4. backend awake;
5. Render cold start;
6. backend offline — must enter local limited mode without reopening Google;
7. automatic recovery to authenticated state;
8. slow network;
9. duplicate button taps;
10. app killed during exchange and reopened.

Capture APK certificate metadata, package/version, screen recording, filtered logcat, client auth trace and matching backend request ID.

Until those artifacts exist:

`GOOGLE SIGN-IN И СЕРВЕРНАЯ СЕССИЯ НЕ ПОДТВЕРЖДЕНЫ НА РЕАЛЬНОМ ANDROID И НЕ МОГУТ СЧИТАТЬСЯ ГОТОВЫМИ.`
