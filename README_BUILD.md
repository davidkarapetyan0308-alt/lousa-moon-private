# Build entry point

The authoritative Android build instructions are in [`BUILD.md`](./BUILD.md).

QA APK, one command:

```bash
npm ci && EXPO_PUBLIC_LOUSA_API_URL=https://lousa-moon-api.onrender.com PUBLIC_API_URL=https://lousa-moon-api.onrender.com npm run android:apk:qa
```

Do not use `localhost`, `127.0.0.1`, `10.0.2.2`, `192.168.x.x`, or any private LAN address for a distributable APK.
