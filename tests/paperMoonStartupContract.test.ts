import fs from 'node:fs';

describe('Paper Moon Android startup contract', () => {
  const layout = fs.readFileSync('app/_layout.tsx', 'utf8');
  const shell = fs.readFileSync('src/bootstrap/AppShell.tsx', 'utf8');
  const startupExperience = fs.readFileSync('src/bootstrap/StartupExperience.tsx', 'utf8');
  const reveal = fs.readFileSync('src/features/auth/components/AuthPaperReveal.tsx', 'utf8');
  const activity = fs.readFileSync('android/app/src/main/java/com/lousa/moon/MainActivity.kt', 'utf8');
  const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

  it('holds native splash before the first React render', () => {
    expect(layout).toContain('holdNativeSplashAtModuleLoad();');
    expect(layout).not.toMatch(/setTimeout\(hideNativeSplash/i);
  });

  it('does not render an intermediate React startup screen while route settles', () => {
    expect(shell).toContain('<Stack');
    expect(shell).not.toContain('if (!routeStable) return null;');
    expect(shell).toContain('<StartupExperience routeReady=');
    expect(shell).not.toContain('markIntroNotRequired');
    expect(shell).not.toContain('requireAuthIntroCompletion');
    expect(startupExperience).toContain('<AuthPaperRevealGate active startWhenReady={routeReady}>');
    expect(shell).not.toContain('function StartupCanvas');
    expect(shell).not.toMatch(/Проверяем сессию|Начинаем сессию|Загружаем данные/);
  });

  it('waits for bundled files, image decode, and layout before hiding splash', () => {
    expect(reveal).toContain('Asset.loadAsync(AUTH_INTRO_ASSETS)');
    expect(reveal).toContain('decodedAssetCount >= EXPECTED_DECODED_ASSETS');
    expect(reveal).toContain('onLoad={() => markAssetLoaded');
    expect(reveal).not.toContain('onLoadEnd=');
    expect(reveal).toContain("hideNativeSplashOnce('paper_moon_first_frame_ready')");
    expect(reveal).toContain('activateFallback');
    expect(reveal).toContain('assetRetryEpoch');
    expect(reveal).toContain('AUTH_PAPER_MOON_ASSET_DECODE_TIMEOUT_MS');
    expect(reveal).toContain("activateFallback(missing, 'decode_timeout')");
    expect(reveal).toContain('AUTH_PAPER_MOON_LAYOUT_TIMEOUT_MS');
    expect(reveal).toContain('AUTH_PAPER_MOON_SPLASH_HANDOFF_TIMEOUT_MS');
    expect(reveal).toContain('native_splash_handoff_failed_continue_intro');
    expect(reveal).not.toContain("finishOnce('fallback')");
    expect(reveal).not.toContain("finishOnce('emergency')");
  });

  it('starts the Paper Moon from the first root Stack frame, not delayed auth state', () => {
    expect(shell).toContain('if (!navigationReady || startupRouteSignaledRef.current) return;');
    expect(shell).toContain('root_stack_frame_watchdog');
    expect(reveal).toContain('const launchReady = shouldAnimate && assetFilesReady');
    expect(reveal).not.toContain('const launchReady = shouldAnimate && startWhenReady');
  });

  it('uses a rope-anchored moon instead of moving the old combined image', () => {
    expect(reveal).not.toContain('paper-moon.png');
    expect(reveal).toContain('theatre/paper-moon-theatre.png');
    expect(reveal).toContain('CLOUD_CENTRE');
    expect(reveal).toContain('testID="auth-paper-thread"');
    expect(reveal).toContain('getThreadHeightForMoonOffset(scene.threadStartHeight, moonTranslateY.value)');
    expect(reveal).toContain('<Text style={styles.brandName}>LOUSA</Text>');
  });

  it('uses a background-only native splash without a second moon logo', () => {
    const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    const splash = app.expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
    expect(splash?.[1]?.image).toBe('./assets/images/splash-transparent.png');
  });

  it('registers the native Android splash theme and manager', () => {
    expect(activity).toContain('SplashScreenManager.registerOnActivity(this)');
    expect(manifest).toContain('android:theme="@style/Theme.App.SplashScreen"');
  });
});
