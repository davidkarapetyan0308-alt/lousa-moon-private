import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppShell from '../src/bootstrap/AppShell';
import { hideNativeSplashOnce, holdNativeSplashAtModuleLoad } from '../src/bootstrap/launchCoordinator';
import { traceStartup } from '../src/bootstrap/startupTrace';

// This must execute before the first React render. The native splash stays visible
// until the real destination (Paper Moon auth scene or authenticated app) is laid out.
holdNativeSplashAtModuleLoad();

type LoadedShell = React.ComponentType;

class StartupErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null; details?: string }
> {
  state: { error: string | null; details?: string } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : 'Unknown runtime error.',
      details: error instanceof Error ? error.stack : undefined,
    };
  }

  componentDidCatch() {
    void hideNativeSplashOnce('root_error_boundary');
  }

  render() {
    if (this.state.error) {
      return <StartupFallback message={this.state.error} details={this.state.details} />;
    }
    return this.props.children;
  }
}

function StartupFallback({ message, details }: { message: string; details?: string }) {
  useEffect(() => {
    void hideNativeSplashOnce('startup_fallback');
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>LOUSA MOON · startup</Text>
        <Text style={styles.title}>Приложение не смогло открыть основной экран</Text>
        <Text style={styles.message}>{message}</Text>
        {details && __DEV__ ? <Text style={styles.details}>{details}</Text> : null}
        <Text style={styles.hint}>Закрой приложение и открой снова. Сохранённые данные не удалены.</Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    traceStartup('ROOT_LAYOUT_RENDER');
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StartupErrorBoundary>
        <AppShell />
      </StartupErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8F5' },
  nativeSplashBackdrop: { flex: 1, backgroundColor: '#FFF8F5' },
  container: {
    flex: 1,
    backgroundColor: '#FFF8F5',
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
