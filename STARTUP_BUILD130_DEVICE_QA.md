# Build 131 Android device QA

Expected QA metadata:

- package: `com.lousa.moon.qa`
- versionName: `1.18.20-qa`
- versionCode: `131`

## Clean install

```bash
adb uninstall com.lousa.moon.qa || true
adb install android/app/build/outputs/apk/qa/app-qa.apk
adb shell pm clear com.lousa.moon.qa
```

## Cold-start proof

```bash
adb logcat -c
adb shell am force-stop com.lousa.moon.qa
adb shell am start -W com.lousa.moon.qa/.MainActivity
sleep 12
adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime|FATAL EXCEPTION|STARTUP|LOUSA" > BUILD131_STARTUP_LOGCAT.txt
```

Pass criteria:

1. The startup recovery card never appears.
2. Logcat contains no `Attempted to navigate before mounting the Root Layout component`.
3. An unauthenticated clean launch reaches Paper Moon and the login form.
4. An authenticated launch reaches tabs.
5. A migration-required account reaches period review.
6. Reopening the app does not repeat the navigation error.
7. Paper Moon remains the first visible React auth scene.

If the old error appears, capture the complete `BUILD131_STARTUP_LOGCAT.txt` and the installed package metadata from `adb shell dumpsys package com.lousa.moon.qa`.
