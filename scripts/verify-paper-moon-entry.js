const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const errors = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));

const revealPath = 'src/features/auth/components/AuthPaperReveal.tsx';
const startupExperiencePath = 'src/bootstrap/StartupExperience.tsx';
const timelinePath = 'src/features/auth/components/authPaperRevealTimeline.ts';
const loginPath = 'app/auth/login.tsx';
const layoutPath = 'app/_layout.tsx';
const shellPath = 'src/bootstrap/AppShell.tsx';
const coordinatorPath = 'src/bootstrap/launchCoordinator.ts';
const activityPath = 'android/app/src/main/java/com/lousa/moon/MainActivity.kt';
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const appJsonPath = 'app.json';
const testPath = 'tests/authPaperRevealTimeline.test.ts';
const assets = [
  'assets/images/auth/paper-intro/paper-moon-body.png',
  'assets/images/auth/paper-intro/cloud-layered.png',
  'assets/images/auth/paper-intro/cloud-cluster.png',
  'assets/images/auth/paper-intro/cloud-wide.png',
  'assets/images/auth/paper-intro/cloud-simple.png',
];

for (const file of [revealPath, startupExperiencePath, timelinePath, loginPath, layoutPath, shellPath, coordinatorPath, activityPath, manifestPath, appJsonPath, testPath]) {
  if (!exists(file)) errors.push(`${file} is missing`);
}
for (const asset of assets) {
  if (!exists(asset)) errors.push(`${asset} is missing`);
  else if (fs.statSync(path.join(root, asset)).size < 10_000) errors.push(`${asset} looks unexpectedly small`);
}

