import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';
import { useNotificationStore, useUserStore } from '../store';
import { MaterialSymbol } from './MaterialSymbol';
import { LousaPalette } from '../theme/designSystem';

export function TopAppBar({ title }: { title?: string }) {
  const { colors, isDark } = useTheme();
  const avatarUri = useUserStore((s) => s.avatarUri);
  const unread = useNotificationStore((s) => s.inbox.filter((item) => !item.readAt).length);

  return (
    <View style={styles.container}>
      <View style={styles.brandWrap}>
        <Image source={require('../../assets/images/splash-icon.png')} style={styles.brandIcon} resizeMode="contain" />
        <View style={styles.brandCopy}>
          <Text numberOfLines={title ? 2 : 1} style={[title ? styles.sectionTitle : styles.brand, { color: colors.onBackground }]}>
            {title || 'LOUSA'}
          </Text>
          {!title ? <Text style={[styles.brandSub, { color: colors.onSurfaceVariant }]}>MOON</Text> : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Уведомления"
          style={({ pressed }) => [styles.iconButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFDFE', opacity: pressed ? 0.72 : 1 }]}
          onPress={() => router.push('/screens/notifications')}
        >
          <MaterialSymbol name="notifications" size={20} color={colors.onSurfaceVariant} />
          {unread > 0 ? <View style={styles.notificationDot} /> : null}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Профиль"
          style={({ pressed }) => [styles.avatarButton, { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(91,54,95,0.12)', opacity: pressed ? 0.72 : 1 }]}
          onPress={() => router.push('/screens/profile')}
        >
          <Image
            source={avatarUri ? { uri: avatarUri } : require('../../assets/images/profile/profile-placeholder.png')}
            style={styles.avatarImage}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 58, paddingHorizontal: 18, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: { width: 34, height: 34 },
  brandCopy: { flex: 1, minWidth: 0 },
  brand: { fontFamily: 'serif', fontSize: 19, letterSpacing: 1.7, lineHeight: 21 },
  brandSub: { fontFamily: 'sans-serif-medium', fontSize: 12, letterSpacing: 3.2, marginTop: 1 },
  sectionTitle: { fontFamily: 'sans-serif-medium', fontSize: 16, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9, marginLeft: 10 },
  iconButton: { width: 48, height: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', right: 8, top: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: LousaPalette.rose, borderWidth: 1.5, borderColor: '#FFF' },
  avatarButton: { width: 48, height: 48, borderRadius: 24, padding: 2, borderWidth: 1 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 19 },
});
