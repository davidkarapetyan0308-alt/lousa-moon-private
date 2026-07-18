import React, { useEffect, useMemo, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet, useWindowDimensions, Text } from 'react-native';

import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { useCycleStore, useUserStore } from '../store';
import { getServiceMode, getStartupConfigIssue, services } from '../services';
import { flushCycleSettingsSync } from '../services/cycleSettingsSync';
import { flushCycleSyncQueue } from '../services/cycleSync';

/**
 * V9.0.5 startup rule: React must always render a visible screen.
 *
 * V9.0.4 fixed the native splash, but AppShell had two remaining startup risks:
 * 1) wrong relative imports (`../src/...`) from inside `src/bootstrap`, which can
 *    fail in the release bundle before the normal UI is mounted;
 * 2) NavigationWrapper could temporarily or permanently return null while stores
 *    hydrate/session refresh runs, producing a white screen after restart.
 *
 * This shell intentionally avoids Reanimated/custom splash on startup. The native
 * splash is hidden by app/_layout.tsx, and this component always returns either a
 * boot screen, a setup-error screen, or the real navigation tree.
 */


function LazyNotificationBootstrap() {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Notifications are non-critical. They must never block startup.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const loaded = require('../components/NotificationBootstrap') as { NotificationBootstrap?: React.ComponentType; default?: React.ComponentType };
        setComponent(() => loaded.NotificationBootstrap || loaded.default || null);
      } catch {
        setComponent(null);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return Component ? <Component /> : null;
}

function ThemeStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function BootScreen({ message = 'Готовим LOUSA MOON…' }: { message?: string }) {
  return (
    <View style={styles.bootContainer}>
      <View style={styles.bootCard}>
        <Text style={styles.bootMoon}>☾</Text>
        <Text style={styles.bootTitle}>LOUSA MOON</Text>
        <Text style={styles.bootMessage}>{message}</Text>
      </View>
    </View>
  );
}

function StartupRuntimeErrorScreen({ message, details }: { message: string; details?: string }) {
  return (
    <View style={styles.configIssueContainer}>
      <View style={styles.configIssueCard}>
        <Text style={styles.configIssueEyebrow}>LOUSA MOON · startup</Text>
        <Text style={styles.configIssueTitle}>Приложение запустилось, но экран не загрузился</Text>
        <Text style={styles.configIssueMessage}>{message}</Text>
        {details ? <Text style={styles.configIssueDetails}>{details}</Text> : null}
        <Text style={styles.configIssueAction}>Пришли этот текст ошибки вместе с APK-версией.</Text>
      </View>
    </View>
  );
}

class RuntimeErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null; details?: string }> {
  state: { error: string | null; details?: string } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : 'Unknown runtime error.',
      details: error instanceof Error ? error.stack : undefined,
    };
  }

  render() {
    if (this.state.error) {
      return <StartupRuntimeErrorScreen message={this.state.error} details={this.state.details} />;
    }
    return this.props.children;
  }
}

function NavigationWrapper({ children }: { children: React.ReactNode }) {
  console.log('[BOOT] NavigationWrapper render');
  const segments = useSegments();
  const router = useRouter();
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  const isDemoMode = useUserStore((s) => s.isDemoMode);
  const migrationReviewRequired = useCycleStore((s) => s.migrationReviewRequired);
  const [hydrated, setHydrated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let finished = false;
    const finish = () => {
      if (!finished) {
        finished = true;
        setHydrated(true);
      }
    };

    const watchdog = setTimeout(() => {
      console.warn('[BOOT] store hydration watchdog fired');
      finish();
    }, 900);
    let unsub: (() => void) | undefined;
    try {
      unsub = useUserStore.persist.onFinishHydration(finish);
      if (useUserStore.persist.hasHydrated()) finish();
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : 'Store hydration failed.');
      finish();
    }

    return () => {
      clearTimeout(watchdog);
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setSessionChecked(true);
    };

    const verifySession = async () => {
      const watchdog = setTimeout(() => {
        console.warn('[BOOT] session check watchdog fired');
        finish();
      }, 900);
      try {
        if (!isOnboarded || isDemoMode || getServiceMode() !== 'api' || !services.auth.refreshSession) {
          return;
        }
        const result = await Promise.race([
          services.auth.refreshSession().catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
        ]);
        if (!cancelled && result && !result.ok) {
          useUserStore.setState({ isOnboarded: false, isDemoMode: false });
        }
      } catch (error) {
        if (!cancelled) {
          setStartupError(error instanceof Error ? error.message : 'Session restore failed.');
        }
      } finally {
        clearTimeout(watchdog);
        finish();
      }
    };

    setSessionChecked(false);
    verifySession();
    return () => { cancelled = true; };
  }, [hydrated, isDemoMode, isOnboarded]);

  useEffect(() => {
    if (!hydrated || !sessionChecked || !isOnboarded || isDemoMode || getServiceMode() !== 'api') return;
    void Promise.allSettled([flushCycleSettingsSync(), flushCycleSyncQueue()]);
  }, [hydrated, sessionChecked, isOnboarded, isDemoMode]);

  useEffect(() => {
    if (!hydrated || !sessionChecked) return;
    try {
      useCycleStore.getState().ensureLegacyMigration();
      const inAuthGroup = segments[0] === 'auth';
      const inMigrationReview = segments.join('/') === 'screens/period-review';
      if (!isOnboarded && !inAuthGroup) {
        router.replace('/auth/login');
      } else if (isOnboarded && migrationReviewRequired && !inMigrationReview) {
        router.replace('/screens/period-review');
      } else if (isOnboarded && inAuthGroup) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : 'Navigation startup failed.');
    }
  }, [isOnboarded, migrationReviewRequired, segments, hydrated, sessionChecked, router]);

  if (startupError) return <StartupRuntimeErrorScreen message={startupError} />;
  if (!hydrated) return <BootScreen message="Загружаем данные…" />;
  if (!sessionChecked) return <BootScreen message="Проверяем сессию…" />;
  return <>{children}</>;
}

