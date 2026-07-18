#!/usr/bin/env node
/* eslint-env node */

const fs = require('node:fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const gradleProperties = read('android/gradle.properties');
const settingsGradle = read('android/settings.gradle');
const envExample = read('.env.example');
const patchScript = read('scripts/patch-expo-modules-core.js');
const qaBuild = read('scripts/build-qa-apk.sh');
const releaseApk = read('scripts/build-release-apk.sh');
const releaseAab = read('scripts/build-release-aab.sh');

const failures = [];
const requireText = (source, fragment, reason) => {
  if (!source.includes(fragment)) failures.push(`Missing: ${reason}`);
};
const forbidText = (source, fragment, reason) => {
  if (source.includes(fragment)) failures.push(`Forbidden: ${reason}`);
};

if (packageJson.scripts?.postinstall !== 'node scripts/patch-expo-modules-core.js') {
  failures.push('Missing: reproducible Expo Modules Core postinstall patch');
}

requireText(gradleProperties, 'android.useAndroidX=true', 'AndroidX must be enabled');
requireText(gradleProperties, 'android.enableJetifier=true', 'Jetifier must be enabled for the Expo Location SmartLocation AAR');
requireText(settingsGradle, 'System.getenv("NODE_BINARY")', 'portable Node binary lookup for Gradle');
forbidText(settingsGradle, '/Users/', 'Android settings must not contain a developer-specific absolute path');
forbidText(settingsGradle, 'PLUGINMANAGEMENT DEBUG', 'Android settings must not contain debug logging');
requireText(envExample, 'EMAIL_FROM="LOUSA MOON <onboarding@resend.dev>"', 'shell-safe EMAIL_FROM example');
requireText(patchScript, 'project.components.findByName("release")', 'safe Expo release component lookup');
requireText(patchScript, 'refusing an unsafe automatic patch', 'fail-closed dependency patch behavior');

for (const [name, source, task] of [
  ['QA APK', qaBuild, ':app:assembleQa'],
  ['release APK', releaseApk, ':app:assembleRelease'],
  ['release AAB', releaseAab, ':app:bundleRelease'],
]) {
  requireText(source, 'node scripts/patch-expo-modules-core.js', `${name} must apply the compatibility patch`);
  requireText(source, './gradlew clean --stacktrace', `${name} must clean in a separate Gradle invocation`);
  requireText(source, `./gradlew ${task} --stacktrace`, `${name} must run its build task after clean`);
  forbidText(source, `./gradlew clean ${task}`, `${name} must not combine clean and assemble/bundle in one Gradle graph`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('PASS: Android build scripts are reproducible after npm install and avoid the Expo Location clean/assemble race.');
