import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ModalScreen, PageIntro, ScreenScroll, useResponsiveLayout } from '../../src/components/layout';
import { IconBubble, InlineMessage, PressScale, PrimaryButton, SectionHeader, StatusPill, SurfaceCard, TextButton } from '../../src/components/ui';
import { useBoxStore, useCycleStore, useNotificationStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { deleteStoredAvatar, pickAvatar } from '../../src/services/avatar';
import { LousaPalette } from '../../src/theme/designSystem';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import { services } from '../../src/services';
import { signOutNativeGoogle } from '../../src/services/nativeGoogleSignIn';
import { clearAllLocalData } from '../../src/services/localData';
import { beginGuestAccountUpgrade } from '../../src/features/auth/guest/guestSession';

const COPY = {
  ru: {
    appBar: 'Профиль', title: 'Твоё пространство', subtitle: 'Личные данные, цикл, подписка и приватность — в одном месте.',
    edit: 'Изменить имя', save: 'Сохранить', cancel: 'Отмена', namePlaceholder: 'Твоё имя', premium: 'LOUSA Premium', free: 'Базовый профиль',
    cycle: 'Средний цикл', period: 'Средняя менструация', confirmed: 'Подтверждённые циклы', confidence: 'Уверенность прогноза', today: 'Сегодня', days: 'дней', logged: 'Заполнено', notLogged: 'Нет записи', confidenceLabels: { insufficient: 'Недостаточно данных', low: 'Низкая', medium: 'Средняя', high: 'Высокая' },
    account: 'Аккаунт', email: 'Email', phone: 'Телефон', languageLabel: 'Язык', notifications: 'Уведомления', notificationsOn: 'Включены', notificationsOff: 'Выключены', notProvided: 'Не указан', deliveryAddress: 'Адрес доставки', noAddress: 'Не выбран', cycleData: 'Данные цикла', reviewImported: 'Проверить перенесённые даты', analytics: 'Аналитика', box: 'LOUSA BOX', settings: 'Настройки', privacy: 'Приватность и защита',
    activeBox: 'Активна', noBox: 'Не оформлена', editPhoto: 'Изменить фото', removePhoto: 'Удалить фото', close: 'Закрыть', logout: 'Выйти из аккаунта', guest: 'Гостевой режим', guestTitle: 'Вы используете LOUSA без аккаунта', guestBody: 'Цикл, самочувствие и заметки сохраняются локально на этом устройстве. Аккаунт нужен для резервной копии, адреса, LOUSA BOX и оплаты.', createAccount: 'Создать аккаунт', signInAccount: 'Войти в аккаунт', accountRequired: 'Нужен аккаунт', leaveGuest: 'Удалить гостевые данные', leaveGuestTitle: 'Удалить гостевые данные?', leaveGuestText: 'Локальные записи цикла, самочувствия и настройки будут удалены с этого устройства.', leaveGuestConfirm: 'Удалить данные',
    logoutTitle: 'Выйти из аккаунта?', logoutText: 'Данные этого аккаунта будут удалены с устройства. Серверный аккаунт и история останутся сохранены.', logoutConfirm: 'Выйти',
  },
  en: {
    appBar: 'Profile', title: 'Your space', subtitle: 'Personal details, cycle, subscription and privacy in one place.',
    edit: 'Edit name', save: 'Save', cancel: 'Cancel', namePlaceholder: 'Your name', premium: 'LOUSA Premium', free: 'Basic profile',
    cycle: 'Average cycle', period: 'Average period', confirmed: 'Confirmed cycles', confidence: 'Forecast confidence', today: 'Today', days: 'days', logged: 'Logged', notLogged: 'No entry', confidenceLabels: { insufficient: 'Not enough data', low: 'Low', medium: 'Medium', high: 'High' },
    account: 'Account', email: 'Email', phone: 'Phone', languageLabel: 'Language', notifications: 'Notifications', notificationsOn: 'On', notificationsOff: 'Off', notProvided: 'Not provided', deliveryAddress: 'Delivery address', noAddress: 'Not selected', cycleData: 'Cycle data', reviewImported: 'Review imported dates', analytics: 'Analytics', box: 'LOUSA BOX', settings: 'Settings', privacy: 'Privacy & security',
    activeBox: 'Active', noBox: 'Not subscribed', editPhoto: 'Change photo', removePhoto: 'Remove photo', close: 'Close', logout: 'Sign out', guest: 'Guest mode', guestTitle: 'You are using LOUSA without an account', guestBody: 'Cycle data, wellbeing and notes are stored locally on this device. An account is required for backup, delivery addresses, LOUSA BOX and payments.', createAccount: 'Create account', signInAccount: 'Sign in', accountRequired: 'Account required', leaveGuest: 'Delete guest data', leaveGuestTitle: 'Delete guest data?', leaveGuestText: 'Local cycle records, wellbeing entries and settings will be removed from this device.', leaveGuestConfirm: 'Delete data',
    logoutTitle: 'Sign out?', logoutText: 'This account’s data will be removed from this device. The server account and history will remain saved.', logoutConfirm: 'Sign out',
  },
  hy: {
    appBar: 'Պրոֆիլ', title: 'Քո տարածքը', subtitle: 'Անձնական տվյալները, ցիկլը, բաժանորդագրությունն ու գաղտնիությունը՝ մեկ տեղում։',
    edit: 'Փոխել անունը', save: 'Պահպանել', cancel: 'Չեղարկել', namePlaceholder: 'Քո անունը', premium: 'LOUSA Premium', free: 'Հիմնական պրոֆիլ',
    cycle: 'Միջին ցիկլ', period: 'Միջին դաշտան', confirmed: 'Հաստատված ցիկլեր', confidence: 'Կանխատեսման վստահություն', today: 'Այսօր', days: 'օր', logged: 'Լրացված է', notLogged: 'Գրառում չկա', confidenceLabels: { insufficient: 'Տվյալները քիչ են', low: 'Ցածր', medium: 'Միջին', high: 'Բարձր' },
    account: 'Հաշիվ', email: 'Email', phone: 'Հեռախոս', languageLabel: 'Լեզու', notifications: 'Ծանուցումներ', notificationsOn: 'Միացված', notificationsOff: 'Անջատված', notProvided: 'Նշված չէ', deliveryAddress: 'Առաքման հասցե', noAddress: 'Ընտրված չէ', cycleData: 'Ցիկլի տվյալներ', reviewImported: 'Ստուգել տեղափոխված ամսաթվերը', analytics: 'Վերլուծություն', box: 'LOUSA BOX', settings: 'Կարգավորումներ', privacy: 'Գաղտնիություն և պաշտպանություն',
    activeBox: 'Ակտիվ է', noBox: 'Չի ձևակերպվել', editPhoto: 'Փոխել լուսանկարը', removePhoto: 'Ջնջել լուսանկարը', close: 'Փակել', logout: 'Դուրս գալ հաշվից', guest: 'Հյուրի ռեժիմ', guestTitle: 'Դուք օգտագործում եք LOUSA-ն առանց հաշվի', guestBody: 'Ցիկլը, ինքնազգացողությունն ու գրառումները պահվում են տեղային՝ այս սարքում։ Հաշիվ է պետք պահուստավորման, հասցեի, LOUSA BOX-ի և վճարման համար։', createAccount: 'Ստեղծել հաշիվ', signInAccount: 'Մուտք գործել', accountRequired: 'Հաշիվ է անհրաժեշտ', leaveGuest: 'Ջնջել հյուրի տվյալները', leaveGuestTitle: 'Ջնջե՞լ հյուրի տվյալները', leaveGuestText: 'Տեղային ցիկլի գրառումները, ինքնազգացողությունն ու կարգավորումները կհեռացվեն այս սարքից։', leaveGuestConfirm: 'Ջնջել տվյալները',
    logoutTitle: 'Դուրս գա՞լ հաշվից', logoutText: 'Այս հաշվի տվյալները կհեռացվեն սարքից։ Սերվերի հաշիվն ու պատմությունը կմնան պահպանված։', logoutConfirm: 'Դուրս գալ',
  },
} as const;

function MenuRow({ icon, label, value, onPress, danger = false }: { icon: string; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressScale onPress={onPress} style={styles.menuRow} accessibilityLabel={label}>
      <View style={styles.menuLeft}>
        <IconBubble icon={icon} tone={danger ? 'neutral' : 'rose'} size={38} />
        <Text style={[styles.menuLabel, { color: danger ? LousaPalette.danger : colors.onBackground }]}>{label}</Text>
      </View>
      <View style={styles.menuRight}>
        {value ? <Text numberOfLines={2} style={[styles.menuValue, { color: colors.onSurfaceVariant }]}>{value}</Text> : null}
        <MaterialSymbol name="chevron_right" size={20} color={danger ? LousaPalette.danger : colors.onSurfaceVariant} />
      </View>
    </PressScale>
  );
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { compactWidth } = useResponsiveLayout();
  const language = useUserStore((s) => s.language);
  const copy = COPY[language] || COPY.ru;
  const name = useUserStore((s) => s.name);
  const email = useUserStore((s) => s.email);
  const phone = useUserStore((s) => s.phone);
  const setName = useUserStore((s) => s.setName);
  const avatarUri = useUserStore((s) => s.avatarUri);
  const setAvatar = useUserStore((s) => s.setAvatar);
  const isPremium = useUserStore((s) => s.isPremium);
  const isGuestMode = useUserStore((s) => s.isGuestMode);
  const notificationsEnabled = useNotificationStore((s) => s.enabled);
  const notificationPermission = useNotificationStore((s) => s.permissionStatus);
  const avgCycleLength = useCycleStore((s) => s.avgCycleLength);
  const avgPeriodLength = useCycleStore((s) => s.avgPeriodLength);
  const periodRecords = useCycleStore((s) => s.periodRecords);
  const onboardingProfile = useCycleStore((s) => s.onboardingProfile);
  const migrationReviewRequired = useCycleStore((s) => s.migrationReviewRequired);
  const isSubscribed = useBoxStore((s) => s.isSubscribed);
  const deliveryAddress = useBoxStore((s) => s.deliveryAddress);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [photoActions, setPhotoActions] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const prediction = useMemo(() => calculateCyclePrediction(periodRecords, { fallbackCycleLength: avgCycleLength, fallbackPeriodLength: avgPeriodLength, cycleContext: onboardingProfile.cycleContext, factors: onboardingProfile.factors }), [periodRecords, avgCycleLength, avgPeriodLength, onboardingProfile]);

  const pickImage = async () => {
    setPhotoActions(false);
    setPhotoLoading(true);
    const result = await pickAvatar(language, avatarUri);
    if (result) {
      setAvatar(result.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setPhotoLoading(false);
  };

  const saveName = () => {
    const clean = draftName.trim();
    if (!clean) return;
    setName(clean);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const openAccount = (mode: 'signup' | 'signin') => {
    beginGuestAccountUpgrade();
    router.push({ pathname: '/auth/login', params: { mode } });
  };

  const logout = () => {
    if (isGuestMode) {
      Alert.alert(copy.leaveGuestTitle, copy.leaveGuestText, [
        { text: copy.cancel, style: 'cancel' },
        {
          text: copy.leaveGuestConfirm,
          style: 'destructive',
          onPress: () => { clearAllLocalData().finally(() => router.replace('/auth/login')); },
        },
      ]);
      return;
    }
    Alert.alert(copy.logoutTitle, copy.logoutText, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.logoutConfirm,
        style: 'destructive',
        onPress: () => {
          Promise.allSettled([services.auth.signOut(), signOutNativeGoogle()])
            .then(() => clearAllLocalData())
            .finally(() => router.replace('/auth/login'));
        },
      },
    ]);
  };

  return (
    <ModalScreen title={copy.appBar} closeIcon="arrow_back">
      <ScreenScroll>
        <PageIntro title={copy.title} subtitle={copy.subtitle} />
        <SurfaceCard padding={compactWidth ? 18 : 22} style={styles.profileCard}>
          <PressScale onPress={() => setPhotoActions(true)} style={styles.avatarPress} accessibilityLabel={copy.editPhoto}>
            <View style={[styles.avatarShell, { borderColor: colors.primaryContainer }]}> 
              <Image
                source={avatarUri ? { uri: avatarUri } : require('../../assets/images/profile/profile-placeholder.png')}
                style={styles.avatar}
              />
              <View style={styles.editPhotoBadge}>{photoLoading ? <ActivityIndicator size="small" color="#fff" /> : <MaterialSymbol name="photo_camera" size={16} color="#fff" />}</View>
            </View>
          </PressScale>

          <View style={styles.identityBlock}>
            {editing ? (
              <View style={styles.editRow}>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder={copy.namePlaceholder}
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={[styles.nameInput, { color: colors.onBackground, borderColor: colors.outlineVariant }]}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                />
                <PressScale onPress={saveName} style={styles.inlineIcon}><MaterialSymbol name="check" size={20} color="#fff" /></PressScale>
              </View>
            ) : (
              <View style={styles.nameLine}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.onBackground }]}>{name || (isGuestMode ? copy.guest : copy.namePlaceholder)}</Text>
                <PressScale onPress={() => { setDraftName(name); setEditing(true); }} style={styles.smallEdit} accessibilityLabel={copy.edit}>
                  <MaterialSymbol name="edit" size={17} color={LousaPalette.berry} />
                </PressScale>
              </View>
            )}
            <StatusPill label={isGuestMode ? copy.guest : (isPremium ? copy.premium : copy.free)} tone={isGuestMode ? 'warning' : (isPremium ? 'rose' : 'neutral')} icon={isGuestMode ? 'visibility_off' : (isPremium ? 'auto_awesome' : 'person')} />
          </View>
        </SurfaceCard>

        {isGuestMode ? (
          <View style={styles.guestNotice}>
            <InlineMessage title={copy.guestTitle} body={copy.guestBody} tone="warning" />
            <PrimaryButton label={copy.createAccount} icon="lock" onPress={() => openAccount('signup')} />
            <TextButton label={copy.signInAccount} onPress={() => openAccount('signin')} fullWidth />
          </View>
        ) : null}

        <View style={[styles.statsGrid, compactWidth && styles.statsGridCompact]}>
          {[
            { label: copy.cycle, value: `${Math.round(prediction.weightedCycleLength ?? prediction.medianCycleLength ?? avgCycleLength)} ${copy.days}`, icon: 'cycle' },
            { label: copy.period, value: `${Math.round(prediction.averagePeriodLength ?? avgPeriodLength)} ${copy.days}`, icon: 'water_drop' },
            { label: copy.confirmed, value: `${prediction.completedCyclesCount}`, icon: 'fact_check' },
            { label: copy.confidence, value: copy.confidenceLabels[prediction.confidence], icon: 'verified' },
          ].map((item) => (
            <SurfaceCard key={item.label} padding={15} style={styles.statCard}>
              <IconBubble icon={item.icon} tone="rose" size={36} />
              <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>{item.label}</Text>
              <Text style={[styles.statValue, { color: colors.onBackground }]} numberOfLines={2}>{item.value}</Text>
            </SurfaceCard>
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.account} />
          <SurfaceCard padding={4}>
            {!isGuestMode ? <>
              <MenuRow icon="mail" label={copy.email} value={email || copy.notProvided} onPress={() => router.push('/screens/settings')} />
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
              <MenuRow icon="phone" label={copy.phone} value={phone || copy.notProvided} onPress={() => router.push('/screens/settings')} />
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
              <MenuRow icon="language" label={copy.languageLabel} value={language.toUpperCase()} onPress={() => router.push('/screens/settings')} />
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
              <MenuRow icon="notifications" label={copy.notifications} value={notificationsEnabled && notificationPermission === 'granted' ? copy.notificationsOn : copy.notificationsOff} onPress={() => router.push('/screens/notifications')} />
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            </> : null}
            <MenuRow icon="calendar_month" label={copy.cycleData} value={`${prediction.completedCyclesCount} · ${copy.confidenceLabels[prediction.confidence]}`} onPress={() => router.push('/(tabs)/cycle')} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            {migrationReviewRequired ? <>
              <MenuRow icon="priority_high" label={copy.reviewImported} value={`${periodRecords.filter((item) => item.needsReview || (item.source === 'legacy' && !item.confirmed)).length}`} onPress={() => router.push('/screens/period-review')} />
              <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            </> : null}
            <MenuRow icon="monitoring" label={copy.analytics} onPress={() => router.push('/screens/analytics')} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <MenuRow icon="location_on" label={copy.deliveryAddress} value={isGuestMode ? copy.accountRequired : (deliveryAddress?.formattedAddress || copy.noAddress)} onPress={() => isGuestMode ? openAccount('signup') : router.push('/screens/address-map')} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <MenuRow icon="inventory_2" label={copy.box} value={isSubscribed ? copy.activeBox : copy.noBox} onPress={() => router.push('/(tabs)/box')} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <MenuRow icon="shield" label={copy.privacy} onPress={() => router.push('/screens/settings')} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <MenuRow icon="settings" label={copy.settings} onPress={() => router.push('/screens/settings')} />
          </SurfaceCard>
        </View>

        <PressScale onPress={logout} style={styles.logoutButton} accessibilityLabel={isGuestMode ? copy.leaveGuest : copy.logout}>
          <MaterialSymbol name="logout" size={19} color={LousaPalette.danger} />
          <Text style={styles.logoutText}>{isGuestMode ? copy.leaveGuest : copy.logout}</Text>
        </PressScale>
      </ScreenScroll>

      {photoActions ? (
        <View style={styles.overlay}>
          <PressScale onPress={() => setPhotoActions(false)} style={StyleSheet.absoluteFill} haptic={false}><View style={StyleSheet.absoluteFill} /></PressScale>
          <SurfaceCard padding={20} style={styles.photoSheet}>
            <Text style={[styles.sheetTitle, { color: colors.onBackground }]}>{copy.editPhoto}</Text>
            <PrimaryButton label={copy.editPhoto} icon="photo_library" onPress={pickImage} />
            {avatarUri ? (
              <PressScale onPress={() => { deleteStoredAvatar(avatarUri).finally(() => setAvatar(null)); setPhotoActions(false); }} style={styles.sheetSecondary}>
                <MaterialSymbol name="delete" size={19} color={LousaPalette.danger} />
                <Text style={styles.removeText}>{copy.removePhoto}</Text>
              </PressScale>
            ) : null}
            <PressScale onPress={() => setPhotoActions(false)} style={styles.sheetSecondary}>
              <Text style={[styles.closeText, { color: colors.onSurfaceVariant }]}>{copy.close}</Text>
            </PressScale>
          </SurfaceCard>
        </View>
      ) : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  avatarPress: { alignSelf: 'center' },
  avatarShell: { width: 88, height: 88, borderRadius: 44, padding: 3, borderWidth: 1.5 },
  avatar: { width: '100%', height: '100%', borderRadius: 41 },
  editPhotoBadge: { position: 'absolute', right: -2, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: LousaPalette.berry, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF' },
  identityBlock: { flex: 1, gap: 10 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { flexShrink: 1, fontFamily: 'serif', fontSize: 27, lineHeight: 32 },
  smallEdit: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8E8EE' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: { flex: 1, height: 48, borderRadius: 15, borderWidth: 1, paddingHorizontal: 14, fontFamily: 'sans-serif-medium', fontSize: 16 },
  inlineIcon: { width: 48, height: 48, borderRadius: 22, backgroundColor: LousaPalette.berry, alignItems: 'center', justifyContent: 'center' },
  demoBadge: { alignSelf: 'flex-start', marginBottom: 12 },
  guestNotice: { gap: 8, marginTop: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statsGridCompact: { flexDirection: 'row' },
  statCard: { width: '48%', minHeight: 122 },
  statLabel: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 10 },
  statValue: { fontFamily: 'sans-serif-medium', fontSize: 14, lineHeight: 18, marginTop: 3 },
  section: { marginTop: 28 },
  menuRow: { minHeight: 66, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  menuLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 14 },
  menuRight: { maxWidth: '40%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  menuValue: { flexShrink: 1, textAlign: 'right', fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14, opacity: 0.55 },
  logoutButton: { minHeight: 54, marginTop: 22, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(185,79,98,0.22)', backgroundColor: 'rgba(185,79,98,0.07)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  logoutText: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 14 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end', backgroundColor: 'rgba(18,12,20,0.32)' },
  photoSheet: { margin: 14, borderRadius: 30, gap: 12 },
  sheetTitle: { fontFamily: 'serif', fontSize: 24, marginBottom: 4 },
  sheetSecondary: { minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  removeText: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 14 },
  closeText: { fontFamily: 'sans-serif-medium', fontSize: 14 },
});
