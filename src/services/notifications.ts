import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  CheckInFrequency,
  NotificationPermissionState,
  useBoxStore,
  useCycleStore,
  useNotificationStore,
  useUserStore,
  useWellnessStore,
} from '../store';
import { addLocalDays, fromLocalDateString, toLocalDateString } from '../utils/date';
import { getMoonPhase } from '../utils/moonPhase';
import { calculateCyclePrediction } from './cyclePrediction';
import { capNotificationCandidates } from './notificationPolicy';

const CHANNELS = {
  gentle: 'lousa-gentle',
  cycle: 'lousa-cycle',
  deliveryAlert: 'lousa-delivery-alert',
  deliveryQuiet: 'lousa-delivery-quiet',
} as const;

export type NotificationCategory = 'cycle' | 'checkin' | 'box' | 'lunar';

type Candidate = {
  key: string;
  category: NotificationCategory;
  date: Date;
  title: string;
  body: string;
  screen: string;
  priority: number;
  sound: boolean;
  channelId: string;
};

const COPY = {
  ru: {
    privateTitle: 'LOUSA',
    privateBody: 'У тебя новое личное напоминание.',
    cycleTitle: 'Прогноз цикла',
    cycle3: 'Окно подготовки открыто. Проверьте LOUSA BOX, адрес и тихие напоминания без спешки.',
    cycle1: 'Цикл может начаться скоро. Проверьте, что нужное уже под рукой.',
    cycle0: 'Сегодня предполагаемый день начала цикла. Отметь изменения, если прогноз не совпал.',
    checkInTitle: 'Мягкая отметка дня',
    checkInBody: 'Как вы себя чувствуете? Короткая запись займёт меньше минуты.',
    boxEditTitle: 'LOUSA BOX',
    boxEditBody: 'Состав следующего бокса ещё можно изменить. LOUSA ничего не добавит без вашего выбора.',
    boxReadyTitle: 'Ваш бокс почти готов',
    boxReadyBody: 'Мы готовим LOUSA BOX к завтрашней доставке.',
    boxTodayTitle: 'Доставка сегодня',
    boxTodayBody: 'LOUSA BOX приедет в выбранный временной интервал.',
    lunarFullTitle: 'Полнолуние сегодня',
    lunarFullBody: 'Можно использовать этот день как повод остановиться и записать свои наблюдения.',
    lunarNewTitle: 'Новолуние сегодня',
    lunarNewBody: 'Спокойный повод сформулировать намерения на новый лунный цикл.',
    courierTitle: 'Курьер уже в пути',
    courierBody: 'Открой приложение, чтобы посмотреть статус доставки.',
    deliveredTitle: 'LOUSA BOX доставлен',
    deliveredBody: 'Всё нужное уже рядом.',
  },
  en: {
    privateTitle: 'LOUSA',
    privateBody: 'You have a new private reminder.',
    cycleTitle: 'Cycle forecast',
    cycle3: 'Your preparation window is open. Check LOUSA BOX, address and quiet reminders without rushing.',
    cycle1: 'Your cycle may start soon. Check that essentials are ready.',
    cycle0: 'Today is the predicted start date. Log any changes if the forecast differs.',
    checkInTitle: 'Gentle check-in',
    checkInBody: 'How are you feeling? A short check-in takes less than a minute.',
    boxEditTitle: 'LOUSA BOX',
    boxEditBody: 'You can still edit the next box. LOUSA will not add anything without your choice.',
    boxReadyTitle: 'Your box is almost ready',
    boxReadyBody: 'We are preparing your LOUSA BOX for tomorrow.',
    boxTodayTitle: 'Delivery today',
    boxTodayBody: 'Your LOUSA BOX will arrive during the selected time window.',
    lunarFullTitle: 'Full moon today',
    lunarFullBody: 'Use today as a gentle prompt to pause and reflect.',
    lunarNewTitle: 'New moon today',
    lunarNewBody: 'A calm moment to set intentions for the next lunar cycle.',
    courierTitle: 'Your courier is on the way',
    courierBody: 'Open the app to view the delivery status.',
    deliveredTitle: 'LOUSA BOX delivered',
    deliveredBody: 'Your care has arrived.',
  },
  hy: {
    privateTitle: 'LOUSA',
    privateBody: 'Դու ունես նոր անձնական հիշեցում։',
    cycleTitle: 'Ցիկլի կանխատեսում',
    cycle3: 'Դաշտանը կարող է սկսվել մոտ 3 օրից։ Ստուգիր կանխատեսումը և անհրաժեշտության դեպքում թարմացրու տվյալները։',
    cycle1: 'Կանխատեսմամբ դաշտանը կարող է սկսվել վաղը։ Նախապատրաստվիր առանց շտապելու։',
    cycle0: 'Այսօր կանխատեսվող սկզբի օրն է։ Նշիր փոփոխությունները, եթե կանխատեսումը չի համընկել։',
    checkInTitle: 'Օրվա մեղմ նշում',
    checkInBody: 'Ինչպե՞ս ես քեզ զգում։ Կարճ գրառումը կտևի մեկ րոպեից քիչ։',
    boxEditTitle: 'LOUSA BOX',
    boxEditBody: 'Հաջորդ տուփի կազմը դեռ կարելի է փոխել։',
    boxReadyTitle: 'Քո տուփը գրեթե պատրաստ է',
    boxReadyBody: 'Մենք պատրաստում ենք LOUSA BOX-ը վաղվա առաքման համար։',
    boxTodayTitle: 'Առաքումն այսօր է',
    boxTodayBody: 'LOUSA BOX-ը կհասնի ընտրված ժամային միջակայքում։',
    lunarFullTitle: 'Այսօր լիալուսին է',
    lunarFullBody: 'Օգտագործիր օրը որպես հանգիստ ինքնադիտարկման առիթ։',
    lunarNewTitle: 'Այսօր նորալուսին է',
    lunarNewBody: 'Հանգիստ պահ՝ նոր լուսնային շրջանի մտադրությունները ձևակերպելու համար։',
    courierTitle: 'Առաքիչը ճանապարհին է',
    courierBody: 'Բացիր հավելվածը՝ առաքման կարգավիճակը տեսնելու համար։',
    deliveredTitle: 'LOUSA BOX-ը առաքված է',
    deliveredBody: 'Քո խնամքն արդեն կողքիդ է։',
  },
} as const;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const prefs = useNotificationStore.getState();
      const category = notification.request.content.data?.category;
      const shouldPlaySound = category === 'box' ? prefs.deliverySound : prefs.gentleSound;
      return {
        shouldShowAlert: true,
        shouldPlaySound,
        shouldSetBadge: false,
      };
    },
  });
}

