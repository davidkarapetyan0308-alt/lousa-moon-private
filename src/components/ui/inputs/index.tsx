import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { MaterialSymbol } from '../../MaterialSymbol';
import { useTheme } from '../../../theme/ThemeProvider';
import { LousaLayout, LousaPalette } from '../../../theme/designSystem';
import { PressScale } from '../PressScale';

export function ChoiceChip({
  label,
  selected,
  onPress,
  icon,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.choiceChip,
        {
          backgroundColor: selected ? (isDark ? 'rgba(217,133,165,0.18)' : '#F8E7ED') : 'transparent',
          borderColor: selected ? LousaPalette.rose : colors.outlineVariant,
        },
        style,
      ]}
    >
      {icon ? <MaterialSymbol name={icon} size={17} color={selected ? (isDark ? '#F1B7CD' : LousaPalette.berry) : colors.onSurfaceVariant} /> : null}
      <Text style={[styles.choiceText, { color: selected ? (isDark ? '#F1B7CD' : LousaPalette.berry) : colors.onSurfaceVariant }]}>{label}</Text>
      {selected ? <MaterialSymbol name="check" size={16} color={isDark ? '#F1B7CD' : LousaPalette.berry} /> : null}
    </PressScale>
  );
}

export function CheckboxRow({
  label,
  detail,
  checked,
  onPress,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={styles.row}
    >
      <View style={[styles.checkbox, { borderColor: checked ? LousaPalette.berry : colors.outlineVariant, backgroundColor: checked ? LousaPalette.berry : 'transparent' }]}>
        {checked ? <MaterialSymbol name="check" size={16} color="#FFFFFF" /> : null}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.rowLabel, { color: colors.onBackground }]}>{label}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: colors.onSurfaceVariant }]}>{detail}</Text> : null}
      </View>
    </PressScale>
  );
}

export function SwitchRow({
  label,
  detail,
  value,
  onPress,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={styles.row}
    >
      <View style={styles.copy}>
        <Text style={[styles.rowLabel, { color: colors.onBackground }]}>{label}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: colors.onSurfaceVariant }]}>{detail}</Text> : null}
      </View>
      <View style={[styles.switchTrack, { backgroundColor: value ? LousaPalette.berry : (isDark ? '#4A434E' : '#D8CDD2') }]}>
        <View style={[styles.switchThumb, { transform: [{ translateX: value ? 20 : 2 }] }]} />
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  choiceChip: {
    minHeight: LousaLayout.touchTarget,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  choiceText: { flexShrink: 1, fontFamily: 'sans-serif-medium', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  copy: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: 'sans-serif-medium', fontSize: 14.5, lineHeight: 20 },
  rowDetail: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  switchTrack: { width: 46, height: 28, borderRadius: 14, justifyContent: 'center' },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
});