function StartupConfigIssueScreen() {
  const issue = getStartupConfigIssue();
  if (!issue) return null;

  return (
    <View style={styles.configIssueContainer}>
      <View style={styles.configIssueCard}>
        <Text style={styles.configIssueEyebrow}>LOUSA MOON · setup</Text>
        <Text style={styles.configIssueTitle}>{issue.title}</Text>
        <Text style={styles.configIssueMessage}>{issue.message}</Text>
        <Text style={styles.configIssueAction}>{issue.action}</Text>
        <Text style={styles.configIssueDetails}>{issue.details}</Text>
      </View>
    </View>
  );
}

export function AppShell() {
  console.log('[BOOT] AppShell render');
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth > 500;
  const startupConfigIssue = getStartupConfigIssue();

  const stackContent = useMemo(() => (
    <NavigationWrapper>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#FBF4F7' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/onboarding" />
        <Stack.Screen name="screens/help-assistant" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/profile" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/log-state" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/analytics" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/box-feedback" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/period-editor" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/period-review" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/legal" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/address-map" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </NavigationWrapper>
  ), []);

  return (
    <RuntimeErrorBoundary>
      <ThemeProvider>
        <ThemeStatusBar />
        {startupConfigIssue ? (
          <StartupConfigIssueScreen />
        ) : (
          <>
            <LazyNotificationBootstrap />
            {isDesktopWeb ? (
              <View style={styles.webContainer}>
                <View style={styles.phoneFrame}>{stackContent}</View>
              </View>
            ) : stackContent}
          </>
        )}
      </ThemeProvider>
    </RuntimeErrorBoundary>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: '#FBF4F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  bootCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  bootMoon: {
    fontFamily: Platform.select({ android: 'serif', default: 'System' }),
    fontSize: 58,
    color: '#A64D72',
    marginBottom: 10,
  },
  bootTitle: {
    fontFamily: Platform.select({ android: 'serif', default: 'System' }),
    fontSize: 32,
    letterSpacing: 4,
    color: '#5B365F',
    marginBottom: 10,
  },
  bootMessage: {
    fontFamily: Platform.select({ android: 'sans-serif', default: 'System' }),
    fontSize: 14,
    lineHeight: 20,
    color: '#655967',
    textAlign: 'center',
  },
  configIssueContainer: {
    flex: 1,
    backgroundColor: '#FBF4F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  configIssueCard: {
    width: '100%',
    maxWidth: 420,
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
  configIssueEyebrow: {
    fontFamily: 'sans-serif-medium',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#A64D72',
    marginBottom: 10,
  },
  configIssueTitle: {
    fontFamily: 'serif',
    fontSize: 30,
    lineHeight: 34,
    color: '#5B365F',
    marginBottom: 12,
  },
  configIssueMessage: {
    fontFamily: 'sans-serif',
    fontSize: 15,
    lineHeight: 22,
    color: '#211A24',
    marginBottom: 12,
  },
  configIssueAction: {
    fontFamily: 'sans-serif-medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#A64D72',
    marginBottom: 14,
  },
  configIssueDetails: {
    fontFamily: 'sans-serif',
    fontSize: 12,
    lineHeight: 18,
    color: '#655967',
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#05070c',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: (Platform.OS === 'web' ? '100vh' : '100%') as any,
  },
  phoneFrame: {
    width: 390,
    height: 844,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#FBF4F7',
    borderWidth: 10,
    borderColor: '#1e2022',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
});

export default AppShell;
