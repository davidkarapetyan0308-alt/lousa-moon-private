#!/usr/bin/env bash
set -euo pipefail

APK="${1:-android/app/build/outputs/apk/qa/app-qa.apk}"
OUT_DIR="${2:-paper-moon-device-qa}"
PACKAGE="com.lousa.moon.qa"
ACTIVITY="$PACKAGE/.MainActivity"

[[ -f "$APK" ]] || { echo "APK not found: $APK" >&2; exit 2; }
command -v adb >/dev/null 2>&1 || { echo "adb is required." >&2; exit 2; }

DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" {count++} END {print count+0}')"
[[ "$DEVICE_COUNT" -eq 1 ]] || { echo "Exactly one authorized Android device is required; found $DEVICE_COUNT." >&2; exit 2; }

mkdir -p "$OUT_DIR"
VIDEO_REMOTE="/sdcard/PAPER_MOON_BUILD131_COLD_START.mp4"
VIDEO_LOCAL="$OUT_DIR/PAPER_MOON_BUILD131_COLD_START.mp4"
FRAMESTATS="$OUT_DIR/paper-moon-framestats.txt"
STARTUP="$OUT_DIR/paper-moon-startup.txt"
DEVICE="$OUT_DIR/device-info.txt"
LOGCAT="$OUT_DIR/paper-moon-logcat.txt"

{
  echo "model=$(adb shell getprop ro.product.manufacturer | tr -d '\r') $(adb shell getprop ro.product.model | tr -d '\r')"
  echo "android=$(adb shell getprop ro.build.version.release | tr -d '\r')"
  echo "sdk=$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "refresh_rate=$(adb shell dumpsys display | grep -m1 -Eo 'fps=[0-9.]+' || true)"
} > "$DEVICE"

adb uninstall "$PACKAGE" >/dev/null 2>&1 || true
adb install "$APK"
adb shell am force-stop "$PACKAGE"
adb shell dumpsys gfxinfo "$PACKAGE" reset >/dev/null 2>&1 || true
adb logcat -c
adb shell rm -f "$VIDEO_REMOTE"

# screenrecord is started before Activity launch, so the file captures the cold-start handoff.
adb shell screenrecord --bit-rate 12000000 --time-limit 15 "$VIDEO_REMOTE" >/dev/null 2>&1 &
RECORD_PID=$!
sleep 1
adb shell am start -W "$ACTIVITY" | tee "$STARTUP"
wait "$RECORD_PID" || true

adb pull "$VIDEO_REMOTE" "$VIDEO_LOCAL" >/dev/null
adb shell dumpsys gfxinfo "$PACKAGE" framestats > "$FRAMESTATS"
adb logcat -d -v threadtime | grep -E 'LAUNCH|AUTH_PAPER_MOON|ReactNativeJS|AndroidRuntime' > "$LOGCAT" || true

cat <<MSG
Paper Moon device QA capture completed.
Video: $VIDEO_LOCAL
Frame stats: $FRAMESTATS
Startup timing: $STARTUP
Device info: $DEVICE
Logcat: $LOGCAT

Review the video manually and capture a Perfetto/System Trace separately while reproducing the same cold start.
MSG
