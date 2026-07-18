import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useBoxStore, useCycleStore, useNotificationStore, useUserStore, useWellnessStore } from '../store';
import { configureNotificationChannels, readNotificationPermission, sendBoxStatusNotification, syncLousaNotifications } from '../services/notifications';

export function NotificationBootstrap() {
  const enabled = useNotificationStore((s) => s.enabled);
  const privateMode = useNotificationStore((s) => s.privateMode);
  const cycleEnabled = useNotificationStore((s) => s.cycleEnabled);
  const checkInEnabled = useNotificationStore((s) => s.checkInEnabled);
  const boxEnabled = useNotificationStore((s) => s.boxEnabled);
  const lunarEnabled = useNotificationStore((s) => s.lunarEnabled);
  const quietHoursEnabled = useNotificationStore((s) => s.quietHoursEnabled);
  const quietStart = useNotificationStore((s) => s.quietStart);
  const quietEnd = useNotificationStore((s) => s.quietEnd);
  const checkInTime = useNotificationStore((s) => s.checkInTime);
  const checkInFrequency = useNotificationStore((s) => s.checkInFrequency);
  const gentleSound = useNotificationStore((s) => s.gentleSound);
  const deliverySound = useNotificationStore((s) => s.deliverySound);

  const language = useUserStore((s) => s.language);
  const lastPeriodStart = useCycleStore((s) => s.lastPeriodStart);
  const avgCycleLength = useCycleStore((s) => s.avgCycleLength);
  const periodRecords = useCycleStore((s) => s.periodRecords);
  const logs = useWellnessStore((s) => s.dailyLogs);
  const subscribed = useBoxStore((s) => s.isSubscribed);
  const deliveryDate = useBoxStore((s) => s.nextDeliveryDate);
  const paused = useBoxStore((s) => s.paused);
  const status = useBoxStore((s) => s.status);
  const previousStatus = useRef(status);
  const mounted = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    useBoxStore.getState().syncPauseState();
    configureNotificationChannels().catch(() => {});
    readNotificationPermission().catch(() => {});

    const addToInbox = (notification: Notifications.Notification, markRead: boolean) => {
      const content = notification.request.content;
      const rawCategory = content.data?.category;
      const category = rawCategory === 'checkin' ? 'diary' : rawCategory === 'lunar' ? 'moon' : rawCategory === 'cycle' || rawCategory === 'box' ? rawCategory : 'system';
      const screen = typeof content.data?.screen === 'string' ? content.data.screen : undefined;
      useNotificationStore.getState().addInboxItem({
        id: notification.request.identifier,
        category,
        title: content.title || 'LOUSA',
        body: content.body || '',
        route: screen,
        readAt: markRead ? new Date().toISOString() : null,
      });
    };

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => addToInbox(notification, false));
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      addToInbox(response.notification, true);
      const screen = response.notification.request.content.data?.screen;
      if (typeof screen === 'string' && screen.startsWith('/')) router.push(screen as never);
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        useBoxStore.getState().syncPauseState();
        readNotificationPermission().then(() => syncLousaNotifications()).catch(() => {});
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      syncLousaNotifications().catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [
    enabled,
    privateMode,
    cycleEnabled,
    checkInEnabled,
    boxEnabled,
    lunarEnabled,
    quietHoursEnabled,
    quietStart,
    quietEnd,
    checkInTime,
    checkInFrequency,
    gentleSound,
    deliverySound,
    language,
    lastPeriodStart,
    avgCycleLength,
    periodRecords,
    logs,
    subscribed,
    deliveryDate,
    paused,
  ]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      previousStatus.current = status;
      return;
    }
    if (status !== previousStatus.current && (status === 'courier' || status === 'delivered')) {
      sendBoxStatusNotification(status).catch(() => {});
    }
    previousStatus.current = status;
  }, [status]);

  return null;
}
