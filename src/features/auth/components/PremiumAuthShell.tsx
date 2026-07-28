import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export type PremiumAuthShellVariant = 'welcome' | 'form';

type PremiumAuthShellProps = {
  children: ReactNode;
  variant?: PremiumAuthShellVariant;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'children'>;
  testID?: string;
};

/**
 * Premium auth layout governor for LOUSA.
 *
 * Geometry contract:
 * - Welcome may use a calm hero composition.
 * - Every form screen is top-biased, never bottom-biased.
 * - Bottom padding always protects CTA/legal text from Android navigation.
 * - Keyboard never owns the layout; content remains scrollable.
 * - No screen may add random huge top gaps; auth card spacing is controlled here.
 */
export function PremiumAuthShell({
  children,
  variant = 'form',
  contentContainerStyle,
  scrollViewProps,
  testID,
}: PremiumAuthShellProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? 16 : width < 480 ? 20 : 24;
  const bottomPadding = Math.max(32, insets.bottom + 24);

  return (
    <KeyboardAvoidingView
      testID={testID}
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
          {...scrollViewProps}
          contentContainerStyle={[
            styles.scrollBase,
            variant === 'welcome' ? styles.welcome : styles.form,
            { paddingHorizontal: horizontalPadding, paddingBottom: bottomPadding },
            contentContainerStyle,
          ]}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFF8F5' },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollBase: {
    width: '100%',
    alignItems: 'center',
  },
  welcome: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 16,
  },
  form: {
    flexGrow: 0,
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
});
