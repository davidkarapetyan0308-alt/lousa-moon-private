import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ModalScreen, ScreenScroll } from '../../src/components/layout';
import { InlineMessage, SurfaceCard } from '../../src/components/ui';
import { getAuthProviderMode, getServiceMode, getStartupConfigIssue } from '../../src/services';
import { getNotificationSummary, readNotificationPermission } from '../../src/services/notifications';
import { useCycleStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';

const DEBUG_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_SHOW_TECHNICAL_ERRORS === 'true';

export default function DebugScreen() {
  const { colors } = useTheme();
  const user = useUserStore();
  const cycle = useCycleStore();
  const [permission, setPermission] = useState('checking');
  const issue = useMemo(() => getStartupConfigIssue(), []);

  useEffect(() => {
    readNotificationPermission().then(setPermission).catch(() => setPermission('unknown'));
  }, []);

  if (!DEBUG_ENABLED) {
    return (
      <ModalScreen title="LOUSA diagnostics" closeIcon="arrow_back">
        <ScreenScroll>
          <InlineMessage tone="warning" title="Недоступно" body="Диагностика доступна только в developer-сборке." />
        </ScreenScroll>
      </ModalScreen>
    );
  }

  const rows = [
    ['Service mode', getServiceMode()],
    ['Auth provider', getAuthProviderMode()],
    ['Session', user.sessionState],
    ['Guest mode', String(user.isGuestMode)],
    ['Onboarding complete', String(user.isOnboarded)],
    ['Notification permission', permission],
    ['Notifications enabled', String(getNotificationSummary().enabled)],
    ['Cycle start', cycle.lastPeriodStart || 'not set'],
    ['Cycle length', String(cycle.avgCycleLength)],
    ['Period length', String(cycle.avgPeriodLength)],
  ];

  return (
    <ModalScreen title="LOUSA diagnostics" closeIcon="arrow_back">
      <ScreenScroll>
        {issue ? (
          <InlineMessage tone="warning" title={`${issue.code}: ${issue.title}`} body={`${issue.message}\n${issue.action}\n${issue.details}`} />
        ) : (
          <InlineMessage tone="success" title="Runtime configuration OK" body="No startup configuration issue detected." />
        )}
        <SurfaceCard padding={16} style={styles.card}>
          {rows.map(([label, value]) => (
            <View key={label} style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
              <Text selectable style={[styles.value, { color: colors.onBackground }]}>{value}</Text>
            </View>
          ))}
        </SurfaceCard>
      </ScreenScroll>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16 },
  row: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 4 },
  label: { fontSize: 12, fontFamily: 'sans-serif-medium' },
  value: { fontSize: 14, lineHeight: 20, fontFamily: 'monospace' },
});
