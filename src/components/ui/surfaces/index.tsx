import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { MaterialSymbol } from '../../MaterialSymbol';
import { useTheme } from '../../../theme/ThemeProvider';
import { LousaLayout, LousaPalette, LousaShadow, LousaTypography } from '../../../theme/designSystem';
import { PressScale } from '../PressScale';

export function HeroCard({
  children,
  tone = 'rose',
  style,
}: {
  children: React.ReactNode;
  tone?: 'rose' | 'neutral' | 'success' | 'night';
  style?: StyleProp<ViewStyle>;
}) {
  const { isDark } = useTheme();
  const config = {
    rose: isDark ? 'rgba(166,77,114,0.14)' : '#FBF1F5',
    neutral: isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF',
    success: isDark ? 'rgba(79,117,99,0.16)' : '#EDF5F1',
    night: LousaPalette.nightSoft,
  }[tone];
  return <View style={[styles.hero, { backgroundColor: config, borderColor: isDark ? LousaPalette.lineDark : LousaPalette.line }, style]}>{children}</View>;
}

export function SectionSurface({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { isDark } = useTheme();
  return (
    <View
      style={[
        styles.section,
        padded && styles.sectionPadded,
        { backgroundColor: isDark ? 'rgba(31,29,42,0.96)' : '#FFFFFF', borderColor: isDark ? LousaPalette.lineDark : LousaPalette.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ListSection({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <SectionSurface padded={false} style={style}>{children}</SectionSurface>;
}

export function ListRow({
  title,
  detail,
  icon,
  onPress,
  destructive,
  trailing,
  divider = true,
}: {
  title: string;
  detail?: string;
  icon?: string;
  onPress?: () => void;
  destructive?: boolean;
  trailing?: React.ReactNode;
  divider?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const content = (
    <>
      {icon ? <View style={[styles.listIcon, { backgroundColor: destructive ? LousaPalette.dangerSoft : (isDark ? 'rgba(217,133,165,0.14)' : '#F8E7ED') }]}><MaterialSymbol name={icon} size={20} color={destructive ? LousaPalette.danger : (isDark ? '#F1B7CD' : LousaPalette.berry)} /></View> : null}
      <View style={styles.listCopy}>
        <Text style={[styles.listTitle, { color: destructive ? LousaPalette.danger : colors.onBackground }]}>{title}</Text>
        {detail ? <Text style={[styles.listDetail, { color: colors.onSurfaceVariant }]}>{detail}</Text> : null}
      </View>
      {trailing ?? (onPress ? <MaterialSymbol name="chevron_right" size={20} color={colors.outline} /> : null)}
    </>
  );
  const commonStyle = [styles.listRow, divider && { borderBottomColor: colors.outlineVariant, borderBottomWidth: StyleSheet.hairlineWidth }];
  if (!onPress) return <View style={commonStyle}>{content}</View>;
  return <PressScale onPress={onPress} style={commonStyle}>{content}</PressScale>;
}

export function StatusBanner({
  title,
  body,
  icon = 'info',
  tone = 'neutral',
}: {
  title: string;
  body?: string;
  icon?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const { colors, isDark } = useTheme();
  const config = {
    neutral: { bg: isDark ? 'rgba(255,255,255,0.045)' : '#F7F3F5', fg: colors.onSurfaceVariant },
    success: { bg: isDark ? 'rgba(79,117,99,0.16)' : LousaPalette.successSoft, fg: isDark ? '#9FC5B1' : LousaPalette.success },
    warning: { bg: isDark ? 'rgba(163,111,61,0.16)' : LousaPalette.warningSoft, fg: isDark ? '#D9B28C' : LousaPalette.warning },
    danger: { bg: isDark ? 'rgba(178,76,92,0.16)' : LousaPalette.dangerSoft, fg: isDark ? '#FFB3C0' : LousaPalette.danger },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: config.bg }]}>
      <MaterialSymbol name={icon} size={19} color={config.fg} />
      <View style={styles.listCopy}>
        <Text style={[styles.bannerTitle, { color: config.fg }]}>{title}</Text>
        {body ? <Text style={[styles.bannerBody, { color: colors.onSurfaceVariant }]}>{body}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: LousaLayout.heroRadius,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
    ...LousaShadow.soft,
  },
  section: { borderRadius: LousaLayout.cardRadius, borderWidth: 1, overflow: 'hidden' },
  sectionPadded: { padding: 18 },
  listRow: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  listIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { ...LousaTypography.secondary, fontFamily: 'sans-serif-medium' },
  listDetail: { ...LousaTypography.caption, marginTop: 2 },
  banner: { minHeight: 56, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bannerTitle: { fontFamily: 'sans-serif-medium', fontSize: 13.5, lineHeight: 18 },
  bannerBody: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 2 },
});