function permissionFromStatus(status: Notifications.PermissionStatus): NotificationPermissionState {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.UNDETERMINED) return 'unknown';
  return 'denied';
}

export async function configureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNELS.gentle, {
    name: 'LOUSA gentle reminders',
    description: 'Quiet journal and lunar reminders',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });

  await Notifications.setNotificationChannelAsync(CHANNELS.cycle, {
    name: 'LOUSA cycle forecast',
    description: 'Approximate cycle reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });

  await Notifications.setNotificationChannelAsync(CHANNELS.deliveryAlert, {
    name: 'LOUSA BOX delivery alerts',
    description: 'Courier and delivery status with sound',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 180, 100, 180],
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });

  await Notifications.setNotificationChannelAsync(CHANNELS.deliveryQuiet, {
    name: 'LOUSA BOX quiet delivery updates',
    description: 'Courier and delivery status without sound',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

export async function readNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'denied';
  const result = await Notifications.getPermissionsAsync();
  const state = permissionFromStatus(result.status);
  useNotificationStore.getState().setPermissionStatus(state);
  return state;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'denied';

  await configureNotificationChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) {
    useNotificationStore.getState().setPermissionStatus('granted');
    return 'granted';
  }
  if (!current.canAskAgain) {
    useNotificationStore.getState().setPermissionStatus('denied');
    return 'denied';
  }

  const result = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
      allowDisplayInCarPlay: false,
      allowCriticalAlerts: false,
      provideAppNotificationSettings: true,
      allowProvisional: false,
    },
  });
  const state = permissionFromStatus(result.status);
  useNotificationStore.getState().setPermissionStatus(state);
  return state;
}

export async function openSystemNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  return {
    hour: Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 19,
    minute: Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0,
  };
}

