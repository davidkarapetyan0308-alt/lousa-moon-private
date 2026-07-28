import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { InteractionManager, Platform, View, StyleSheet, useWindowDimensions, Text, Pressable } from 'react-native';

import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { useCycleStore, useUserStore } from '../store';
import { getServiceMode, getStartupConfigIssue, services } from '../services';
import { flushCycleSettingsSync } from '../services/cycleSettingsSync';
import { flushCycleSyncQueue } from '../services/cycleSync';
import { hideNativeSplashOnce, launchDevLog } from './launchCoordinator';
import { waitForStartupInteractionReady } from './startupGate';
import { traceStartup } from './startupTrace';
import { resolveStartupDestination } from './startupNavigation';
import { StartupExperience } from './StartupExperience';

/**
 * V9.0.5 startup rule: React must always render a visible screen.
 *
 * V9.0.4 fixed the native splash, but AppShell had two remaining startup risks:
 * 1) wrong relative imports (`../src/...`) from inside `src/bootstrap`, which can
 *    fail in the release bundle before the normal UI is mounted;
 * 2) NavigationWrapper could temporarily or permanently return null while stores
 *    hydrate/session refresh runs, producing a white screen after restart.
 *
 * The native splash remains held while persisted state resolves and redirects settle.
 * For unauthenticated users, AuthPaperReveal owns the handoff; for authenticated
 * users, this shell releases the splash after the stable navigation root is laid out.
 */


function LazyNotificationBootstrap() {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const isOnboarded = useUserStore((state) => state.isOnboarded);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void waitForStartupInteractionReady().then(() => {
      if (cancelled) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        try {
          // Notifications are non-critical and start only after the auth intro is complete.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const loaded = require('../components/NotificationBootstrap') as { NotificationBootstrap?: React.ComponentType; default?: React.ComponentType };
          setComponent(() => loaded.NotificationBootstrap || loaded.default || null);
        } catch {
          setComponent(null);
        }
      }, isOnboarded ? 1000 : 800);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isOnboarded]);

  return Component ? <Component /> : null;
}

function ThemeStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}


const SHOW_TECHNICAL_ERRORS = __DEV__ && process.env.EXPO_PUBLIC_SHOW_TECHNICAL_ERRORS === 'true';

function StartupRuntimeErrorScreen({
  message,
  details,
  onRetry,
  onSafeLogin,
}: {
  message: string;
  details?: string;
  onRetry: () => void;
  onSafeLogin: () => void;
}) {
  return (
    <View style={styles.configIssueContainer}>
      <View style={styles.configIssueCard}>
        <Text style={styles.configIssueEyebrow}>LOUSA MOON · startup recovery</Text>
        <Text style={styles.configIssueTitle}>Экран не загрузился с первой попытки</Text>
        <Text style={styles.configIssueMessage}>{SHOW_TECHNICAL_ERRORS ? message : 'Сохранённые данные не удалены. Можно повторить запуск или безопасно открыть вход.'}</Text>
        {SHOW_TECHNICAL_ERRORS && details ? <Text style={styles.configIssueDetails} numberOfLines={10}>{details}</Text> : null}
        <View style={styles.recoveryActions}>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.recoveryPrimaryButton}>
            <Text style={styles.recoveryPrimaryButtonText}>Повторить</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onSafeLogin} style={styles.recoverySecondaryButton}>
            <Text style={styles.recoverySecondaryButtonText}>Открыть вход безопасно</Text>
          </Pressable>
        </View>
        <Text style={styles.configIssueAction}>Данные цикла, Box и профиля при восстановлении не удаляются.</Text>
      </View>
    </View>
  );
}

type RuntimeBoundaryState = { error: string | null; details?: string; retryKey: number; automaticRecoveryUsed: boolean };

