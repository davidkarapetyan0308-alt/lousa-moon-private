# Paper Moon performance verification

Source-level performance measures in build 128:

- animation values run through Reanimated shared values;
- no React state updates are used per animation frame;
- API refresh, cycle sync, and notifications wait for startup readiness;
- Paper Moon assets must load successfully before splash handoff;
- native splash is background-only;
- startup timestamps use monotonic time.

Required device evidence:

- QA release APK, not debug or Expo Go;
- full cold-start video beginning before icon tap;
- `adb shell am start -W` output;
- startup logcat containing `[STARTUP +...ms]` records;
- `adb shell dumpsys gfxinfo com.lousa.moon.qa framestats`;
- Perfetto or Android Studio system trace;
- verification on at least one mid-range Android device.
