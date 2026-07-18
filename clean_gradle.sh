#!/bin/bash
# clean_gradle.sh – run before ./gradlew to ensure a fresh Gradle environment

# Remove any lingering lock file that can block the Gradle wrapper
find "$HOME/.gradle/wrapper/dists" -type f -name "*.lck" -exec rm -f {} +

# Clean Gradle caches (optional but helps with stale state)
rm -rf "$HOME/.gradle/caches"

echo "✅ Gradle cache and lock files cleared."
