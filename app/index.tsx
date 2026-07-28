import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Lightweight first route used only while the root navigation container mounts and
 * the persisted local session is resolved. The native splash remains visible above
 * this view, so unauthenticated cold starts never mount the heavy tabs tree first.
 */
export default function StartupRoute() {
  return (
    <View
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F5',
  },
});
