import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ModalScreen, PageIntro, ScreenScroll, useResponsiveLayout } from '../../src/components/layout';
import { IconBubble, PressScale, SectionHeader, StatusPill, SurfaceCard } from '../../src/components/ui';

import { useNotificationStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { ThemeName } from '../../src/theme/tokens';
import { exportLocalData } from '../../src/services/dataExport';
import { clearAllLocalData } from '../../src/services/localData';
import { getServiceMode, services } from '../../src/services';
import { getUserFacingErrorMessage } from '../../src/services/errorMessages';

const COPY = {
  ru: {
    appBar: 'Настройки', title: 'Настройки LOUSA', subtitle: 'Выбери удобный вид, язык, уведомления и уровень приватности.',
    appearance: 'Внешний вид', light: 'Светлая', pearl: 'Системная', dark: 'Тёмная', language: 'Язык', communication: 'Стиль общения', communicationDesc: 'Выбери, насколько коротко и тепло LOUSA пишет тебе.', tones: { brief: 'Кратко', neutral: 'Нейтрально', warm: 'Тепло' },
    notifications: 'Уведомления', notificationsDesc: 'Спокойный график напоминаний, тихие часы и приватный режим.', notificationsOn: 'Включены', notificationsOff: 'Выключены',
    privacyMode: 'Приватные уведомления', privacyModeDesc: 'На экране блокировки показывается только нейтральный текст.',
    security: 'Безопасность', pin: 'Шифрование данных', pinDesc: 'Токены и чувствительные данные хранятся в системном зашифрованном хранилище устройства.', encrypted: 'Зашифровано', biometric: 'Блокировка приложения', biometricDesc: 'PIN и биометрия пока не включены и не выдаются за работающую защиту.',
    data: 'Данные и поддержка', support: 'Поддержка LOUSA', supportDesc: 'Написать команде LOUSA или связаться с курьером по активной доставке.', uxLab: 'UX Lab', uxLabDesc: 'Внутренние сценарии для проверки нового интерфейса.', privacy: 'Политика конфиденциальности', terms: 'Условия использования', export: 'Экспорт данных', exportDesc: 'Создать личную JSON-копию данных на этом устройстве.', delete: 'Очистить данные на устройстве', deleteTitle: 'Очистить это устройство?', deleteText: 'Локальная история, дневник и настройки будут удалены. Серверный аккаунт останется.', deleteConfirm: 'Очистить', deleteAccount: 'Удалить аккаунт', deleteAccountTitle: 'Удалить аккаунт LOUSA?', deleteAccountText: 'Серверный аккаунт и личные данные будут удалены. Это действие нельзя отменить.', deleteAccountConfirm: 'Удалить аккаунт', cancel: 'Отмена',
    coming: 'Не включено', systemInfo: 'LOUSA показывает только реально включённые механизмы защиты.',
  },
  en: {
    appBar: 'Settings', title: 'LOUSA settings', subtitle: 'Choose your appearance, language, notifications and privacy level.',
    appearance: 'Appearance', light: 'Light', pearl: 'System', dark: 'Dark', language: 'Language', communication: 'Communication style', communicationDesc: 'Choose how concise or warm LOUSA should sound.', tones: { brief: 'Brief', neutral: 'Neutral', warm: 'Warm' },
    notifications: 'Notifications', notificationsDesc: 'A calm reminder schedule, quiet hours and private mode.', notificationsOn: 'On', notificationsOff: 'Off',
    privacyMode: 'Private notifications', privacyModeDesc: 'Only neutral text appears on the lock screen.',
    security: 'Security', pin: 'Encrypted data', pinDesc: 'Tokens and sensitive state use the device encrypted system storage.', encrypted: 'Encrypted', biometric: 'App lock', biometricDesc: 'PIN and biometrics are not enabled and are not presented as active protection.',
    data: 'Data & support', support: 'LOUSA support', supportDesc: 'Message LOUSA or contact the courier for active delivery.', uxLab: 'UX Lab', uxLabDesc: 'Internal scenarios for testing the calm interface.', privacy: 'Privacy policy', terms: 'Terms of use', export: 'Export data', exportDesc: 'Create a personal JSON copy of data stored on this device.', delete: 'Clear this device', deleteTitle: 'Clear this device?', deleteText: 'Local history and settings will be removed. Your server account will remain.', deleteConfirm: 'Clear', deleteAccount: 'Delete account', deleteAccountTitle: 'Delete your LOUSA account?', deleteAccountText: 'Your server account and personal data will be deleted. This cannot be undone.', deleteAccountConfirm: 'Delete account', cancel: 'Cancel',
    coming: 'Not enabled', systemInfo: 'LOUSA only shows security mechanisms that are actually enabled.',
  },
  hy: {
    appBar: 'Կարգավորումներ', title: 'LOUSA-ի կարգավորումներ', subtitle: 'Ընտրիր տեսքը, լեզուն, ծանուցումներն ու գաղտնիության մակարդակը։',
    appearance: 'Արտաքին տեսք', light: 'Բաց', pearl: 'Համակարգային', dark: 'Մուգ', language: 'Լեզու', communication: 'Հաղորդակցության ոճ', communicationDesc: 'Ընտրիր՝ որքան կարճ կամ ջերմ պետք է գրի LOUSA-ն։', tones: { brief: 'Կարճ', neutral: 'Չեզոք', warm: 'Ջերմ' },
    notifications: 'Ծանուցումներ', notificationsDesc: 'Հանգիստ հիշեցումների գրաֆիկ, լուռ ժամեր և գաղտնի ռեժիմ։', notificationsOn: 'Միացված', notificationsOff: 'Անջատված',
    privacyMode: 'Գաղտնի ծանուցումներ', privacyModeDesc: 'Կողպված էկրանին երևում է միայն չեզոք տեքստ։',
    security: 'Անվտանգություն', pin: 'Գաղտնագրված տվյալներ', pinDesc: 'Տոքեններն ու զգայուն տվյալները պահվում են սարքի համակարգային գաղտնագրված պահոցում։', encrypted: 'Գաղտնագրված', biometric: 'Հավելվածի կողպում', biometricDesc: 'PIN-ն ու կենսաչափությունը դեռ միացված չեն։',
    data: 'Տվյալներ և աջակցություն', support: 'LOUSA աջակցություն', supportDesc: 'Գրել LOUSA թիմին կամ կապվել առաքիչի հետ ակտիվ առաքման դեպքում։', uxLab: 'UX Lab', uxLabDesc: 'Նոր ինտերֆեյսի ներքին փորձարկման սցենարներ։', privacy: 'Գաղտնիության քաղաքականություն', terms: 'Օգտագործման պայմաններ', export: 'Արտահանել տվյալները', exportDesc: 'Ստեղծել այս սարքում պահվող տվյալների անձնական JSON պատճենը։', delete: 'Մաքրել սարքի տվյալները', deleteTitle: 'Մաքրե՞լ այս սարքը', deleteText: 'Տեղային պատմությունն ու կարգավորումները կհեռացվեն, իսկ սերվերային հաշիվը կմնա։', deleteConfirm: 'Մաքրել', deleteAccount: 'Ջնջել հաշիվը', deleteAccountTitle: 'Ջնջե՞լ LOUSA հաշիվը', deleteAccountText: 'Սերվերային հաշիվն ու անձնական տվյալները կջնջվեն անվերադարձ։', deleteAccountConfirm: 'Ջնջել հաշիվը', cancel: 'Չեղարկել',
    coming: 'Միացված չէ', systemInfo: 'LOUSA-ն ցույց է տալիս միայն իրականում միացված պաշտպանությունը։',
  },
} as const;

function SettingRow({ icon, title, description, right, onPress }: { icon: string; title: string; description?: string; right?: React.ReactNode; onPress?: () => void }) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.settingRow}>
      <IconBubble icon={icon} tone="rose" size={38} />
      <View style={styles.settingCopy}>
        <Text style={[styles.settingTitle, { color: colors.onBackground }]}>{title}</Text>
        {description ? <Text style={[styles.settingDescription, { color: colors.onSurfaceVariant }]}>{description}</Text> : null}
      </View>
      {right || (onPress ? <MaterialSymbol name="chevron_right" size={20} color={colors.onSurfaceVariant} /> : null)}
    </View>
  );
  return onPress ? <PressScale onPress={onPress}>{content}</PressScale> : content;
}

