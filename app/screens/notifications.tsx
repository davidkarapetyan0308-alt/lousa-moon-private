import React, { useEffect, useState } from 'react';
import { Alert, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ModalScreen, PageIntro, ScreenScroll } from '../../src/components/layout';
import { IconBubble, InlineMessage, PressScale, SectionHeader, StatusPill, SurfaceCard } from '../../src/components/ui';
import { useNotificationStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { apiNotificationService } from '../../src/services/api';
import {
  cancelLousaNotifications,
  openSystemNotificationSettings,
  readNotificationPermission,
  requestNotificationPermission,
  scheduleTestNotification,
  syncLousaNotifications,
} from '../../src/services/notifications';

const COPY = {
  ru: {
    appBar: 'Уведомления', title: 'Спокойные уведомления', subtitle: 'LOUSA напоминает только о важном. По умолчанию — не больше двух уведомлений в день и никаких рекламных сообщений.',
    inbox: 'Центр уведомлений', unread: 'непрочитано', markAll: 'Прочитать всё', clear: 'Очистить', emptyInbox: 'Новых уведомлений пока нет.', syncInbox: 'Обновить из LOUSA',
    master: 'Разрешить уведомления', masterDesc: 'Системное разрешение и главный выключатель всех напоминаний.',
    granted: 'Разрешены', denied: 'Запрещены', unknown: 'Не настроены', openSettings: 'Открыть настройки телефона',
    whyTitle: 'Разрешить уведомления?', whyText: 'LOUSA будет присылать прогноз цикла и статусы доставки. Дневник и лунные напоминания остаются выключенными, пока ты сама их не включишь.', allow: 'Разрешить', later: 'Не сейчас',
    deniedTitle: 'Уведомления выключены', deniedText: 'Разрешите уведомления в настройках телефона, чтобы получать прогнозы и статусы доставки.',
    categories: 'Что присылать', cycle: 'Прогноз цикла', cycleDesc: 'Только за 3 дня, за 1 день и в предполагаемый день начала.', checkin: 'Мягкий дневник', checkinDesc: 'Короткое напоминание в выбранные дни, без ежедневного спама.', box: 'LOUSA BOX', boxDesc: 'Состав, сборка, доставка и курьер.', lunar: 'Лунные события', lunarDesc: 'Только новолуние и полнолуние, не чаще двух раз в месяц.',
    rhythm: 'Ритм и тишина', checkinTime: 'Время дневника', frequency: 'Частота дневника', twice: '2 раза в неделю', three: '3 раза в неделю', daily: 'Каждый день', quiet: 'Тихие часы', quietDesc: 'Никаких напоминаний ночью. Срочные статусы доставки переносятся на утро, если это возможно.',
    privacy: 'Приватность', privateMode: 'Скрывать содержание', privateModeDesc: 'На экране блокировки будет нейтральный текст без упоминания цикла и симптомов.',
    sounds: 'Звук', gentleSound: 'Звук мягких напоминаний', gentleSoundDesc: 'Для цикла и дневника. По умолчанию выключен.', deliverySound: 'Звук доставки', deliverySoundDesc: 'Только для курьера и завершённой доставки.',
    test: 'Проверка', testButton: 'Отправить тест через 3 секунды', testHint: 'Тест не влияет на расписание.', saved: 'Расписание обновлено', updated: 'Данные обновлены', noUpdates: 'Новых уведомлений нет', updateFailed: 'Не удалось обновить. Попробуйте ещё раз.', lastSync: 'Последняя синхронизация',
  },
  en: {
    appBar: 'Notifications', title: 'Calm notifications', subtitle: 'LOUSA only reminds you about what matters. By default: no more than two notifications per day and no promotional messages.',
    inbox: 'Notification center', unread: 'unread', markAll: 'Mark all read', clear: 'Clear', emptyInbox: 'No new notifications yet.', syncInbox: 'Sync from LOUSA',
    master: 'Allow notifications', masterDesc: 'System permission and the master switch for all reminders.',
    granted: 'Allowed', denied: 'Blocked', unknown: 'Not set', openSettings: 'Open phone settings',
    whyTitle: 'Allow notifications?', whyText: 'LOUSA can send cycle forecasts and delivery status. Journal and lunar reminders stay off until you enable them.', allow: 'Allow', later: 'Not now',
    deniedTitle: 'Notifications are off', deniedText: 'Allow notifications in your phone settings to receive forecasts and delivery updates.',
    categories: 'What to receive', cycle: 'Cycle forecast', cycleDesc: 'Only 3 days before, 1 day before, and on the predicted start day.', checkin: 'Gentle journal', checkinDesc: 'A short reminder on selected days, not every day by default.', box: 'LOUSA BOX', boxDesc: 'Contents, packing, delivery and courier.', lunar: 'Lunar events', lunarDesc: 'Only new moon and full moon, at most twice per month.',
    rhythm: 'Rhythm & quiet', checkinTime: 'Journal time', frequency: 'Journal frequency', twice: 'Twice a week', three: 'Three times a week', daily: 'Every day', quiet: 'Quiet hours', quietDesc: 'No reminders at night. Delivery updates are moved to the morning when possible.',
    privacy: 'Privacy', privateMode: 'Hide content', privateModeDesc: 'The lock screen shows neutral text without cycle or symptom details.',
    sounds: 'Sound', gentleSound: 'Gentle reminder sound', gentleSoundDesc: 'For cycle and journal reminders. Off by default.', deliverySound: 'Delivery sound', deliverySoundDesc: 'Only for courier and completed delivery.',
    test: 'Test', testButton: 'Send a test in 3 seconds', testHint: 'The test does not change your schedule.', saved: 'Schedule updated', updated: 'Data updated', noUpdates: 'No new notifications', updateFailed: 'Could not update. Try again.', lastSync: 'Last sync',
  },
  hy: {
    appBar: 'ԾԱՆՈՒՑՈՒՄՆԵՐ', title: 'Հանգիստ ծանուցումներ', subtitle: 'LOUSA-ն հիշեցնում է միայն կարևորի մասին։ Լռելյայն՝ օրական առավելագույնը երկու ծանուցում և ոչ մի գովազդային հաղորդագրություն։',
    inbox: 'Ծանուցումների կենտրոն', unread: 'չկարդացված', markAll: 'Կարդալ բոլորը', clear: 'Մաքրել', emptyInbox: 'Նոր ծանուցումներ դեռ չկան։', syncInbox: 'Թարմացնել LOUSA-ից',
    master: 'Թույլատրել ծանուցումները', masterDesc: 'Համակարգային թույլտվություն և բոլոր հիշեցումների գլխավոր անջատիչ։',
    granted: 'Թույլատրված է', denied: 'Արգելված է', unknown: 'Կարգավորված չէ', openSettings: 'Բացել հեռախոսի կարգավորումները',
    whyTitle: 'Թույլատրե՞լ ծանուցումները', whyText: 'LOUSA-ն կարող է ուղարկել ցիկլի կանխատեսում և առաքման կարգավիճակ։ Օրագիրն ու լուսնային հիշեցումները կմնան անջատված, մինչև դու միացնես դրանք։', allow: 'Թույլատրել', later: 'Հետո',
    deniedTitle: 'Ծանուցումներն անջատված են', deniedText: 'Թույլատրեք ծանուցումները հեռախոսի կարգավորումներում՝ կանխատեսումներ և առաքման կարգավիճակ ստանալու համար։',
    categories: 'Ինչ ստանալ', cycle: 'Ցիկլի կանխատեսում', cycleDesc: 'Միայն 3 օր առաջ, 1 օր առաջ և կանխատեսվող սկզբի օրը։', checkin: 'Մեղմ օրագիր', checkinDesc: 'Կարճ հիշեցում ընտրված օրերին՝ առանց ամենօրյա սպամի։', box: 'LOUSA BOX', boxDesc: 'Կազմ, հավաքում, առաքում և առաքիչ։', lunar: 'Լուսնային իրադարձություններ', lunarDesc: 'Միայն նորալուսին և լիալուսին՝ ամսական առավելագույնը երկու անգամ։',
    rhythm: 'Ռիթմ և լռություն', checkinTime: 'Օրագրի ժամը', frequency: 'Օրագրի հաճախականությունը', twice: 'Շաբաթը 2 անգամ', three: 'Շաբաթը 3 անգամ', daily: 'Ամեն օր', quiet: 'Լուռ ժամեր', quietDesc: 'Գիշերը հիշեցումներ չեն գա։ Առաքման ծանուցումները հնարավորության դեպքում կտեղափոխվեն առավոտ։',
    privacy: 'Գաղտնիություն', privateMode: 'Թաքցնել բովանդակությունը', privateModeDesc: 'Կողպված էկրանին կերևա չեզոք տեքստ՝ առանց ցիկլի կամ ախտանիշների։',
    sounds: 'Ձայն', gentleSound: 'Մեղմ հիշեցումների ձայն', gentleSoundDesc: 'Ցիկլի և օրագրի համար։ Լռելյայն անջատված է։', deliverySound: 'Առաքման ձայն', deliverySoundDesc: 'Միայն առաքիչի և ավարտված առաքման համար։',
    test: 'Փորձարկում', testButton: 'Ուղարկել փորձնականը 3 վայրկյանից', testHint: 'Փորձարկումը չի փոխում ժամանակացույցը։', saved: 'Ժամանակացույցը թարմացվել է', updated: 'Տվյալները թարմացվեցին', noUpdates: 'Նոր ծանուցումներ չկան', updateFailed: 'Չհաջողվեց թարմացնել։ Փորձեք կրկին։', lastSync: 'Վերջին համաժամացումը',
  },
} as const;

function LousaSwitch({ value, onPress, disabled = false }: { value: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <PressScale disabled={disabled} onPress={onPress} style={[styles.switchTrack, value && styles.switchTrackOn, disabled && styles.disabled]}>
      <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
    </PressScale>
  );
}

function Row({ icon, title, description, right }: { icon: string; title: string; description?: string; right: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <IconBubble icon={icon} tone="rose" size={38} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: colors.onSurfaceVariant }]}>{description}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function Chips({ values, selected, onSelect, disabled = false }: { values: { id: string; label: string }[]; selected: string; onSelect: (id: string) => void; disabled?: boolean }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.chips}>
      {values.map((item) => {
        const active = selected === item.id;
        return (
          <PressScale key={item.id} disabled={disabled} onPress={() => onSelect(item.id)} style={[styles.chip, disabled && styles.disabled, { borderColor: active ? LousaPalette.berry : colors.outlineVariant, backgroundColor: active ? (isDark ? 'rgba(217,133,165,0.18)' : '#F8E7ED') : 'transparent' }]}>
            <Text style={[styles.chipText, { color: active ? LousaPalette.berry : colors.onSurfaceVariant }]}>{item.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const language = useUserStore((s) => s.language);
  const copy = COPY[language] || COPY.ru;
  const store = useNotificationStore();
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncTone, setSyncTone] = useState<'success' | 'neutral' | 'danger'>('neutral');
  const unreadCount = store.inbox.filter((item) => !item.readAt).length;

  const refreshRemoteInbox = async (showResult = false) => {
    const before = new Set(store.inbox.map((item) => item.remoteId || item.id));
    const result = await apiNotificationService.listInbox();
    if (!result.ok) {
      if (showResult) { setSyncTone('danger'); setSyncMessage(copy.updateFailed); }
      return;
    }
    result.data.slice().reverse().forEach((item) => {
      store.addInboxItem({ ...item, id: item.remoteId || item.id });
    });
    store.setLastSyncedAt(new Date().toISOString());
    if (showResult) {
      const hasNew = result.data.some((item) => !before.has(item.remoteId || item.id));
      setSyncTone(hasNew ? 'success' : 'neutral');
      setSyncMessage(hasNew ? copy.updated : copy.noUpdates);
    }
  };

  useEffect(() => {
    readNotificationPermission().catch(() => {});
    refreshRemoteInbox().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        readNotificationPermission().then((permission) => {
          if (permission === 'granted' && useNotificationStore.getState().enabled) {
            syncLousaNotifications().then(() => setSyncMessage(copy.saved)).catch(() => {});
          }
        }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  const sync = async () => {
    await syncLousaNotifications();
    Haptics.selectionAsync().catch(() => {});
  };

  const toggleMaster = () => {
    if (store.enabled) {
      store.setEnabled(false);
      cancelLousaNotifications().catch(() => {});
      return;
    }
    Alert.alert(copy.whyTitle, copy.whyText, [
      { text: copy.later, style: 'cancel' },
      {
        text: copy.allow,
        onPress: async () => {
          setBusy(true);
          const result = await requestNotificationPermission().catch(() => 'denied' as const);
          setBusy(false);
          if (result === 'granted') {
            store.setEnabled(true);
            await syncLousaNotifications().catch(() => {});
            store.setLastSyncedAt(new Date().toISOString());
            setSyncTone('success');
            setSyncMessage(copy.saved);
          } else {
            store.setEnabled(false);
            Alert.alert(copy.deniedTitle, copy.deniedText, [
              { text: copy.later, style: 'cancel' },
              { text: copy.openSettings, onPress: () => openSystemNotificationSettings().catch(() => {}) },
            ]);
          }
        },
      },
    ]);
  };

  const permissionLabel = store.permissionStatus === 'granted' ? copy.granted : store.permissionStatus === 'denied' ? copy.denied : copy.unknown;
  const permissionTone = store.permissionStatus === 'granted' ? 'success' : store.permissionStatus === 'denied' ? 'warning' : 'neutral';
  const disabled = !store.enabled || store.permissionStatus !== 'granted';

  return (
    <ModalScreen title={copy.appBar} closeIcon="arrow_back">
      <ScreenScroll>
        <PageIntro title={copy.title} subtitle={copy.subtitle} />


        <View style={styles.section}>
          <View style={styles.inboxHeader}>
            <View>
              <SectionHeader title={copy.inbox} />
              <Text style={[styles.inboxMeta, { color: colors.onSurfaceVariant }]}>{unreadCount} {copy.unread}</Text>
            </View>
            <View style={styles.inboxActions}>
              {unreadCount ? <PressScale onPress={() => { store.markAllRead(); apiNotificationService.markAllRead?.().catch(() => {}); }} style={styles.textAction}><Text style={styles.textActionLabel}>{copy.markAll}</Text></PressScale> : null}
              <PressScale onPress={() => refreshRemoteInbox(true).catch(() => { setSyncTone('danger'); setSyncMessage(copy.updateFailed); })} style={styles.textAction}><Text style={styles.textActionLabel}>{copy.syncInbox}</Text></PressScale>
              {store.inbox.length ? <PressScale onPress={store.clearInbox} style={styles.textAction}><Text style={[styles.textActionLabel, { color: LousaPalette.danger }]}>{copy.clear}</Text></PressScale> : null}
            </View>
          </View>
          {store.inbox.length ? (
            <SurfaceCard padding={4}>
              {store.inbox.slice(0, 8).map((item, index) => (
                <React.Fragment key={item.id}>
                  {index ? <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} /> : null}
                  <PressScale onPress={() => { store.markInboxRead(item.id); apiNotificationService.markRead(item.remoteId || item.id).catch(() => {}); if (item.route) router.push(item.route as never); }} style={styles.inboxRow}>
                    <IconBubble icon={item.category === 'box' ? 'redeem' : item.category === 'cycle' ? 'calendar_month' : item.category === 'diary' ? 'edit_note' : item.category === 'moon' ? 'brightness_2' : item.category === 'support' ? 'support_agent' : item.category === 'delivery' ? 'delivery_truck_speed' : 'notifications'} tone={item.readAt ? 'neutral' : 'rose'} size={38} />
                    <View style={styles.inboxCopy}>
                      <View style={styles.inboxTitleRow}><Text numberOfLines={1} style={[styles.inboxTitle, { color: colors.onBackground }]}>{item.title}</Text>{!item.readAt ? <View style={styles.unreadDot} /> : null}</View>
                      <Text numberOfLines={2} style={[styles.inboxBody, { color: colors.onSurfaceVariant }]}>{store.privateMode && item.privateBody ? item.privateBody : item.body}</Text>
                    </View>
                    <MaterialSymbol name="chevron_right" size={18} color={colors.onSurfaceVariant} />
                  </PressScale>
                </React.Fragment>
              ))}
            </SurfaceCard>
          ) : (
            <SurfaceCard padding={18}><Text style={[styles.emptyInbox, { color: colors.onSurfaceVariant }]}>{copy.emptyInbox}</Text></SurfaceCard>
          )}
        </View>
        {syncMessage ? <View style={styles.syncResult}><InlineMessage body={syncMessage} tone={syncTone} /></View> : null}
        {store.lastSyncedAt ? <Text style={[styles.lastSync, { color: colors.onSurfaceVariant }]}>{copy.lastSync}: {new Date(store.lastSyncedAt).toLocaleString()}</Text> : null}
        <View style={styles.section}>
          {store.permissionStatus === 'denied' ? <View style={styles.deniedMessage}><InlineMessage title={copy.deniedTitle} body={copy.deniedText} tone="warning" /></View> : null}
          <SurfaceCard padding={4}>
            <Row icon="notifications" title={copy.master} description={copy.masterDesc} right={<LousaSwitch value={store.enabled && store.permissionStatus === 'granted'} onPress={toggleMaster} disabled={busy} />} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <View style={styles.permissionRow}>
              <StatusPill label={permissionLabel} tone={permissionTone as any} />
              {store.permissionStatus === 'denied' ? (
                <PressScale onPress={() => openSystemNotificationSettings().catch(() => {})} style={styles.linkButton}>
                  <Text style={styles.linkText}>{copy.openSettings}</Text>
                </PressScale>
              ) : null}
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.categories} />
          <SurfaceCard padding={4}>
            {[
              ['cycleEnabled', 'calendar_month', copy.cycle, copy.cycleDesc],
              ['checkInEnabled', 'edit_note', copy.checkin, copy.checkinDesc],
              ['boxEnabled', 'redeem', copy.box, copy.boxDesc],
              ['lunarEnabled', 'brightness_2', copy.lunar, copy.lunarDesc],
            ].map((item, index) => {
              const key = item[0] as 'cycleEnabled' | 'checkInEnabled' | 'boxEnabled' | 'lunarEnabled';
              return (
                <React.Fragment key={key}>
                  {index ? <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} /> : null}
                  <Row icon={item[1]} title={item[2]} description={item[3]} right={<LousaSwitch disabled={disabled} value={!disabled && store[key]} onPress={() => { store.setCategory(key, !store[key]); setTimeout(() => sync().catch(() => {}), 0); }} />} />
                </React.Fragment>
              );
            })}
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.rhythm} />
          <SurfaceCard padding={16}>
            <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>{copy.checkinTime}</Text>
            <Chips disabled={disabled} values={['18:00', '19:00', '20:00'].map((id) => ({ id, label: id }))} selected={store.checkInTime} onSelect={(value) => { store.setCheckInTime(value); setTimeout(() => sync().catch(() => {}), 0); }} />
            <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.frequency}</Text>
            <Chips disabled={disabled} values={[{ id: 'twice_weekly', label: copy.twice }, { id: 'three_weekly', label: copy.three }, { id: 'daily', label: copy.daily }]} selected={store.checkInFrequency} onSelect={(value) => { store.setCheckInFrequency(value as any); setTimeout(() => sync().catch(() => {}), 0); }} />
          </SurfaceCard>
          <View style={styles.smallGap} />
          <SurfaceCard padding={4}>
            <Row icon="bedtime" title={copy.quiet} description={`${copy.quietDesc} ${store.quietStart}–${store.quietEnd}`} right={<LousaSwitch disabled={disabled} value={!disabled && store.quietHoursEnabled} onPress={() => { store.setQuietHoursEnabled(!store.quietHoursEnabled); setTimeout(() => sync().catch(() => {}), 0); }} />} />
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.privacy} />
          <SurfaceCard padding={4}>
            <Row icon="visibility_off" title={copy.privateMode} description={copy.privateModeDesc} right={<LousaSwitch value={store.privateMode} onPress={() => { store.setPrivateMode(!store.privateMode); setTimeout(() => sync().catch(() => {}), 0); }} />} />
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.sounds} />
          <SurfaceCard padding={4}>
            <Row icon="volume_off" title={copy.gentleSound} description={copy.gentleSoundDesc} right={<LousaSwitch disabled={disabled} value={!disabled && store.gentleSound} onPress={() => { store.setGentleSound(!store.gentleSound); setTimeout(() => sync().catch(() => {}), 0); }} />} />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />
            <Row icon="delivery_dining" title={copy.deliverySound} description={copy.deliverySoundDesc} right={<LousaSwitch disabled={disabled} value={!disabled && store.deliverySound} onPress={() => { store.setDeliverySound(!store.deliverySound); setTimeout(() => sync().catch(() => {}), 0); }} />} />
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.test} />
          <SurfaceCard padding={16}>
            <PressScale disabled={disabled || Platform.OS === 'web'} onPress={async () => { await scheduleTestNotification().catch(() => {}); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }} style={[styles.testButton, (disabled || Platform.OS === 'web') && styles.disabled]}>
              <MaterialSymbol name="notifications_active" size={20} color="#FFFFFF" />
              <Text style={styles.testText}>{copy.testButton}</Text>
            </PressScale>
            <Text style={[styles.testHint, { color: colors.onSurfaceVariant }]}>{copy.testHint}</Text>
          </SurfaceCard>
        </View>
      </ScreenScroll>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 26 },
  deniedMessage: { marginBottom: 10 },
  syncResult: { marginTop: -14, marginBottom: 10 },
  lastSync: { fontFamily: 'sans-serif', fontSize: 11.5, marginTop: -4, marginBottom: 18 },
  inboxHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  inboxMeta: { fontFamily: 'sans-serif', fontSize: 12, marginTop: -12, marginBottom: 10 },
  inboxActions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 6 },
  textAction: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  textActionLabel: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 12 },
  inboxRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 10 },
  inboxCopy: { flex: 1 },
  inboxTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  inboxTitle: { flexShrink: 1, fontFamily: 'sans-serif-medium', fontSize: 13.5 },
  inboxBody: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16, marginTop: 3 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: LousaPalette.rose },
  emptyInbox: { fontFamily: 'sans-serif', fontSize: 13, textAlign: 'center' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  copy: { flex: 1 },
  title: { fontFamily: 'sans-serif-medium', fontSize: 14 },
  description: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16, marginTop: 3 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14, opacity: 0.55 },
  switchTrack: { width: 48, height: 29, borderRadius: 15, backgroundColor: '#DDD3D8', padding: 3, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: LousaPalette.berry },
  switchThumb: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFFFFF' },
  switchThumbOn: { alignSelf: 'flex-end' },
  disabled: { opacity: 0.45 },
  permissionRow: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  linkButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 },
  linkText: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 12 },
  fieldLabel: { fontFamily: 'sans-serif-medium', fontSize: 13, marginBottom: 10 },
  fieldGap: { marginTop: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  smallGap: { height: 10 },
  testButton: { minHeight: 52, borderRadius: 18, backgroundColor: LousaPalette.berry, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  testText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 14 },
  testHint: { fontFamily: 'sans-serif', fontSize: 12, textAlign: 'center', marginTop: 10 },
});