function atLocalTime(date: Date, time: string): Date {
  const { hour, minute } = parseTime(time);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function minutesOfDay(value: string): number {
  const { hour, minute } = parseTime(value);
  return hour * 60 + minute;
}

function moveOutsideQuietHours(date: Date, start: string, end: string, enabled: boolean): Date {
  if (!enabled) return date;
  const startMinutes = minutesOfDay(start);
  const endMinutes = minutesOfDay(end);
  const valueMinutes = date.getHours() * 60 + date.getMinutes();
  const overnight = startMinutes > endMinutes;
  const isQuiet = overnight
    ? valueMinutes >= startMinutes || valueMinutes < endMinutes
    : valueMinutes >= startMinutes && valueMinutes < endMinutes;
  if (!isQuiet) return date;

  const result = new Date(date);
  const { hour, minute } = parseTime(end);
  if (overnight && valueMinutes >= startMinutes) result.setDate(result.getDate() + 1);
  result.setHours(hour, minute, 0, 0);
  return result;
}


function meaningfulLog(date: string): boolean {
  const log = useWellnessStore.getState().dailyLogs[date];
  if (!log) return false;
  return Boolean(log.mood || log.symptoms.length || log.notes.trim() || log.water > 0 || log.energy !== 3 || log.sleep !== 7);
}

function checkInDays(frequency: CheckInFrequency): number[] {
  if (frequency === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (frequency === 'three_weekly') return [1, 4, 6];
  return [2, 6];
}

function addCandidate(list: Candidate[], candidate: Candidate): void {
  if (candidate.date.getTime() <= Date.now() + 60_000) return;
  if (list.some((item) => item.key === candidate.key)) return;
  list.push(candidate);
}

function localizeCandidate(candidate: Candidate, privateMode: boolean, language: 'ru' | 'en' | 'hy'): Candidate {
  if (!privateMode) return candidate;
  const copy = COPY[language];
  return { ...candidate, title: copy.privateTitle, body: copy.privateBody };
}

function buildCandidates(): Candidate[] {
  const prefs = useNotificationStore.getState();
  const user = useUserStore.getState();
  const cycle = useCycleStore.getState();
  const box = useBoxStore.getState();
  const copy = COPY[user.language] || COPY.ru;
  const candidates: Candidate[] = [];
  const adjust = (date: Date) => moveOutsideQuietHours(date, prefs.quietStart, prefs.quietEnd, prefs.quietHoursEnabled);

  if (prefs.cycleEnabled) {
    const prediction = calculateCyclePrediction(cycle.periodRecords, {
      fallbackCycleLength: cycle.avgCycleLength,
      fallbackPeriodLength: cycle.avgPeriodLength,
      cycleContext: cycle.onboardingProfile.cycleContext,
      factors: cycle.onboardingProfile.factors,
    });
    if (prediction.mostLikelyStart && prediction.confidence !== 'insufficient') {
      const periodDate = fromLocalDateString(prediction.mostLikelyStart);
      [3, 1, 0].forEach((lead) => {
        const base = addLocalDays(periodDate, -lead);
        const body = lead === 3 ? copy.cycle3 : lead === 1 ? copy.cycle1 : copy.cycle0;
        addCandidate(candidates, {
          key: `cycle-${prediction.mostLikelyStart}-${lead}`,
          category: 'cycle',
          date: adjust(atLocalTime(base, '10:00')),
          title: copy.cycleTitle,
          body,
          screen: '/(tabs)/cycle',
          priority: 80,
          sound: prefs.gentleSound,
          channelId: CHANNELS.cycle,
        });
      });
    }
  }

  if (prefs.checkInEnabled) {
    const allowed = checkInDays(prefs.checkInFrequency);
    for (let offset = 0; offset < 21; offset += 1) {
      const day = addLocalDays(new Date(), offset);
      if (!allowed.includes(day.getDay())) continue;
      const dateString = toLocalDateString(day);
      if (offset === 0 && meaningfulLog(dateString)) continue;
      addCandidate(candidates, {
        key: `checkin-${dateString}`,
        category: 'checkin',
        date: adjust(atLocalTime(day, prefs.checkInTime)),
        title: copy.checkInTitle,
        body: copy.checkInBody,
        screen: '/screens/log-state',
        priority: 30,
        sound: prefs.gentleSound,
        channelId: CHANNELS.gentle,
      });
    }
  }

  if (prefs.boxEnabled && box.isSubscribed && !box.paused) {
    const delivery = fromLocalDateString(box.nextDeliveryDate);
    const boxItems = [
      { offset: -2, time: '11:00', key: 'edit', title: copy.boxEditTitle, body: copy.boxEditBody, priority: 70 },
      { offset: -1, time: '18:00', key: 'ready', title: copy.boxReadyTitle, body: copy.boxReadyBody, priority: 85 },
      { offset: 0, time: '09:00', key: 'today', title: copy.boxTodayTitle, body: copy.boxTodayBody, priority: 100 },
    ];
    boxItems.forEach((item) => {
      const day = addLocalDays(delivery, item.offset);
      addCandidate(candidates, {
        key: `box-${box.nextDeliveryDate}-${item.key}`,
        category: 'box',
        date: adjust(atLocalTime(day, item.time)),
        title: item.title,
        body: item.body,
        screen: '/(tabs)/box',
        priority: item.priority,
        sound: item.offset === 0 ? prefs.deliverySound : false,
        channelId: item.offset === 0 ? (prefs.deliverySound ? CHANNELS.deliveryAlert : CHANNELS.deliveryQuiet) : CHANNELS.cycle,
      });
    });
  }

  if (prefs.lunarEnabled) {
    let fullAdded = false;
    let newAdded = false;
    for (let offset = 0; offset < 35 && (!fullAdded || !newAdded); offset += 1) {
      const day = addLocalDays(new Date(), offset);
      const phase = getMoonPhase(day).phase;
      const previous = getMoonPhase(addLocalDays(day, -1)).phase;
      if (!fullAdded && phase === 'full_moon' && previous !== 'full_moon') {
        addCandidate(candidates, {
          key: `lunar-full-${toLocalDateString(day)}`,
          category: 'lunar',
          date: adjust(atLocalTime(day, '20:00')),
          title: copy.lunarFullTitle,
          body: copy.lunarFullBody,
          screen: '/(tabs)/lunar',
          priority: 20,
          sound: false,
          channelId: CHANNELS.gentle,
        });
        fullAdded = true;
      }
      if (!newAdded && phase === 'new_moon' && previous !== 'new_moon') {
        addCandidate(candidates, {
          key: `lunar-new-${toLocalDateString(day)}`,
          category: 'lunar',
          date: adjust(atLocalTime(day, '20:00')),
          title: copy.lunarNewTitle,
          body: copy.lunarNewBody,
          screen: '/(tabs)/lunar',
          priority: 20,
          sound: false,
          channelId: CHANNELS.gentle,
        });
        newAdded = true;
      }
    }
  }

  return capNotificationCandidates(candidates).map((candidate) => localizeCandidate(candidate, prefs.privateMode, user.language));
}

export async function cancelLousaNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function syncLousaNotifications(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const prefs = useNotificationStore.getState();
  const permission = await readNotificationPermission();
  if (!prefs.enabled || permission !== 'granted') {
    await cancelLousaNotifications();
    return 0;
  }

  await configureNotificationChannels();
  await cancelLousaNotifications();
  const candidates = buildCandidates();

  for (const item of candidates) {
    await Notifications.scheduleNotificationAsync({
      identifier: `lousa-${item.key}`,
      content: {
        title: item.title,
        body: item.body,
        sound: item.sound ? 'default' : false,
        priority: item.priority >= 90 ? Notifications.AndroidNotificationPriority.HIGH : item.priority >= 60 ? Notifications.AndroidNotificationPriority.DEFAULT : Notifications.AndroidNotificationPriority.LOW,
        interruptionLevel: item.priority >= 90 ? 'active' : 'passive',
        data: { screen: item.screen, category: item.category, lousaManaged: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.date,
        channelId: item.channelId,
      },
    });
  }

  useNotificationStore.getState().setLastSyncedAt(new Date().toISOString());
  return candidates.length;
}

export async function sendBoxStatusNotification(status: 'courier' | 'delivered'): Promise<void> {
  if (Platform.OS === 'web') return;
  const prefs = useNotificationStore.getState();
  if (!prefs.enabled || !prefs.boxEnabled || prefs.permissionStatus !== 'granted') return;
  const language = useUserStore.getState().language;
  const copy = COPY[language] || COPY.ru;
  const privateMode = prefs.privateMode;
  const title = privateMode ? copy.privateTitle : status === 'courier' ? copy.courierTitle : copy.deliveredTitle;
  const body = privateMode ? copy.privateBody : status === 'courier' ? copy.courierBody : copy.deliveredBody;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: prefs.deliverySound ? 'default' : false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      interruptionLevel: 'active',
      data: { screen: '/(tabs)/box', category: 'box', lousaManaged: true },
    },
    trigger: { channelId: prefs.deliverySound ? CHANNELS.deliveryAlert : CHANNELS.deliveryQuiet },
  });
}

export function getNotificationSummary(): { enabled: boolean; permission: NotificationPermissionState; nextCount: number | null } {
  const state = useNotificationStore.getState();
  return { enabled: state.enabled, permission: state.permissionStatus, nextCount: null };
}

export async function scheduleTestNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  const prefs = useNotificationStore.getState();
  const language = useUserStore.getState().language;
  const copy = COPY[language] || COPY.ru;
  const title = prefs.privateMode ? copy.privateTitle : copy.checkInTitle;
  const body = prefs.privateMode ? copy.privateBody : copy.checkInBody;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: prefs.gentleSound ? 'default' : false,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      interruptionLevel: 'active',
      data: { screen: '/screens/notifications', category: 'checkin', lousaManaged: false },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: CHANNELS.gentle,
    },
  });
}
