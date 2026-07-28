# Paper Moon build 133 Android device QA

Expected package: `com.lousa.moon.qa`

Expected version:

- versionName: `1.18.22-qa`
- versionCode: `133`

## Clean installation

```bash
adb uninstall com.lousa.moon.qa || true
adb install LOUSA_MOON_V1.18.22_BUILD133_PAPER_MOON_NATIVE_HANDOFF_FIX_QA.apk
adb shell pm clear com.lousa.moon.qa
```

## Cold start

```bash
adb shell am force-stop com.lousa.moon.qa
adb logcat -c
adb shell am start -W com.lousa.moon.qa/.MainActivity | tee BUILD133_START_W.txt
adb logcat -d | grep -E 'STARTUP|LAUNCH|AUTH_PAPER_MOON' > BUILD133_LOGCAT.txt
```

## Frame data

```bash
adb shell dumpsys gfxinfo com.lousa.moon.qa reset
# launch and allow the full intro to complete
adb shell dumpsys gfxinfo com.lousa.moon.qa framestats > BUILD131_FRAMESTATS.txt
```

## Acceptance

- no separate moon splash;
- no loading text;
- no blank React screen;
- clouds and moon are present on the first React frame;
- only one intro instance starts;
- movement lasts approximately five seconds;
- the form remains the same mounted tree;
- buttons respond after completion;
- no Metro connection is required.

Until video and frame evidence exist, device QA remains **NOT COMPLETED**.
