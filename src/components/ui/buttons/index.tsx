import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { MaterialSymbol } from '../../MaterialSymbol';
import { useTheme } from '../../../theme/ThemeProvider';
import { LousaLayout, LousaPalette, LousaTypography } from '../../../theme/designSystem';
import { PressScale } from '../PressScale';

type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';
type IconPlacement = 'left' | 'right';

export type ButtonBaseProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  iconPlacement?: IconPlacement;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export function ButtonBase({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPlacement = 'right',
  disabled,
  loading,
  fullWidth = true,
  compact = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonBaseProps) {
  const { colors, isDark } = useTheme();
  const blocked = Boolean(disabled || loading);
  const palette = {
    primary: {
      backgroundColor: LousaPalette.berry,
      borderColor: LousaPalette.berry,
      textColor: '#FFFFFF',
    },
    secondary: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : '#FFFDFE',
      borderColor: colors.outlineVariant,
      textColor: colors.onBackground,
    },
    text: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: isDark ? '#F1B7CD' : LousaPalette.berry,
    },
    destructive: {
      backgroundColor: isDark ? 'rgba(178,76,92,0.16)' : LousaPalette.dangerSoft,
      borderColor: isDark ? 'rgba(255,179,192,0.28)' : '#EEC9D1',
      textColor: isDark ? '#FFB3C0' : LousaPalette.danger,
    },
  }[variant];
  const iconColor = palette.textColor;

  return (
    <PressScale
      onPress={onPress}
      disabled={blocked}
      haptic={variant === 'primary'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: Boolean(loading) }}
      testID={testID}
      style={[
        styles.base,
        compact ? styles.compact : styles.regular,
        fullWidth ? styles.fullWidth : styles.inline,
        variant === 'text' && styles.textVariant,
        blocked && styles.blocked,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <>
          {icon && iconPlacement === 'left' ? <MaterialSymbol name={icon} size={compact ? 18 : 20} color={iconColor} /> : null}
          <Text numberOfLines={2} style={[styles.label, compact && styles.compactLabel, { color: palette.textColor }]}>{label}</Text>
          {icon && iconPlacement === 'right' ? <MaterialSymbol name={icon} size={compact ? 18 : 20} color={iconColor} /> : null}
        </>
      )}
    </PressScale>
  );
}

export function PrimaryButton(props: Omit<ButtonBaseProps, 'variant'>) {
  return <ButtonBase {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<ButtonBaseProps, 'variant'>) {
  return <ButtonBase {...props} variant="secondary" />;
}

export function TextButton(props: Omit<ButtonBaseProps, 'variant'>) {
  return <ButtonBase {...props} variant="text" fullWidth={props.fullWidth ?? false} compact={props.compact ?? true} />;
}

export function DestructiveButton(props: Omit<ButtonBaseProps, 'variant'>) {
  return <ButtonBase {...props} variant="destructive" />;
}

export function IconButton({
  icon,
  onPress,
  label,
  disabled,
  selected,
  style,
}: {
  icon: string;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      style={[
        styles.iconButton,
        {
          backgroundColor: selected
            ? (isDark ? 'rgba(217,133,165,0.16)' : '#F8E7ED')
            : (isDark ? 'rgba(255,255,255,0.045)' : '#FFFDFE'),
          borderColor: selected ? LousaPalette.rose : colors.outlineVariant,
        },
        style,
      ]}
    >
      <MaterialSymbol name={icon} size={23} color={selected ? (isDark ? '#F1B7CD' : LousaPalette.berry) : colors.onSurfaceVariant} />
    </PressScale>
  );
}

export function StickyBottomAction({
  primaryLabel,
  onPrimary,
  primaryIcon,
  primaryLoading,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  bottomInset = 0,
  style,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryIcon?: string;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  bottomInset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.sticky,
        {
          paddingBottom: Math.max(12, bottomInset + 8),
          backgroundColor: isDark ? 'rgba(23,19,29,0.98)' : 'rgba(255,253,254,0.98)',
          borderTopColor: colors.outlineVariant,
        },
        style,
      ]}
    >
      {secondaryLabel && onSecondary ? (
        <TextButton label={secondaryLabel} onPress={onSecondary} fullWidth />
      ) : null}
      <PrimaryButton
        label={primaryLabel}
        onPress={onPrimary}
        icon={primaryIcon}
        loading={primaryLoading}
        disabled={primaryDisabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: LousaLayout.touchTarget,
    borderRadius: LousaLayout.buttonRadius,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  regular: { minHeight: LousaLayout.buttonHeight, paddingVertical: 10 },
  compact: { minHeight: LousaLayout.touchTarget, paddingVertical: 8, paddingHorizontal: 14 },
  fullWidth: { width: '100%' },
  inline: { alignSelf: 'flex-start' },
  textVariant: { borderWidth: 0, minHeight: LousaLayout.touchTarget, paddingHorizontal: 6 },
  blocked: { opacity: 0.48 },
  label: { flexShrink: 1, ...LousaTypography.button, textAlign: 'center' },
  compactLabel: { fontSize: 13.5, lineHeight: 18 },
  iconButton: {
    width: LousaLayout.touchTarget,
    height: LousaLayout.touchTarget,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sticky: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: LousaLayout.screenPadding,
    gap: 8,
  },
});