export default function SettingsScreen() {
  const { colors, themeName, setTheme } = useTheme();
  const { compactWidth } = useResponsiveLayout();
  const language = useUserStore((s) => s.language);
  const setLanguage = useUserStore((s) => s.setLanguage);
  const isGuestMode = useUserStore((s) => s.isGuestMode);
  const communicationStyle = useUserStore((s) => s.communicationStyle);
  const setCommunicationStyle = useUserStore((s) => s.setCommunicationStyle);
  const notifications = useNotificationStore((s) => s.enabled);
  const notificationPermission = useNotificationStore((s) => s.permissionStatus);
  const copy = COPY[language] || COPY.ru;

  const chooseTheme = (theme: ThemeName) => {
    setTheme(theme);
    Haptics.selectionAsync().catch(() => {});
  };

  const deleteData = () => Alert.alert(copy.deleteTitle, copy.deleteText, [
    { text: copy.cancel, style: 'cancel' },
    {
      text: copy.deleteConfirm,
      style: 'destructive',
      onPress: () => {
        clearAllLocalData()
          .then(() => router.replace('/auth/login'))
          .catch(() => Alert.alert(copy.deleteTitle, copy.systemInfo));
      },
    },
  ]);

  const deleteAccount = () => {
    if (isGuestMode) {
      Alert.alert(copy.deleteAccountTitle, language === 'en' ? 'Guest mode has no server account. Use “Delete local data” instead.' : language === 'hy' ? 'Հյուրի ռեժիմը սերվերային հաշիվ չունի։ Օգտագործեք «Ջնջել տեղային տվյալները»։' : 'У гостевого режима нет серверного аккаунта. Используйте «Удалить локальные данные».');
      return;
    }
    Alert.alert(copy.deleteAccountTitle, copy.deleteAccountText, [
    { text: copy.cancel, style: 'cancel' },
    {
      text: copy.deleteAccountConfirm,
      style: 'destructive',
      onPress: () => {
        if (getServiceMode() !== 'api') {
          Alert.alert(copy.deleteAccountTitle, language === 'en' ? 'Account deletion is temporarily unavailable. Try again later.' : language === 'hy' ? 'Հաշվի ջնջումը ժամանակավորապես հասանելի չէ։ Փորձեք ավելի ուշ։' : 'Удаление аккаунта временно недоступно. Попробуйте позже.');
          return;
        }
        services.account.deleteAccount()
          .then(async (result) => {
            if (!result.ok) throw new Error(result.error.message);
            await clearAllLocalData();
            router.replace('/auth/login');
          })
          .catch((cause) => Alert.alert(copy.deleteAccountTitle, getUserFacingErrorMessage(cause, copy.systemInfo)));
      },
    },
    ]);
  };

  const shareExport = async () => {
    try {
      const result = await exportLocalData();
      if (!result.shared && result.uri) {
        Alert.alert(copy.export, result.uri);
      }
    } catch {
      Alert.alert(copy.export, copy.systemInfo);
    }
  };

  return (
    <ModalScreen title={copy.appBar} closeIcon="arrow_back">
      <ScreenScroll>
        <PageIntro title={copy.title} subtitle={copy.subtitle} />

        <View style={styles.section}>
          <SectionHeader title={copy.appearance} />
          <View style={[styles.themeGrid, compactWidth && styles.themeGridCompact]}>
            {[
              { id: 'rose_gold' as ThemeName, label: copy.light, bg: '#FFF7F5', accent: '#B45A7B' },
              { id: 'midnight_moon' as ThemeName, label: copy.dark, bg: '#17131D', accent: '#D985A5' },
            ].map((theme) => {
              const selected = themeName === theme.id;
              return (
                <PressScale key={theme.id} onPress={() => chooseTheme(theme.id)} style={[styles.themeCard, compactWidth && styles.themeCardCompact, selected && styles.themeCardSelected, { backgroundColor: theme.bg }]}> 
                  <View style={[styles.themeMoon, { backgroundColor: theme.accent }]} />
                  <Text style={[styles.themeLabel, { color: theme.id === 'midnight_moon' ? '#FFFFFF' : '#372833' }]}>{theme.label}</Text>
                  {selected ? <View style={styles.selectedBadge}><MaterialSymbol name="check" size={15} color="#fff" /></View> : null}
                </PressScale>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.language} />
          <SurfaceCard padding={8}>
            <View style={styles.languageRow}>
              {(['ru', 'en', 'hy'] as const).map((item) => (
                <PressScale key={item} onPress={() => setLanguage(item)} style={[styles.languageButton, language === item && styles.languageButtonActive]}>
                  <Text style={[styles.languageText, { color: language === item ? '#FFFFFF' : colors.onBackground }]}>{item === 'hy' ? 'HY' : item.toUpperCase()}</Text>
                </PressScale>
              ))}
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.communication} />
          <Text style={[styles.infoText, { color: colors.onSurfaceVariant, marginBottom: 10 }]}>{copy.communicationDesc}</Text>
          <SurfaceCard padding={8}>
            <View style={styles.languageRow}>
              {(['brief', 'neutral', 'warm'] as const).map((item) => (
                <PressScale key={item} onPress={() => setCommunicationStyle(item)} style={[styles.languageButton, communicationStyle === item && styles.languageButtonActive]}>
                  <Text numberOfLines={2} style={[styles.languageText, { color: communicationStyle === item ? '#FFFFFF' : colors.onBackground }]}>{copy.tones[item]}</Text>
                </PressScale>
              ))}
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.notifications} />
          <SurfaceCard padding={4}>
            <SettingRow
              icon="notifications"
              title={copy.notifications}
              description={copy.notificationsDesc}
              onPress={() => router.push('/screens/notifications')}
              right={<StatusPill label={notifications && notificationPermission === 'granted' ? copy.notificationsOn : copy.notificationsOff} tone={notifications && notificationPermission === 'granted' ? 'success' : 'neutral'} />}
            />
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.security} />
          <SurfaceCard padding={4}>
            <SettingRow icon="encrypted" title={copy.pin} description={copy.pinDesc} right={<StatusPill label={copy.encrypted} tone="success" />} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <SettingRow icon="lock" title={copy.biometric} description={copy.biometricDesc} right={<StatusPill label={copy.coming} tone="neutral" />} />
          </SurfaceCard>
          <View style={styles.infoRow}>
            <MaterialSymbol name="info" size={16} color={colors.onSurfaceVariant} />
            <Text style={[styles.infoText, { color: colors.onSurfaceVariant }]}>{copy.systemInfo}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.data} />
          <SurfaceCard padding={4}>
            <SettingRow icon="support_agent" title={copy.support} description={copy.supportDesc} onPress={() => router.push('/screens/support')} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <SettingRow icon="privacy_tip" title={copy.privacy} onPress={() => router.push('/screens/legal?document=privacy')} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <SettingRow icon="description" title={copy.terms} onPress={() => router.push('/screens/legal?document=terms')} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <SettingRow icon="download" title={copy.export} description={copy.exportDesc} onPress={shareExport} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <SettingRow icon="delete_sweep" title={copy.delete} onPress={deleteData} />
            {!isGuestMode ? <>
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
              <SettingRow icon="delete_forever" title={copy.deleteAccount} description={copy.deleteAccountText} onPress={deleteAccount} />
            </> : null}
          </SurfaceCard>
        </View>

        <Text style={[styles.version, { color: colors.onSurfaceVariant }]}>LOUSA MOON {Constants.expoConfig?.version || '—'} · Build {String(Constants.expoConfig?.android?.versionCode || '—')}</Text>
      </ScreenScroll>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeGridCompact: { flexDirection: 'column' },
  themeCard: { flex: 1, minWidth: 150, minHeight: 112, borderRadius: 24, padding: 14, justifyContent: 'flex-end', borderWidth: 1, borderColor: 'rgba(91,54,95,0.10)', overflow: 'hidden' },
  themeCardCompact: { width: '100%' },
  themeCardSelected: { borderColor: LousaPalette.berry, borderWidth: 2 },
  themeMoon: { position: 'absolute', width: 56, height: 56, borderRadius: 28, right: -10, top: -8, opacity: 0.45 },
  themeLabel: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  selectedBadge: { position: 'absolute', top: 10, left: 10, width: 25, height: 25, borderRadius: 13, backgroundColor: LousaPalette.berry, alignItems: 'center', justifyContent: 'center' },
  languageRow: { flexDirection: 'row', gap: 8 },
  languageButton: { flex: 1, minHeight: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  languageButtonActive: { backgroundColor: LousaPalette.berry },
  languageText: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  settingRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 9 },
  settingCopy: { flex: 1 },
  settingTitle: { fontFamily: 'sans-serif-medium', fontSize: 14 },
  settingDescription: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16, marginTop: 3 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14, opacity: 0.55 },
  switchTrack: { width: 48, height: 29, borderRadius: 15, backgroundColor: '#DDD3D8', padding: 3, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: LousaPalette.berry },
  switchThumb: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFFFFF' },
  switchThumbOn: { alignSelf: 'flex-end' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 6, marginTop: 10 },
  infoText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16 },
  version: { textAlign: 'center', fontFamily: 'sans-serif', fontSize: 12, marginTop: 2 },
});
