import 'react-native-gesture-handler';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


type SplashScreenModule = {
  preventAutoHideAsync: () => Promise<void>;
  hideAsync: () => Promise<void>;
};

let splashModule: SplashScreenModule | null | undefined;

function getSplashScreen(): SplashScreenModule | null {
  if (splashModule !== undefined) return splashModule;
  try {
    // Lazy-load splash APIs so a native-module issue cannot stop the root fallback from rendering.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    splashModule = require('expo-splash-screen') as SplashScreenModule;
  } catch {
    splashModule = null;
  }
  return splashModule;
}

/**
 * Ultra-safe root layout.
 *
 * The previous V9 builds imported stores/services before the native splash could be
 * hidden. Any import-time error or a hanging persisted storage hydration kept Android
 * on the native crescent splash forever. This file intentionally imports only very
 * small, low-risk modules. The real app shell is required after the first render, and
 * the native splash is hidden through a watchdog even if the app shell fails.
 */

function preventNativeSplashSafely() {
  // LOUSA V10.4.1 BOOT UNFREEZE FIX:
  // intentionally disabled. Holding the native splash is dangerous in release builds:
  // if JS/Firebase/Auth crashes before hideAsync(), Android stays forever on the moon.
  console.log('[BOOT] preventAutoHideAsync skipped by boot-unfreeze-ready build');
}

preventNativeSplashSafely();

function hideNativeSplashSafely() {
  console.log('[BOOT] hideNativeSplashSafely called');
  try {
    const splash = getSplashScreen();
    if (!splash) return;
    const result = splash.hideAsync();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // Safe no-op. The app must render a React fallback even if splash APIs fail.
  }
}

// JS-level watchdog: once the bundle starts, never allow the native splash to remain
// visible forever. Multiple calls are harmless across platforms.
setTimeout(hideNativeSplashSafely, 250);
setTimeout(hideNativeSplashSafely, 900);
setTimeout(hideNativeSplashSafely, 1800);

type LoadedShell = React.ComponentType;


class StartupErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null; details?: string }> {
  state: { error: string | null; details?: string } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : 'Unknown runtime error.',
      details: error instanceof Error ? error.stack : undefined,
    };
  }

  componentDidCatch() {
    hideNativeSplashSafely();
  }

  render() {
    if (this.state.error) {
      return <StartupFallback message={this.state.error} details={this.state.details} />;
    }
    return this.props.children;
  }
}

function StartupFallback({ message, details }: { message: string; details?: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>LOUSA MOON · startup</Text>
        <Text style={styles.title}>Приложение запустилось, но оболочка не загрузилась</Text>
        <Text style={styles.message}>{message}</Text>
        {details ? <Text style={styles.details}>{details}</Text> : null}
        <Text style={styles.hint}>
          Удали старую версию приложения с телефона полностью и установи свежий APK. Если экран повторится, пришли этот текст ошибки.
        </Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [Shell, setShell] = useState<LoadedShell | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootDetails, setBootDetails] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const resolvedRef = useRef(false);

  useEffect(() => {
    console.log('[BOOT] RootLayout mounted');
    hideNativeSplashSafely();
    const runtime = globalThis as typeof globalThis & { ErrorUtils?: { getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void); setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void } };
    const previousHandler = runtime.ErrorUtils?.getGlobalHandler?.();
    runtime.ErrorUtils?.setGlobalHandler?.((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error || 'Unknown fatal JS error');
      const stack = error instanceof Error ? error.stack || undefined : undefined;
      hideNativeSplashSafely();
      if (mountedRef.current) {
        resolvedRef.current = true;
        setShell(null);
        setBootError(message);
        setBootDetails(stack || null);
      }
      if (__DEV__ && previousHandler) previousHandler(error, true);
    });
    return () => {
      if (previousHandler) runtime.ErrorUtils?.setGlobalHandler?.(previousHandler);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    hideNativeSplashSafely();

    const timeout = setTimeout(() => {
      console.warn('[BOOT] AppShell load timeout. Showing startup fallback instead of endless splash.');
      if (!mountedRef.current || resolvedRef.current) return;
      resolvedRef.current = true;
      hideNativeSplashSafely();
      setBootError('Загрузка заняла слишком много времени. Native splash отключён, поэтому приложение больше не должно висеть на луне.');
    }, 2500);

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      console.log('[BOOT] requiring AppShell');
      const loaded = require('../src/bootstrap/AppShell') as { default?: LoadedShell; AppShell?: LoadedShell };
      const LoadedAppShell = loaded.default || loaded.AppShell;
      if (!LoadedAppShell) throw new Error('AppShell export was not found.');
      console.log('[BOOT] AppShell loaded');
      if (mountedRef.current) {
        resolvedRef.current = true;
        setShell(() => LoadedAppShell);
      }
    } catch (error) {
      console.error('[BOOT] AppShell require failed', error);
      if (mountedRef.current) {
        resolvedRef.current = true;
        setBootError(error instanceof Error ? error.message : 'Unknown startup error.');
        setBootDetails(error instanceof Error ? error.stack || null : null);
      }
    } finally {
      hideNativeSplashSafely();
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
    };
  // Intentionally run once. Shell/bootError are read only for watchdog copy.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('[BOOT] RootLayout mounted');
    hideNativeSplashSafely();
  }, [Shell, bootError]);

  const content = useMemo(() => {
    if (Shell) return <StartupErrorBoundary><Shell /></StartupErrorBoundary>;
    if (bootError) return <StartupFallback message={bootError} details={bootDetails || undefined} />;
    return <StartupFallback message="Загружаем безопасную оболочку приложения…" />;
  }, [Shell, bootError, bootDetails]);

  return <GestureHandlerRootView style={styles.root}>{content}</GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FBF4F7',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBF4F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 28,
    backgroundColor: '#FFFDFE',
    borderWidth: 1,
    borderColor: 'rgba(166, 77, 114, 0.16)',
    padding: 22,
    shadowColor: '#5B365F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  eyebrow: {
    fontFamily: Platform.select({ android: 'sans-serif-medium', default: 'System' }),
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#A64D72',
    marginBottom: 10,
  },
  title: {
    fontFamily: Platform.select({ android: 'serif', default: 'System' }),
    fontSize: 28,
    lineHeight: 34,
    color: '#211A24',
    marginBottom: 12,
  },
  message: {
    fontFamily: Platform.select({ android: 'sans-serif', default: 'System' }),
    fontSize: 15,
    lineHeight: 22,
    color: '#211A24',
    marginBottom: 12,
  },
  details: {
    fontFamily: Platform.select({ android: 'monospace', default: 'Courier' }),
    fontSize: 11,
    lineHeight: 16,
    color: '#A8465E',
    marginBottom: 12,
  },
  hint: {
    fontFamily: Platform.select({ android: 'sans-serif', default: 'System' }),
    fontSize: 13,
    lineHeight: 19,
    color: '#655967',
  },
});
