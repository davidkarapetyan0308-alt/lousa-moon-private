import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MaterialSymbol } from '../../MaterialSymbol';
import { useTheme } from '../../../theme/ThemeProvider';
import { LousaPalette } from '../../../theme/designSystem';
import { PrimaryButton, SecondaryButton } from '../buttons';

export function InlineMessage({
  title,
  body,
  tone = 'neutral',
}: {
  title?: string;
  body: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const { colors, isDark } = useTheme();
  const config = {
    neutral: { icon: 'info', bg: isDark ? 'rgba(255,255,255,0.045)' : '#F7F3F5', fg: colors.onSurfaceVariant },
    success: { icon: 'check_circle', bg: isDark ? 'rgba(79,117,99,0.16)' : LousaPalette.successSoft, fg: isDark ? '#9FC5B1' : LousaPalette.success },
    warning: { icon: 'priority_high', bg: isDark ? 'rgba(163,111,61,0.16)' : LousaPalette.warningSoft, fg: isDark ? '#D9B28C' : LousaPalette.warning },
    danger: { icon: 'error', bg: isDark ? 'rgba(178,76,92,0.16)' : LousaPalette.dangerSoft, fg: isDark ? '#FFB3C0' : LousaPalette.danger },
  }[tone];
  return (
    <View style={[styles.inline, { backgroundColor: config.bg }]}>
      <MaterialSymbol name={config.icon} size={18} color={config.fg} />
      <View style={styles.copy}>
        {title ? <Text style={[styles.title, { color: config.fg }]}>{title}</Text> : null}
        <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{body}</Text>
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon = 'inbox',
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  body: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.state}>
      <View style={styles.icon}><MaterialSymbol name={icon} size={26} color={LousaPalette.berry} /></View>
      <Text style={[styles.stateTitle, { color: colors.onBackground }]}>{title}</Text>
      <Text style={[styles.stateBody, { color: colors.onSurfaceVariant }]}>{body}</Text>
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
      {secondaryLabel && onSecondary ? <SecondaryButton label={secondaryLabel} onPress={onSecondary} /> : null}
    </View>
  );
}

export function ErrorState(props: Omit<React.ComponentProps<typeof EmptyState>, 'icon'>) {
  return <EmptyState {...props} icon="error_outline" />;
}

const styles = StyleSheet.create({
  inline: { minHeight: 52, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'sans-serif-medium', fontSize: 13, lineHeight: 18 },
  body: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17 },
  state: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#F8E7ED', alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontFamily: 'sans-serif-medium', fontSize: 19, lineHeight: 25, textAlign: 'center' },
  stateBody: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420 },
});