if (!errors.length) {
  const reveal = read(revealPath);
  const startupExperience = read(startupExperiencePath);
  const timeline = read(timelinePath);
  const login = read(loginPath);
  const layout = read(layoutPath);
  const shell = read(shellPath);
  const coordinator = read(coordinatorPath);
  const activity = read(activityPath);
  const manifest = read(manifestPath);
  const appJson = JSON.parse(read(appJsonPath));

  const parseTimelineDuration = (name) => Number(timeline.match(new RegExp(`${name}:\\s*\\{[\\s\\S]*?totalMs:\\s*([\\d_]+)`))?.[1]?.replace(/_/g, ''));
  const normalTotal = parseTimelineDuration('normal');
  const reducedTotal = parseTimelineDuration('reduced');
  const fallbackTotal = parseTimelineDuration('fallback');
  const emergency = Number(timeline.match(/AUTH_PAPER_MOON_EMERGENCY_FINISH_MS\s*=\s*(\d+)/)?.[1]);
  const decodeTimeout = Number(timeline.match(/AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS\s*=\s*(\d+)/)?.[1]);
  const layoutTimeout = Number(timeline.match(/AUTH_PAPER_MOON_LAYOUT_TIMEOUT_MS\s*=\s*(\d+)/)?.[1]);
  const splashHandoffTimeout = Number(timeline.match(/AUTH_PAPER_MOON_SPLASH_HANDOFF_TIMEOUT_MS\s*=\s*(\d+)/)?.[1]);

  if (!Number.isFinite(normalTotal) || normalTotal < 2_000 || normalTotal > 3_000) errors.push(`normal auth intro must last 2.0-3.0 seconds; got ${normalTotal || 'unknown'} ms`);
  if (!Number.isFinite(reducedTotal) || reducedTotal < 1_800 || reducedTotal > 2_200) errors.push(`reduced motion must hold for 1.8-2.2 seconds; got ${reducedTotal || 'unknown'} ms`);
  if (!Number.isFinite(fallbackTotal) || fallbackTotal < 1_800) errors.push(`fallback scene must stay visible for at least 1.8 seconds; got ${fallbackTotal || 'unknown'} ms`);
  if (!Number.isFinite(emergency) || emergency <= normalTotal) errors.push('emergency fallback must be later than normal animation');
  if (!Number.isFinite(decodeTimeout) || decodeTimeout <= 0 || decodeTimeout > 2_000) errors.push('asset decode fallback must happen within two seconds');
  if (!Number.isFinite(layoutTimeout) || layoutTimeout <= 0 || layoutTimeout > 500) errors.push('layout fallback must happen within 500ms');
  if (!Number.isFinite(splashHandoffTimeout) || splashHandoffTimeout <= 0 || splashHandoffTimeout > 1_000) errors.push('native splash handoff must be bounded to one second');

  if (!layout.includes('holdNativeSplashAtModuleLoad();')) errors.push('native splash is not held at module load');
  if (/setTimeout\(hideNativeSplash/i.test(layout)) errors.push('root contains forbidden forced splash-hide timer');
  if (!coordinator.includes('SplashScreen.preventAutoHideAsync()')) errors.push('preventAutoHideAsync is missing');
  if (!coordinator.includes('SplashScreen.hideAsync()')) errors.push('async splash hide coordinator is missing');
  if (!coordinator.includes('SplashScreen.hide();')) errors.push('sync splash hide fallback is missing');
  if (!coordinator.includes('hidden = false;')) errors.push('failed splash hide must leave the hidden flag false');
  if (coordinator.includes('// A failed duplicate hide must not keep the app locked forever.')) errors.push('legacy false-success splash handling is still present');
  if (!activity.includes('SplashScreenManager.registerOnActivity(this)')) errors.push('Android Activity does not register Expo splash manager');
  if (!manifest.includes('android:theme="@style/Theme.App.SplashScreen"')) errors.push('MainActivity is not using splash theme');

  if (!startupExperience.includes('<AuthPaperRevealGate active startWhenReady={routeReady}>')) errors.push('global StartupExperience must own the Paper Moon scene');
  if (!shell.includes('<StartupExperience routeReady=')) errors.push('AppShell must mount the global StartupExperience');
  if (shell.includes('markIntroNotRequired') || shell.includes('requireAuthIntroCompletion')) errors.push('AppShell must not compete with StartupExperience for intro completion');
  if (login.includes('AuthPaperRevealGate') || login.includes('playPaperMoonIntro')) errors.push('login must not own the startup scene');
  if (!exists('app/index.tsx') || !shell.includes('<Stack.Screen name="index"')) errors.push('lightweight startup route is missing under native splash');
  if (shell.includes('if (!effectiveRouteStable) return null;') || shell.includes('if (!routeStable) return null;')) errors.push('root navigator must never be conditionally removed');
  if (!shell.includes('useRootNavigationState')) errors.push('redirects are not gated by root navigator readiness');
  if (!shell.includes('if (!navigationReady || startupRouteSignaledRef.current) return;')) errors.push('Paper Moon root-frame signal must not wait for auth route stability');
  if (!shell.includes('root_stack_frame_watchdog')) errors.push('root Stack launch watchdog is missing');
  if (shell.includes('function StartupCanvas')) errors.push('old StartupCanvas still exists');
  if (shell.includes('Проверяем сессию') || shell.includes('Начинаем сессию') || shell.includes('Загружаем данные')) errors.push('visible startup copy is still present');

  if (!reveal.includes('useState(!shouldAnimate)')) errors.push('asset file readiness must start false while intro is active');
  if (!reveal.includes('Asset.loadAsync(AUTH_INTRO_ASSETS)')) errors.push('bundled asset loading is missing');
  if (!reveal.includes('onLoad={() => markAssetLoaded')) errors.push('successful image load readiness is not observed');
  if (reveal.includes('onLoadEnd=')) errors.push('onLoadEnd must not count failed images as ready');
  if (!reveal.includes('onError={(event) => handleAssetFailure')) errors.push('image load failures are not handled');
  if (!reveal.includes('decodedAssetCount >= EXPECTED_DECODED_ASSETS')) errors.push('animation does not wait for all decoded layers');
  if (!reveal.includes('startWhenReady')) errors.push('Paper Moon must keep a root-frame handoff gate');
  if (!reveal.includes('const launchReady = shouldAnimate && assetFilesReady')) errors.push('Paper Moon must begin independently of auth route readiness');
  if (reveal.includes('const launchReady = shouldAnimate && startWhenReady')) errors.push('Paper Moon is still blocked by route readiness');
  if (!reveal.includes("activateFallback(missing, 'decode_timeout')")) errors.push('decoded image timeout fallback is missing');
  if (!reveal.includes('native_splash_handoff_failed_continue_intro')) errors.push('native splash failure must continue the Paper Moon timeline');
  if (reveal.includes("finishOnce('fallback')")) errors.push('native splash failure must not instantly remove Paper Moon');
  if (!reveal.includes('activateFallback')) errors.push('failed assets must use a fallback scene');
  if (!reveal.includes('assetRetryEpoch')) errors.push('failed assets must be retried before fallback');
  if (reveal.includes("finishOnce('emergency')")) errors.push('asset failures must not instantly finish the scene');
  if (!reveal.includes("hideNativeSplashOnce('paper_moon_first_frame_ready')")) errors.push('splash is not handed directly to Paper Moon first frame');
  if (!reveal.includes('testID="auth-paper-thread"')) errors.push('separate fixed thread layer is missing');
  if (!reveal.includes('getThreadHeightForMoonOffset(scene.threadStartHeight, moonTranslateY.value)')) errors.push('thread height is not derived from moon position');
  if (reveal.includes('paper-moon.png')) errors.push('old combined moon-and-long-thread asset is still referenced');
  if (!reveal.includes("from 'react-native-reanimated'")) errors.push('Reanimated implementation is required');
  const splashPlugin = appJson.expo?.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
  if (splashPlugin?.[1]?.image !== './assets/images/splash-transparent.png') errors.push('native splash must be background-only and use splash-transparent.png');
  if (!exists('assets/images/splash-transparent.png')) errors.push('transparent splash asset is missing');
  if (/duration:\s*240/.test(reveal)) errors.push('old 240ms reduced-motion jump is present');
}

if (errors.length) {
  console.error('verify:paper-moon-entry FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('verify:paper-moon-entry PASS — global Paper Moon starts from the root Stack frame and degrades through a calm fallback');
