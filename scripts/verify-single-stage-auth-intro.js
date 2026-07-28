#!/usr/bin/env node
const fs = require('node:fs');
const layout = fs.readFileSync('app/_layout.tsx', 'utf8');
const appShell = fs.readFileSync('src/bootstrap/AppShell.tsx', 'utf8');
const reveal = fs.readFileSync('src/features/auth/components/AuthPaperReveal.tsx', 'utf8');
const startupExperience = fs.readFileSync('src/bootstrap/StartupExperience.tsx', 'utf8');
const login = fs.readFileSync('app/auth/login.tsx', 'utf8');
const activity = fs.readFileSync('android/app/src/main/java/com/lousa/moon/MainActivity.kt', 'utf8');
const failures = [];
const need = (condition, message) => { if (!condition) failures.push(message); };
const forbid = (condition, message) => { if (condition) failures.push(message); };

forbid(appShell.includes('function BootScreen'), 'visible BootScreen must not exist');
forbid(appShell.includes('function StartupCanvas'), 'visible StartupCanvas must not exist');
forbid(/Проверяем сессию|Начинаем сессию|Загружаем данные/.test(appShell), 'startup loading text must not exist');
forbid(/setTimeout\(hideNativeSplash/i.test(layout), 'forced native splash hide timers are forbidden');
need(layout.includes('holdNativeSplashAtModuleLoad();'), 'native splash must be held before first render');
need(fs.existsSync('app/index.tsx') && appShell.includes('<Stack.Screen name="index"'), 'lightweight startup route must cover route resolution under native splash');
forbid(appShell.includes('if (!effectiveRouteStable) return null;') || appShell.includes('if (!routeStable) return null;'), 'root navigator must not be removed while route settles');
need(appShell.includes('useRootNavigationState'), 'redirects must wait for the mounted root navigator');
need(reveal.includes('const [assetFilesReady, setAssetFilesReady] = useState(!shouldAnimate);'), 'real asset readiness must start false');
need(reveal.includes('decodedAssetCount >= EXPECTED_DECODED_ASSETS'), 'all layers must decode before splash handoff');
need(reveal.includes('onLoad={() => markAssetLoaded'), 'only successful image loads may count as ready');
forbid(reveal.includes('onLoadEnd='), 'onLoadEnd may count failed images as ready');
need(reveal.includes('getThreadHeightForMoonOffset(scene.threadStartHeight, moonTranslateY.value)'), 'thread height must follow moon position exactly');
need(reveal.includes('paper_moon_first_frame_ready'), 'Paper Moon must own native splash handoff');
need(reveal.includes('auth-paper-thread'), 'thread must be separate from moving moon body');
need(startupExperience.includes('<AuthPaperRevealGate active startWhenReady={routeReady}>'), 'global startup scene must wrap every destination');
need(appShell.includes('<StartupExperience routeReady='), 'AppShell must mount the global startup scene');
forbid(login.includes('AuthPaperRevealGate') || login.includes('playPaperMoonIntro'), 'login must not own or restart the startup scene');
need(reveal.includes('activateFallback'), 'failed assets must fall back instead of instantly closing the scene');
need(activity.includes('SplashScreenManager.registerOnActivity(this)'), 'Android native splash manager must be registered');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const splash = app.expo?.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
need(splash?.[1]?.image === './assets/images/splash-transparent.png', 'native splash must be background-only without a second moon logo');

if (failures.length) {
  console.error('verify:single-stage-auth-intro FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('verify:single-stage-auth-intro PASS — native splash → global Paper Moon → committed destination, with no intermediate React screen');
