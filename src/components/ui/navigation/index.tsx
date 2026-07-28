import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../../theme/ThemeProvider';
import { LousaPalette, LousaTypography } from '../../../theme/designSystem';

export function ProgressHeader({
  steps,
  currentStep,
}: {
  steps: readonly string[];
  currentStep: number;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: currentStep + 1 }} style={styles.wrap}>
      <View style={styles.labels}>
        {steps.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            numberOfLines={1}
            style={[styles.label, { color: index === currentStep ? LousaPalette.berry : colors.onSurfaceVariant }]}
          >
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.rail}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.segment,
              { backgroundColor: index <= currentStep ? LousaPalette.berry : colors.outlineVariant },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  label: { flex: 1, textAlign: 'center', ...LousaTypography.caption, fontFamily: 'sans-serif-medium' },
  rail: { flexDirection: 'row', gap: 6, marginTop: 10 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
});