class RuntimeErrorBoundary extends React.Component<{ children: React.ReactNode }, RuntimeBoundaryState> {
  state: RuntimeBoundaryState = { error: null, retryKey: 0, automaticRecoveryUsed: false };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : 'Unknown runtime error.',
      details: SHOW_TECHNICAL_ERRORS && error instanceof Error ? error.stack : undefined,
    };
  }

  componentDidCatch(error: unknown) {
    traceStartup('STARTUP_FALLBACK', `runtime_error=${error instanceof Error ? error.message : String(error)}`);
    void hideNativeSplashOnce('runtime_error_boundary');

    // One automatic retry repairs presentation/session flags only. Sensitive cycle,
    // wellness and Box data remain untouched. A second failure stays visible with
    // manual recovery controls instead of entering a retry loop.
    if (!this.state.automaticRecoveryUsed) {
      useUserStore.setState((state) => ({
        theme: 'rose_gold',
        guestAuthFlowActive: false,
        sessionState: state.isGuestMode ? 'guest' : state.sessionState,
        sessionError: null,
      }));
      setTimeout(() => {
        this.setState((state) => ({
          error: null,
          details: undefined,
          retryKey: state.retryKey + 1,
          automaticRecoveryUsed: true,
        }));
      }, 80);
    }
  }

  retry = () => {
    this.setState((state) => ({ error: null, details: undefined, retryKey: state.retryKey + 1 }));
  };

  openSafeLogin = () => {
    useUserStore.setState({
      theme: 'rose_gold',
      isOnboarded: false,
      isDemoMode: false,
      isGuestMode: false,
      guestAuthFlowActive: false,
      sessionState: 'unauthenticated',
      sessionError: null,
    });
    this.setState((state) => ({ error: null, details: undefined, retryKey: state.retryKey + 1, automaticRecoveryUsed: true }));
  };

  render() {
    if (this.state.error) {
      return (
        <StartupRuntimeErrorScreen
          message={this.state.error}
          details={this.state.details}
          onRetry={this.retry}
          onSafeLogin={this.openSafeLogin}
        />
      );
    }
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

function NavigationCoordinator({ onStartupRouteReady }: { onStartupRouteReady: () => void }) {
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const navigationReady = Boolean(rootNavigationState?.key);
  const isOnboarded = useUserStore((state) => state.isOnboarded);
  const isDemoMode = useUserStore((state) => state.isDemoMode);
  const isGuestMode = useUserStore((state) => state.isGuestMode);
  const guestAuthFlowActive = useUserStore((state) => state.guestAuthFlowActive);
  const migrationReviewRequired = useCycleStore((state) => state.migrationReviewRequired);
  const sessionState = useUserStore((state) => state.sessionState);
  const [hydrated, setHydrated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [startupWarning, setStartupWarning] = useState<string | null>(null);
  const [backendRetryEpoch, setBackendRetryEpoch] = useState(0);
  const [backendRetrying, setBackendRetrying] = useState(false);
  const backendRetryAttemptRef = useRef(0);
  const lastRedirectRef = useRef<string | null>(null);
  const startupRouteSignaledRef = useRef(false);

  useEffect(() => {
    traceStartup('SESSION_RESTORE_STARTED');
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setHydrated(true);
      traceStartup('SESSION_RESTORE_FINISHED');
    };

    const slowWatchdog = setTimeout(() => {
      console.warn('[BOOT] store hydration is slower than expected');
    }, 900);
    const hardWatchdog = setTimeout(() => {
      if (finished) return;
      const warning = 'Защищённое хранилище ответило слишком медленно. Запуск продолжается с безопасными локальными значениями; сохранённые данные не удалены.';
      console.warn('[BOOT]', warning);
      traceStartup('STARTUP_FALLBACK', 'user_store_hydration_timeout');
      setStartupWarning(warning);
      finish();
    }, 6_000);

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = useUserStore.persist.onFinishHydration(finish);
      if (useUserStore.persist.hasHydrated()) finish();
    } catch (error) {
      const warning = error instanceof Error ? error.message : 'Store hydration failed.';
      console.warn('[BOOT] continuing after hydration setup failure', warning);
      traceStartup('STARTUP_FALLBACK', `hydration_setup=${warning}`);
      setStartupWarning(warning);
      finish();
    }

    return () => {
      clearTimeout(slowWatchdog);
      clearTimeout(hardWatchdog);
      unsubscribe?.();
    };
  }, []);

  // Resolve the local session without navigating. The root Stack is already mounted
  // on the first render; navigation is permitted only after rootNavigationState.key exists.
  useEffect(() => {
    if (!hydrated) return;
    if (isGuestMode) {
      useUserStore.getState().setSessionState('guest');
    } else if (isDemoMode) {
      useUserStore.getState().setSessionState('authenticated');
    } else if (!isOnboarded) {
      useUserStore.getState().setSessionState('unauthenticated');
    }
    setSessionChecked(true);
    const destination = isOnboarded ? 'authenticated' : 'unauthenticated';
    launchDevLog('local_session_resolved', `destination=${destination}`);
    traceStartup('INITIAL_ROUTE_RESOLVED', `destination=${destination}`);
    // StartupExperience owns this gate for every cold launch, including restored
    // sessions. Keeping ownership in one place prevents authenticated launches
    // from marking the intro complete before its first rendered frame.
  }, [hydrated, isDemoMode, isGuestMode, isOnboarded]);

  // Remote verification is intentionally deferred until the first screen is interactive.
  useEffect(() => {
    const refreshSession = services.auth.refreshSession;
    if (!hydrated || !sessionChecked || !isOnboarded || isDemoMode || isGuestMode || sessionState === 'local_limited_mode' || sessionState === 'backend_session_pending' || getServiceMode() !== 'api' || !refreshSession) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const interaction = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        void waitForStartupInteractionReady().then(() => {
          traceStartup('DEFERRED_BOOTSTRAP_STARTED', 'session_refresh');
          return refreshSession();
        })
          .then((result) => {
            if (cancelled) return;
            if (result.ok) {
              useUserStore.getState().setSessionState(
                result.data.sessionState || (result.data.backendSessionReady === false ? 'local_limited_mode' : 'authenticated'),
                result.data.limitedReason || null,
              );
              return;
            }
            if (result.error.code === 'UNAUTHORIZED' || result.error.code === 'INVALID_REFRESH_TOKEN' || result.error.code === 'FIREBASE_USER_MISSING') {
              useUserStore.setState({ isOnboarded: false, isDemoMode: false, sessionState: 'session_expired', sessionError: result.error.message });
            } else {
              useUserStore.getState().setSessionState('session_error', result.error.message);
            }
          })
          .catch((error: unknown) => {
            if (!cancelled) useUserStore.getState().setSessionState('session_error', error instanceof Error ? error.message : 'Session restore failed.');
          });
      }, 700);
    });
    return () => {
      cancelled = true;
      interaction.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, sessionChecked, isDemoMode, isGuestMode, isOnboarded, sessionState]);

  // A Firebase-authenticated user must not have to reopen the Google chooser when
  // Render/backend is waking up. Retry the pending server exchange in the background.
  useEffect(() => {
    const pending = sessionState === 'local_limited_mode' || sessionState === 'backend_session_pending';
    if (!pending || !services.auth.retryBackendSession || getServiceMode() !== 'api') {
      if (sessionState === 'authenticated') backendRetryAttemptRef.current = 0;
      return;
    }
    const delays = [5_000, 15_000, 30_000];
    const attempt = Math.min(backendRetryAttemptRef.current, delays.length - 1);
    const timer = setTimeout(() => {
      setBackendRetrying(true);
      void services.auth.retryBackendSession?.()
        .then((result) => {
          if (!result) return;
          if (result.ok) {
            const nextState = result.data.sessionState || (result.data.backendSessionReady === false ? 'local_limited_mode' : 'authenticated');
            useUserStore.getState().setSessionState(nextState, result.data.limitedReason || null);
            if (nextState === 'authenticated') {
              backendRetryAttemptRef.current = 0;
              return;
            }
          }
          backendRetryAttemptRef.current = Math.min(backendRetryAttemptRef.current + 1, delays.length - 1);
          setBackendRetryEpoch((value) => value + 1);
        })
        .finally(() => setBackendRetrying(false));
    }, delays[attempt]);
    return () => clearTimeout(timer);
  }, [backendRetryEpoch, sessionState]);

  useEffect(() => {
    if (!hydrated || !sessionChecked || !isOnboarded || isDemoMode || isGuestMode || getServiceMode() !== 'api') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const interaction = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        void waitForStartupInteractionReady().then(() => {
          traceStartup('DEFERRED_BOOTSTRAP_STARTED', 'cycle_sync');
          return Promise.allSettled([flushCycleSettingsSync(), flushCycleSyncQueue()]);
        });
      }, 1200);
    });
    return () => {
      interaction.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, sessionChecked, isOnboarded, isDemoMode, isGuestMode]);

  const guestMayUseAuth = isGuestMode && guestAuthFlowActive && segments[0] === 'auth';
  const desiredDestination = resolveStartupDestination({
    hydrated,
    sessionChecked,
    isOnboarded,
    isGuestMode,
    guestAuthFlowActive: guestMayUseAuth || guestAuthFlowActive,
    migrationReviewRequired,
    segments: segments as readonly string[],
  });
  // Expo Router requires the root navigator to be mounted before any imperative
  // navigation. AppShell renders Stack unconditionally; this controller also waits
  // for rootNavigationState.key before calling replace.
  useEffect(() => {
    if (!navigationReady || !hydrated || !sessionChecked) return;

    try {
      useCycleStore.getState().ensureLegacyMigration();
    } catch (error) {
      const warning = error instanceof Error ? error.message : 'Cycle migration check failed.';
      console.warn('[BOOT] migration recovery continues', warning);
      traceStartup('STARTUP_FALLBACK', `migration=${warning}`);
      setStartupWarning(warning);
    }

    if (!desiredDestination) {
      lastRedirectRef.current = null;
      return;
    }

    if (lastRedirectRef.current === desiredDestination) return;
    lastRedirectRef.current = desiredDestination;
    traceStartup('INITIAL_ROUTE_RESOLVED', `replace=${desiredDestination}`);

    const frame = requestAnimationFrame(() => {
      try {
        router.replace(desiredDestination as never);
      } catch (error) {
        lastRedirectRef.current = null;
        const warning = error instanceof Error ? error.message : 'Navigation redirect failed.';
        console.warn('[BOOT] navigation redirect postponed', warning);
        traceStartup('STARTUP_FALLBACK', `navigation=${warning}`);
        setStartupWarning(warning);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [desiredDestination, hydrated, navigationReady, router, sessionChecked]);

  // Retry a still-pending redirect only after the root navigator is ready. This
  // watchdog never bypasses route stability and therefore cannot reveal the wrong screen.
  useEffect(() => {
    if (!navigationReady || !desiredDestination) return;
    const timer = setTimeout(() => {
      lastRedirectRef.current = null;
      traceStartup('STARTUP_FALLBACK', `route_retry destination=${desiredDestination}`);
      try {
        router.replace(desiredDestination as never);
      } catch (error) {
        setStartupWarning(error instanceof Error ? error.message : 'Navigation retry failed.');
      }
    }, 3_000);
    return () => clearTimeout(timer);
  }, [desiredDestination, navigationReady, router]);

  useEffect(() => {
    // The Paper Moon must not wait for authentication, hydration or a redirect
    // to settle. The root Stack is already rendered underneath it, so two native
    // frames are sufficient to safely start the visible launch scene.
    if (!navigationReady || startupRouteSignaledRef.current) return;
    startupRouteSignaledRef.current = true;
    traceStartup('STARTUP_DESTINATION_READY', `root_stack segments=${segments.join('/') || 'index'}`);
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        traceStartup('STARTUP_ROUTE_COMMITTED', `segments=${segments.join('/') || 'index'}`);
        onStartupRouteReady();
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [navigationReady, onStartupRouteReady, segments]);

  return (
    <>
      {startupWarning ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть сообщение о восстановлении запуска"
          onPress={() => setStartupWarning(null)}
          style={styles.startupWarning}
        >
          <Text style={styles.startupWarningTitle}>Запуск восстановлен</Text>
          <Text style={styles.startupWarningBody}>{startupWarning}</Text>
        </Pressable>
      ) : null}
      {sessionState === 'local_limited_mode' || sessionState === 'backend_session_pending' || sessionState === 'session_error' ? (
        <View style={styles.limitedBanner} accessibilityRole="alert">
          <View style={styles.limitedBannerText}>
            <Text style={styles.limitedBannerTitle}>Серверная сессия не создана</Text>
            <Text style={styles.limitedBannerBody}>Локальные данные доступны, но синхронизация, адрес и Box временно заблокированы.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Повторить подключение к серверу"
            disabled={backendRetrying}
            onPress={() => {
              if (backendRetrying) return;
              setBackendRetrying(true);
              void services.auth.retryBackendSession?.()
                .then((result) => {
                  if (result?.ok) {
                    const nextState = result.data.sessionState || (result.data.backendSessionReady === false ? 'local_limited_mode' : 'authenticated');
                    useUserStore.getState().setSessionState(nextState, result.data.limitedReason || null);
                    if (nextState === 'authenticated') backendRetryAttemptRef.current = 0;
                  }
                })
                .finally(() => setBackendRetrying(false));
            }}
            style={styles.limitedBannerButton}
          >
            <Text style={styles.limitedBannerButtonText}>{backendRetrying ? 'Подключаем…' : 'Повторить'}</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
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
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth > 500;
  const startupConfigIssue = getStartupConfigIssue();
  const [startupRouteReady, setStartupRouteReady] = useState(false);
  const startupRouteReadyRef = useRef(false);
  const handleStartupRouteReady = useCallback(() => {
    if (startupRouteReadyRef.current) return;
    startupRouteReadyRef.current = true;
    setStartupRouteReady(true);
  }, []);

  // Expo Router normally signals the root Stack after two frames. This watchdog
  // is deliberately independent of auth and storage: it prevents a restored
  // Android process from keeping the Paper Moon handoff blocked forever.
  useEffect(() => {
    if (startupConfigIssue) return;
    const watchdog = setTimeout(() => {
      if (startupRouteReadyRef.current) return;
      traceStartup('STARTUP_FALLBACK', 'root_stack_frame_watchdog');
      handleStartupRouteReady();
    }, 1_600);
    return () => clearTimeout(watchdog);
  }, [handleStartupRouteReady, startupConfigIssue]);

  // The Stack is rendered unconditionally on the very first root-layout render.
  // Session hydration, redirects and splash coordination live in a sibling controller
  // and can never replace the navigator with null.
  const runtimeContent = (
    <View style={styles.navigationRoot}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#FFF8F5' },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/onboarding" />
        <Stack.Screen name="screens/help-assistant" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/profile" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/wellness-log" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/analytics" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/subscription" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/box-feedback" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/period-editor" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="screens/period-review" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/legal" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/address-map" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/debug" options={{ animation: 'slide_from_right' }} />
      </Stack>

      {startupConfigIssue ? (
        <View style={styles.configIssueOverlay}>
          <StartupConfigIssueScreen />
        </View>
      ) : (
        <>
          <NavigationCoordinator onStartupRouteReady={handleStartupRouteReady} />
          <LazyNotificationBootstrap />
        </>
      )}
    </View>
  );

  return (
    <RuntimeErrorBoundary>
      <ThemeProvider>
        <ThemeStatusBar />
        <StartupExperience routeReady={Boolean(startupConfigIssue) || startupRouteReady}>
          {isDesktopWeb ? (
            <View style={styles.webContainer}>
              <View style={styles.phoneFrame}>{runtimeContent}</View>
            </View>
          ) : runtimeContent}
        </StartupExperience>
      </ThemeProvider>
    </RuntimeErrorBoundary>
  );
}

const styles = StyleSheet.create({
  navigationRoot: { flex: 1, backgroundColor: '#FFF8F5' },
  configIssueOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2000, elevation: 30 },
  startupWarning: { position: 'absolute', left: 12, right: 12, bottom: 18, borderRadius: 16, padding: 12, backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#D9A35F', zIndex: 1200, elevation: 14 },
  startupWarningTitle: { fontFamily: 'sans-serif-medium', fontSize: 13, color: '#5B365F', marginBottom: 2 },
  startupWarningBody: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, color: '#655967' },
  recoveryActions: { gap: 10, marginBottom: 14 },
  recoveryPrimaryButton: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5B365F', paddingHorizontal: 16 },
  recoveryPrimaryButtonText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 14 },
  recoverySecondaryButton: { minHeight: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7FA', borderWidth: 1, borderColor: 'rgba(166,77,114,0.25)', paddingHorizontal: 16 },
  recoverySecondaryButtonText: { color: '#A64D72', fontFamily: 'sans-serif-medium', fontSize: 14 },
  limitedBanner: { position: 'absolute', left: 12, right: 12, top: 12, minHeight: 64, borderRadius: 16, padding: 12, backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#D9A35F', flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 1000, elevation: 12 },
  limitedBannerText: { flex: 1 },
  limitedBannerTitle: { fontFamily: 'sans-serif-medium', fontSize: 14, color: '#5B365F', marginBottom: 2 },
  limitedBannerBody: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, color: '#655967' },
  limitedBannerButton: { minWidth: 72, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5B365F', paddingHorizontal: 12 },
  limitedBannerButtonText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 13 },
  configIssueContainer: {
    flex: 1,
    backgroundColor: '#FFF8F5',
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
    backgroundColor: '#FFF8F5',
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
