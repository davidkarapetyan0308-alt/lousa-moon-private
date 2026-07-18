#!/usr/bin/env bash
set -e
mkdir -p "$HOME/Desktop/LOUSA_DEBUG"
adb logcat -c || true
adb shell am force-stop com.lousa.moon || true
adb shell monkey -p com.lousa.moon 1 || true
sleep 12
adb logcat -d -v time > "$HOME/Desktop/LOUSA_DEBUG/full_logcat.txt" || true
adb logcat -d -v time | grep -iE "BOOT|lousa|reactnative|androidruntime|fatal|exception|firebase|hermes|reanimated|splash|expo|js|soloader|crash|error" > "$HOME/Desktop/LOUSA_DEBUG/filtered_error_log.txt" || true
adb shell dumpsys meminfo com.lousa.moon > "$HOME/Desktop/LOUSA_DEBUG/memory_lousa.txt" || true
adb shell dumpsys activity top > "$HOME/Desktop/LOUSA_DEBUG/activity_top.txt" || true
open "$HOME/Desktop/LOUSA_DEBUG" || true
