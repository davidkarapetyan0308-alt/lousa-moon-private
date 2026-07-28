import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaLayout, LousaPalette, LousaShadow } from '../../src/theme/designSystem';

const TAB_CONTENT_HEIGHT = 60;
const TAB_VERTICAL_PADDING = 6;

const LABELS = {
  en: { today: 'Today', tracking: 'Calendar', box: 'LOUSA BOX', profile: 'Profile' },
  ru: { today: 'Сегодня', tracking: 'Календарь', box: 'LOUSA BOX', profile: 'Профиль' },
  hy: { today: 'Այսօր', tracking: 'Օրացույց', box: 'LOUSA BOX', profile: 'Պրոֆիլ' },
};

function TabIcon({ icon, label, focused, compact }: { icon: string; label: string; focused: boolean; compact: boolean }) {
  const { isDark } = useTheme();
  const activeColor = isDark ? '#F1B7CD' : LousaPalette.berry;
  const inactiveColor = isDark ? '#99909E' : '#7D707F';
  const color = focused ? activeColor : inactiveColor;
  return (
    <View style={styles.tabItem}>
      <View style={[styles.iconCapsule, focused && { backgroundColor: isDark ? 'rgba(217,133,165,0.14)' : '#F4DDE6' }]}>
        <MaterialSymbol name={icon} size={22} color={color} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76} style={[styles.label, compact && styles.labelCompact, { color }]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 375;
  const language = useUserStore((state) => state.language);
  const labels = LABELS[language];
  const safeBottom = Math.min(insets.bottom, Platform.OS === 'ios' ? 24 : 20);
  const tabBarHeight = TAB_CONTENT_HEIGHT + TAB_VERTICAL_PADDING * 2 + safeBottom;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        position: 'absolute', left: compact ? 10 : 14, right: compact ? 10 : 14, bottom: Math.max(LousaLayout.tabBarBottomGap, 8),
        height: tabBarHeight,
        paddingTop: TAB_VERTICAL_PADDING, paddingBottom: TAB_VERTICAL_PADDING + safeBottom, borderTopWidth: 0, borderRadius: 22,
        backgroundColor: isDark ? 'rgba(25,23,34,0.98)' : '#FFFFFF', ...LousaShadow.soft, elevation: 3,
      },
      tabBarShowLabel: false,
      tabBarHideOnKeyboard: true,
      tabBarItemStyle: styles.tabBarItem,
      tabBarIconStyle: styles.tabBarIcon,
    }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="home" label={labels.today} focused={focused} compact={compact} /> }} />
      <Tabs.Screen name="cycle" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="calendar_month" label={labels.tracking} focused={focused} compact={compact} /> }} />
      <Tabs.Screen name="box" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="redeem" label={labels.box} focused={focused} compact={compact} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon icon="person" label={labels.profile} focused={focused} compact={compact} /> }} />
      <Tabs.Screen name="for-you" options={{ href: null }} />
      <Tabs.Screen name="lunar" options={{ href: null }} />
      <Tabs.Screen name="wellness" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarItem: { height: TAB_CONTENT_HEIGHT, padding: 0, margin: 0 },
  tabBarIcon: { width: '100%', height: TAB_CONTENT_HEIGHT, margin: 0, padding: 0 },
  tabItem: { height: TAB_CONTENT_HEIGHT, alignItems: 'center', justifyContent: 'center', minWidth: 66 },
  iconCapsule: { width: 40, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { height: 18, fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 16, marginTop: 3, maxWidth: 82, textAlign: 'center', includeFontPadding: false },
  labelCompact: { fontSize: 12, maxWidth: 76 },
});
