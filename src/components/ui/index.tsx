import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewProps,
  ViewStyle,
  StyleProp,
  PressableProps,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialSymbol } from '../MaterialSymbol';
import { useTheme } from '../../theme/ThemeProvider';
import { LousaLayout, LousaPalette, LousaShadow } from '../../theme/designSystem';
import { Motion } from '../../theme/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressScale({
  children,
  onPress,
  style,
  disabled,
  haptic = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityHint,
  testID,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityState?: PressableProps['accessibilityState'];
  accessibilityHint?: string;
  testID?: string;
  hitSlop?: PressableProps['hitSlop'];
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled) }}
      testID={testID}
      hitSlop={hitSlop ?? 6}
      disabled={disabled}
      onPressIn={() => {
        if (reducedMotion) {
          opacity.value = withTiming(0.82, { duration: Motion.duration.instant });
          return;
        }
        scale.value = withSpring(0.985, Motion.spring.press);
        opacity.value = withTiming(0.92, { duration: Motion.duration.instant });
      }}
      onPressOut={() => {
        scale.value = reducedMotion ? 1 : withSpring(1, Motion.spring.press);
        opacity.value = withTiming(1, { duration: Motion.duration.instant });
      }}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={[animatedStyle, style, disabled && { opacity: 0.45 }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function SurfaceCard({
  children,
  style,
  padding = 18,
  tone = 'default',
  ...props
}: ViewProps & {
  padding?: number;
  tone?: 'default' | 'accent' | 'night' | 'flat';
}) {
  const { isDark } = useTheme();
  const backgroundColor = tone === 'night'
    ? LousaPalette.nightSoft
    : tone === 'accent'
      ? (isDark ? 'rgba(166,77,114,0.16)' : '#FBF4F7')
      : tone === 'flat'
        ? 'transparent'
        : (isDark ? 'rgba(31,29,42,0.96)' : '#FFFFFF');

  return (
    <View
      {...props}
      style={[
        styles.surfaceCard,
        {
          padding,
          backgroundColor,
          borderColor: isDark ? LousaPalette.lineDark : LousaPalette.line,
        },
        tone !== 'flat' && tone !== 'accent' && LousaShadow.soft,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  eyebrow,
  actionLabel,
  onAction,
}: {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  return (
    <View style={[styles.sectionHeader, compact && actionLabel ? styles.sectionHeaderCompact : null]}>
      <View style={styles.sectionTitleWrap}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: isDark ? LousaPalette.lavender : LousaPalette.berry }]}>{eyebrow}</Text> : null}
        <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact, { color: colors.onBackground }]}>{title}</Text>
      </View>
      {actionLabel ? (
        <PressScale onPress={onAction} style={[styles.sectionAction, compact && styles.sectionActionCompact]}>
          <Text numberOfLines={2} style={[styles.sectionActionText, { color: isDark ? LousaPalette.lavender : LousaPalette.berry }]}>{actionLabel}</Text>
          <MaterialSymbol name="arrow_forward" size={17} color={isDark ? LousaPalette.lavender : LousaPalette.berry} />
        </PressScale>
      ) : null}
    </View>
  );
}

export function StatusPill({
  label,
  icon,
  tone = 'neutral',
}: {
  label: string;
  icon?: string;
  tone?: 'neutral' | 'rose' | 'success' | 'warning' | 'night';
}) {
  const { isDark } = useTheme();
  const config = {
    neutral: { bg: isDark ? 'rgba(255,255,255,0.08)' : '#F2EDF1', fg: isDark ? '#E6DEE8' : LousaPalette.inkSoft },
    rose: { bg: isDark ? 'rgba(217,133,165,0.18)' : '#F8E7ED', fg: isDark ? '#F1B8CD' : LousaPalette.berry },
    success: { bg: isDark ? 'rgba(75,138,106,0.20)' : LousaPalette.successSoft, fg: isDark ? '#89C5A7' : LousaPalette.success },
    warning: { bg: isDark ? 'rgba(184,135,71,0.20)' : LousaPalette.warningSoft, fg: isDark ? '#E0B77F' : LousaPalette.warning },
    night: { bg: LousaPalette.nightSoft, fg: '#FFFFFF' },
  }[tone];

  return (
    <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
      {icon ? <MaterialSymbol name={icon} size={15} color={config.fg} /> : null}
      <Text style={[styles.statusPillText, { color: config.fg }]}>{label}</Text>
    </View>
  );
}

export function IconBubble({
  icon,
  tone = 'rose',
  size = 44,
}: {
  icon: string;
  tone?: 'rose' | 'lavender' | 'neutral' | 'night';
  size?: number;
}) {
  const { isDark } = useTheme();
  const config = {
    rose: { bg: isDark ? 'rgba(217,133,165,0.16)' : '#F8E8EE', fg: isDark ? '#F1B7CD' : LousaPalette.berry },
    lavender: { bg: isDark ? 'rgba(184,166,217,0.17)' : '#F0ECF8', fg: isDark ? '#D5C8EB' : '#7B64A9' },
    neutral: { bg: isDark ? 'rgba(255,255,255,0.08)' : '#F2EDF1', fg: isDark ? '#E6DEE8' : LousaPalette.inkSoft },
    night: { bg: LousaPalette.nightSoft, fg: '#FFFFFF' },
  }[tone];

  return (
    <View style={[styles.iconBubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: config.bg }]}>
      <MaterialSymbol name={icon} size={Math.round(size * 0.46)} color={config.fg} />
    </View>
  );
}

