import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AmbientBackground } from './AmbientBackground';
import { MaterialSymbol } from './MaterialSymbol';
import { TopAppBar } from './TopAppBar';
import { useTheme } from '../theme/ThemeProvider';
import { LousaLayout, LousaPalette, LousaShadow } from '../theme/designSystem';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    compactWidth: width < 380,
    veryCompactWidth: width < 350,
    smallHeight: height < 760,
    horizontalPadding: width < 360
      ? LousaLayout.screenPaddingCompact
      : width < 480
        ? LousaLayout.screenPadding
        : LousaLayout.screenPaddingWide,
    contentMaxWidth: Math.min(LousaLayout.contentMaxWidth, Math.max(320, width)),
    pageTitleSize: width < 360 ? 25 : width < 410 ? 27 : 29,
    sectionTitleSize: width < 360 ? 19 : width < 410 ? 21 : 22,
  };
}

export function useAppContentInsets(tabbed = false, extra: number = 24) {
  const insets = useSafeAreaInsets();
  const tabHeight = Platform.OS === 'ios' ? LousaLayout.tabBarHeightIos : LousaLayout.tabBarHeightAndroid;
  return {
    top: insets.top,
    bottom: tabbed
      ? tabHeight + LousaLayout.tabBarBottomGap + insets.bottom + extra + 24
      : Math.max(32, insets.bottom + extra),
  };
}

export function useTabbedBottomSpace(extra: number = LousaLayout.tabContentGap) {
  return useAppContentInsets(true, extra).bottom;
}

export function TabbedScreen({
  children,
  title,
  backgroundVariant,
}: {
  children: React.ReactNode;
  title?: string;
  backgroundVariant?: 'liquid' | 'cosmic' | 'minimal';
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AmbientBackground variant={backgroundVariant || (isDark ? 'cosmic' : 'minimal')} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <TopAppBar title={title} />
      </SafeAreaView>
      {children}
    </View>
  );
}

export function ScreenScroll({
  children,
  tabbed = false,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  style,
  ...props
}: ScrollViewProps & {
  tabbed?: boolean;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { horizontalPadding } = useResponsiveLayout();
  const bottomSpace = useAppContentInsets(tabbed, tabbed ? LousaLayout.tabContentGap : 24).bottom;

  return (
    <ScrollView
      {...props}
      style={[styles.scroll, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: horizontalPadding, paddingBottom: bottomSpace },
        contentContainerStyle,
      ]}
    >
      <View style={styles.contentColumn}>{children}</View>
    </ScrollView>
  );
}

export function PageIntro({
  title,
  subtitle,
  centered = false,
}: {
  title: string;
  subtitle?: string;
  centered?: boolean;
}) {
  const { colors } = useTheme();
  const { pageTitleSize } = useResponsiveLayout();
  return (
    <View style={[styles.pageIntro, centered && styles.centered]}>
      <Text
        style={[
          styles.pageTitle,
          { fontSize: pageTitleSize, lineHeight: pageTitleSize + 6 },
          centered && styles.centeredText,
          { color: colors.onBackground },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.pageSubtitle, centered && styles.centeredText, { color: colors.onSurfaceVariant }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function ModalScreen({
  children,
  title,
  closeIcon = 'close',
  onBack,
  backgroundVariant,
  keyboard = false,
}: {
  children: React.ReactNode;
  title: string;
  closeIcon?: string;
  onBack?: () => void;
  backgroundVariant?: 'liquid' | 'cosmic' | 'minimal';
  keyboard?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const content = (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AmbientBackground variant={backgroundVariant || (isDark ? 'cosmic' : 'minimal')} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.modalSafe}>
        <View style={[styles.modalHeader, { borderBottomColor: isDark ? LousaPalette.lineDark : LousaPalette.line }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack || (() => router.back())}
            style={[styles.headerIconButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFDFE' }]}
          >
            <MaterialSymbol name={closeIcon} size={22} color={colors.onBackground} />
          </TouchableOpacity>
          <Text numberOfLines={2} style={[styles.modalTitle, { color: colors.onBackground }]}>{title}</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        {children}
      </SafeAreaView>
    </View>
  );

  if (!keyboard) return content;
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  safeTop: { zIndex: 2 },
  modalSafe: { flex: 1, zIndex: 2 },
  scrollContent: { flexGrow: 1, paddingTop: LousaLayout.spacingSm },
  contentColumn: { flexGrow: 1, width: '100%', maxWidth: LousaLayout.contentMaxWidth, alignSelf: 'center' },
  pageIntro: { marginTop: 4, marginBottom: 20 },
  centered: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  pageTitle: { fontFamily: 'sans-serif-medium', letterSpacing: -0.3 },
  pageSubtitle: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 520 },
  modalHeader: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...LousaShadow.soft,
  },
  headerPlaceholder: { width: 48, height: 48 },
  modalTitle: {
    flex: 1,
    paddingHorizontal: 10,
    textAlign: 'center',
    fontFamily: 'sans-serif-medium',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
