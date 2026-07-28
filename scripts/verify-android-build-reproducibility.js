#!/usr/bin/env node
/* eslint-env node */
const fs = require('node:fs');
const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const failures = [];
const need = (condition, reason) => { if (!condition) failures.push(reason); };
const forbid = (condition, reason) => { if (condition) failures.push(reason); };

const gradleProperties = read('android/gradle.properties');
const settingsGradle = read('android/settings.gradle');
const envExample = read('.env.example');
const patchScript = read('scripts/patch-expo-modules-core.js');
need(packageJson.scripts?.postinstall === 'node scripts/patch-expo-modules-core.js', 'reproducible Expo Modules Core postinstall patch');
need(gradleProperties.includes('android.useAndroidX=true'), 'AndroidX must be enabled');
need(gradleProperties.includes('android.enableJetifier=true'), 'Jetifier must be enabled');
need(settingsGradle.includes('System.getenv("NODE_BINARY")'), 'portable Node binary lookup for Gradle');
forbid(settingsGradle.includes('/Users/'), 'developer-specific absolute path in Android settings');
forbid(settingsGradle.includes('PLUGINMANAGEMENT DEBUG'), 'debug logging in Android settings');
need(envExample.includes('EMAIL_FROM="LOUSA MOON <onboarding@resend.dev>"'), 'shell-safe EMAIL_FROM example');
need(patchScript.includes('project.components.findByName("release")'), 'safe Expo release component lookup');
need(patchScript.includes('refusing an unsafe automatic patch'), 'fail-closed dependency patch behavior');

for (const [name, file, task] of [
  ['QA APK', 'scripts/build-qa-apk.sh', ':app:assembleQa'],
  ['release APK', 'scripts/build-release-apk.sh', ':app:assembleRelease'],
  ['release AAB', 'scripts/build-release-aab.sh', ':app:bundleRelease'],
]) {
  const source = read(file);
  need(source.includes('node scripts/patch-expo-modules-core.js'), `${name} applies compatibility patch`);
  const cleanIndex = source.search(/\.\/gradlew\s+clean(?:\s+"\$\{[^}]+\[@\]\}")?|\.\/gradlew\s+clean\s+--stacktrace/);
  const taskIndex = source.indexOf(`./gradlew ${task}`);
  need(cleanIndex >= 0, `${name} runs Gradle clean`);
  need(taskIndex > cleanIndex, `${name} runs build task after clean`);
  forbid(new RegExp(`\\.\\/gradlew\\s+clean[^\\n]*${task.replace(':', '\\:')}`).test(source), `${name} combines clean and build task in one invocation`);
}

if (failures.length) {
  console.error('verify:android-build-reproducibility FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('verify:android-build-reproducibility PASS');