export function PrimaryAction({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressScale onPress={onPress} disabled={disabled} style={styles.primaryAction}>
      <Text numberOfLines={2} style={styles.primaryActionText}>{label}</Text>
      {icon ? <MaterialSymbol name={icon} size={20} color="#FFFFFF" /> : null}
    </PressScale>
  );
}

export function TrustLabel({
  label,
  detail,
  tone = 'neutral',
}: {
  label: string;
  detail?: string;
  tone?: 'neutral' | 'forecast' | 'confirmed' | 'included' | 'warning';
}) {
  const { colors, isDark } = useTheme();
  const config = {
    neutral: { icon: 'info', bg: isDark ? 'rgba(255,255,255,0.07)' : '#F6F2F4', fg: colors.onSurfaceVariant },
    forecast: { icon: 'timeline', bg: isDark ? 'rgba(184,166,217,0.14)' : '#F2EEF8', fg: isDark ? '#D5C8EB' : '#705B98' },
    confirmed: { icon: 'check_circle', bg: isDark ? 'rgba(79,117,99,0.18)' : '#EAF2EE', fg: isDark ? '#9FC5B1' : LousaPalette.success },
    included: { icon: 'verified', bg: isDark ? 'rgba(79,117,99,0.18)' : '#EAF2EE', fg: isDark ? '#9FC5B1' : LousaPalette.success },
    warning: { icon: 'priority_high', bg: isDark ? 'rgba(163,111,61,0.18)' : '#F8EFE7', fg: isDark ? '#D9B28C' : LousaPalette.warning },
  }[tone];
  return (
    <View style={[styles.trustLabel, { backgroundColor: config.bg }]}>
      <MaterialSymbol name={config.icon} size={16} color={config.fg} />
      <View style={styles.trustLabelCopy}>
        <Text style={[styles.trustLabelTitle, { color: config.fg }]}>{label}</Text>
        {detail ? <Text style={[styles.trustLabelDetail, { color: colors.onSurfaceVariant }]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

export function QuantitySelector({
  value,
  min = 0,
  max = 99,
  step = 1,
  onChange,
  label,
  helper,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  helper?: string;
}) {
  const { colors } = useTheme();
  const decreaseDisabled = value <= min;
  const increaseDisabled = value >= max;
  return (
    <View style={styles.quantityWrap}>
      {label ? <Text style={[styles.quantityLabel, { color: colors.onBackground }]}>{label}</Text> : null}
      {helper ? <Text style={[styles.quantityHelper, { color: colors.onSurfaceVariant }]}>{helper}</Text> : null}
      <View style={[styles.quantityControl, { borderColor: colors.outlineVariant }]}>
        <PressScale
          accessibilityLabel="Decrease quantity"
          disabled={decreaseDisabled}
          onPress={() => onChange(Math.max(min, value - step))}
          style={styles.quantityButton}
        >
          <MaterialSymbol name="remove" size={20} color={decreaseDisabled ? colors.outline : LousaPalette.berry} />
        </PressScale>
        <Text accessibilityLiveRegion="polite" style={[styles.quantityValue, { color: colors.onBackground }]}>{value}</Text>
        <PressScale
          accessibilityLabel="Increase quantity"
          disabled={increaseDisabled}
          onPress={() => onChange(Math.min(max, value + step))}
          style={styles.quantityButton}
        >
          <MaterialSymbol name="add" size={20} color={increaseDisabled ? colors.outline : LousaPalette.berry} />
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surfaceCard: {
    borderWidth: 1,
    borderRadius: LousaLayout.cardRadius,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 14,
  },
  sectionHeaderCompact: { alignItems: 'flex-start', flexDirection: 'column', gap: 2 },
  sectionTitleWrap: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: 'sans-serif-medium',
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: 'sans-serif-medium',
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.2,
  },
  sectionTitleCompact: { fontSize: 21, lineHeight: 27 },
  sectionAction: {
    minHeight: LousaLayout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    maxWidth: '46%',
  },
  sectionActionCompact: { maxWidth: '100%', alignSelf: 'flex-start', minHeight: LousaLayout.touchTarget, paddingHorizontal: 0 },
  sectionActionText: {
    fontFamily: 'sans-serif-medium',
    fontSize: 13,
  },
  statusPill: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontFamily: 'sans-serif-medium',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  iconBubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    minHeight: LousaLayout.buttonHeight,
    borderRadius: 999,
    backgroundColor: LousaPalette.berry,
    paddingHorizontal: 22,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...LousaShadow.soft,
  },
  primaryActionText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: 'sans-serif-medium',
    fontSize: 15,
    textAlign: 'center',
  },
  trustLabel: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  trustLabelCopy: { flex: 1, minWidth: 0 },
  trustLabelTitle: { fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 17 },
  trustLabelDetail: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 2 },
  quantityWrap: { gap: 6 },
  quantityLabel: { fontFamily: 'sans-serif-medium', fontSize: 14 },
  quantityHelper: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 18 },
  quantityControl: { minHeight: 50, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', overflow: 'hidden' },
  quantityButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  quantityValue: { minWidth: 58, textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 18 },
});
