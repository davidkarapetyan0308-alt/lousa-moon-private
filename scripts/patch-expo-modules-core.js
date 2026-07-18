#!/usr/bin/env node
/* eslint-env node */

const fs = require('node:fs');
const path = require('node:path');

const pluginPath = path.join(
  process.cwd(),
  'node_modules',
  'expo-modules-core',
  'android',
  'ExpoModulesCorePlugin.gradle',
);

if (!fs.existsSync(pluginPath)) {
  console.error(`[LOUSA] expo-modules-core Gradle plugin not found: ${pluginPath}`);
  console.error('[LOUSA] Run npm install before Android build.');
  process.exit(1);
}

const source = fs.readFileSync(pluginPath, 'utf8');
const patchedMarker = 'def releaseComponent = project.components.findByName("release")';

if (source.includes(patchedMarker)) {
  console.log('[LOUSA] Expo Modules Core Gradle compatibility patch already applied.');
  process.exit(0);
}

const original = `        release(MavenPublication) {\n          from components.release\n        }`;
const replacement = `        def releaseComponent = project.components.findByName("release")\n        if (releaseComponent != null) {\n          release(MavenPublication) {\n            from releaseComponent\n          }\n        } else {\n          logger.warn("Expo publishing skipped: Android release component is unavailable")\n        }`;

if (!source.includes(original)) {
  console.error('[LOUSA] Expected Expo Modules Core publishing block was not found.');
  console.error('[LOUSA] Dependency layout may have changed; refusing an unsafe automatic patch.');
  process.exit(1);
}

fs.writeFileSync(pluginPath, source.replace(original, replacement), 'utf8');
console.log('[LOUSA] Expo Modules Core Gradle compatibility patch applied.');
