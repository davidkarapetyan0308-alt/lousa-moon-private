import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ModalScreen, PageIntro, ScreenScroll } from '../../src/components/layout';
import { IconBubble, PressScale, SectionHeader, StatusPill, SurfaceCard } from '../../src/components/ui';
import { BoxOrder, CourierContact, SupportMessage, SupportTicket } from '../../src/domain/models';
import { apiAdminV22SyncService, apiOrderService, apiSupportService } from '../../src/services/api';
import { useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getUserFacingErrorMessage } from '../../src/services/errorMessages';
import { GuestAccountGate } from '../../src/features/auth/components/GuestAccountGate';

const SENSITIVE_WORDS = [
  'цикл', 'месяч', 'менстру', 'овуляц', 'беремен', 'кров', 'боль', 'симптом', 'настроен', 'mood', 'period', 'cycle', 'pain', 'symptom', 'pregnan', 'ovulat',
];

const COPY = {
  ru: {
    appBar: 'Поддержка',
    title: 'Поддержка LOUSA',
    subtitle: 'Здесь можно написать команде LOUSA, увидеть ответы из админ-панели и связаться с курьером после назначения доставки.',
    synced: 'Связь с админ-панелью активна',
    syncIssue: 'Проверка связи с админ-панелью недоступна',
    safety: 'Безопасность общения',
    safetyText: 'Поддержка видит только безопасные данные обращения и заказа. Курьер видит только имя получателя, телефон, адрес и окно доставки. Цикл, симптомы, настроение, боль и личные заметки скрыты.',
    order: 'Заказ для обращения',
    noOrders: 'Активных заказов пока нет. Вы всё равно можете написать в поддержку.',
    support: 'Новое обращение',
    subject: 'Тема',
    message: 'Сообщение',
    send: 'Отправить',
    cancel: 'Отмена',
    reply: 'Ответить',
    replyPlaceholder: 'Напишите ответ команде LOUSA',
    sent: 'Обращение создано',
    sentText: 'Команда LOUSA увидит его в Support Inbox админ-панели и ответит здесь.',
    courier: 'Курьер',
    courierUnavailable: 'Курьер появится здесь после назначения доставки.',
    callCourier: 'Позвонить курьеру',
    messageCourier: 'Написать курьеру',
    courierMessageHint: 'Коротко: подъезд, ориентир или удобный способ передачи. Не отправляйте медицинские данные.',
    courierBlockedTitle: 'Не отправляйте это курьеру',
    courierBlockedText: 'Сообщение похоже на личные данные о цикле или самочувствии. Отправьте это в поддержку LOUSA, не курьеру.',
    courierSent: 'Сообщение передано команде доставки.',
    tickets: 'Ваши обращения',
    emptyTickets: 'Здесь появится история обращений и ответы команды LOUSA.',
    noMessages: 'Сообщений пока нет.',
    internalHidden: 'Internal notes и служебные комментарии админки скрыты от пользователя.',
    customerVisible: 'Видно вам и поддержке',
    error: 'Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.',
    refresh: 'Обновить', lastReply: 'Последний ответ', closeTicket: 'Закрыть обращение', closeTitle: 'Закрыть обращение?', closeText: 'После закрытия история останется доступна. При необходимости можно создать новое обращение.', closeConfirm: 'Закрыть', closeDone: 'Обращение закрыто', topics: ['Не могу войти', 'Не могу найти адрес', 'Проблема с доставкой', 'Вопрос по циклу', 'Проблема с оплатой', 'Техническая ошибка'],
  },
  en: {
    appBar: 'Support', title: 'LOUSA support', subtitle: 'Message LOUSA, see admin replies, and contact the courier once delivery is assigned.', synced: 'Admin panel sync is active', syncIssue: 'Admin panel sync check is unavailable', safety: 'Communication safety', safetyText: 'Support sees only safe ticket and order details. The courier sees only recipient name, phone, address and delivery window. Cycle, symptoms, mood, pain and private notes are hidden.', order: 'Related order', noOrders: 'No active orders yet. You can still message support.', support: 'New ticket', subject: 'Subject', message: 'Message', send: 'Send', cancel: 'Cancel', reply: 'Reply', replyPlaceholder: 'Write a reply to LOUSA support', sent: 'Ticket created', sentText: 'The LOUSA team will see it in the admin Support Inbox and reply here.', courier: 'Courier', courierUnavailable: 'Courier contact appears after delivery is assigned.', callCourier: 'Call courier', messageCourier: 'Message courier', courierMessageHint: 'Keep it short: entrance, landmark or handoff note. Do not send medical data.', courierBlockedTitle: 'Do not send this to the courier', courierBlockedText: 'This may contain cycle or health details. Send it to LOUSA support instead, not the courier.', courierSent: 'Message passed to the delivery team.', tickets: 'Your tickets', emptyTickets: 'Your support history and LOUSA replies will appear here.', noMessages: 'No messages yet.', internalHidden: 'Admin internal notes are hidden from you.', customerVisible: 'Visible to you and support', error: 'Could not reach the server. Check your connection and try again.', refresh: 'Refresh', lastReply: 'Last reply', closeTicket: 'Close ticket', closeTitle: 'Close this ticket?', closeText: 'The conversation will remain in your history. You can create a new ticket later.', closeConfirm: 'Close', closeDone: 'Ticket closed', topics: ['Cannot sign in', 'Cannot find address', 'Delivery problem', 'Cycle question', 'Payment problem', 'Technical issue'],
  },
  hy: {
    appBar: 'Աջակցություն', title: 'LOUSA աջակցություն', subtitle: 'Գրեք LOUSA թիմին, տեսեք ադմին վահանակի պատասխանները և կապվեք առաքիչի հետ, երբ առաքումը նշանակված է։', synced: 'Ադմին վահանակի կապը ակտիվ է', syncIssue: 'Ադմին վահանակի կապի ստուգումը հասանելի չէ', safety: 'Հաղորդակցության անվտանգություն', safetyText: 'Աջակցությունը տեսնում է միայն անվտանգ դիմումի և պատվերի տվյալներ։ Առաքիչը տեսնում է միայն ստացողի անունը, հեռախոսը, հասցեն և առաքման պատուհանը։ Ցիկլը, ախտանիշները, տրամադրությունը, ցավը և անձնական նշումները թաքցված են։', order: 'Կապված պատվեր', noOrders: 'Ակտիվ պատվեր դեռ չկա։ Կարող եք գրել աջակցությանը։', support: 'Նոր դիմում', subject: 'Թեմա', message: 'Հաղորդագրություն', send: 'Ուղարկել', cancel: 'Չեղարկել', reply: 'Պատասխանել', replyPlaceholder: 'Գրեք պատասխան LOUSA աջակցությանը', sent: 'Դիմումը ստեղծվեց', sentText: 'LOUSA թիմը կտեսնի այն ադմին վահանակում և կպատասխանի այստեղ։', courier: 'Առաքիչ', courierUnavailable: 'Առաքիչը կհայտնվի առաքումը նշանակվելուց հետո։', callCourier: 'Զանգել առաքիչին', messageCourier: 'Գրել առաքիչին', courierMessageHint: 'Կարճ՝ մուտք, կողմնորոշիչ կամ փոխանցման ձև։ Մի ուղարկեք բժշկական տվյալներ։', courierBlockedTitle: 'Մի ուղարկեք սա առաքիչին', courierBlockedText: 'Հաղորդագրությունը կարող է պարունակել ցիկլի կամ առողջական տվյալներ։ Ուղարկեք այն LOUSA աջակցությանը։', courierSent: 'Հաղորդագրությունը փոխանցվեց առաքման թիմին։', tickets: 'Ձեր դիմումները', emptyTickets: 'Դիմումների պատմությունն ու պատասխանները կհայտնվեն այստեղ։', noMessages: 'Հաղորդագրություն դեռ չկա։', internalHidden: 'Ադմին ներքին նշումները թաքցված են ձեզանից։', customerVisible: 'Տեսանելի է ձեզ և աջակցությանը', error: 'Չհաջողվեց կապվել սերվերի հետ։ Ստուգեք կապը և փորձեք կրկին։', refresh: 'Թարմացնել', lastReply: 'Վերջին պատասխանը', closeTicket: 'Փակել դիմումը', closeTitle: 'Փակե՞լ դիմումը', closeText: 'Պատմությունը կմնա հասանելի։ Անհրաժեշտության դեպքում կարող եք ստեղծել նոր դիմում։', closeConfirm: 'Փակել', closeDone: 'Դիմումը փակվեց', topics: ['Չեմ կարող մուտք գործել', 'Չեմ գտնում հասցեն', 'Առաքման խնդիր', 'Ցիկլի հարց', 'Վճարման խնդիր', 'Տեխնիկական սխալ'],
  },
} as const;

function orderLabel(order: BoxOrder) {
  return `${String(order.id).slice(0, 8).toUpperCase()} · ${order.status}`;
}

function containsSensitiveText(value: string) {
  const normalized = value.toLowerCase();
  return SENSITIVE_WORDS.some((word) => normalized.includes(word));
}

function statusTone(status: string): 'neutral' | 'rose' | 'success' | 'warning' | 'night' {
  if (['RESOLVED', 'CLOSED'].includes(status)) return 'success';
  if (['PENDING_CUSTOMER', 'WAITING_FOR_CUSTOMER'].includes(status)) return 'warning';
  if (['URGENT', 'HIGH'].includes(status)) return 'warning';
  return 'rose';
}

function messageLabel(message: SupportMessage) {
  if (message.senderType === 'ADMIN') return 'LOUSA';
  if (message.senderType === 'COURIER') return 'Delivery';
  if (message.senderType === 'SYSTEM') return 'System';
  return 'You';
}

function formatTicketTime(value: string | null | undefined, language: 'ru' | 'en' | 'hy') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const locale = language === 'ru' ? 'ru-RU' : language === 'hy' ? 'hy-AM' : 'en-US';
  return date.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function SupportScreen() {
  const language = useUserStore((s) => s.language);
  const isGuestMode = useUserStore((s) => s.isGuestMode);
  const copy = COPY[language] || COPY.ru;
  if (isGuestMode) return <GuestAccountGate screenTitle={copy.appBar} />;
  return <AuthenticatedSupportScreen />;
}

function AuthenticatedSupportScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((s) => s.language);
  const copy = COPY[language] || COPY.ru;
  const [orders, setOrders] = useState<BoxOrder[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [courier, setCourier] = useState<CourierContact | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [ticketCategory, setTicketCategory] = useState('OTHER');
  const [replyText, setReplyText] = useState('');
  const [courierMessage, setCourierMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncOk, setSyncOk] = useState<boolean | null>(null);

  const selectedTicket = useMemo(() => tickets.find((item) => item.id === selectedTicketId) || tickets[0] || null, [tickets, selectedTicketId]);

  const refresh = async () => {
    const [orderResult, ticketResult, syncResult] = await Promise.all([
      (apiOrderService.listActiveOrders ? apiOrderService.listActiveOrders() : apiOrderService.listOrders()),
      apiSupportService.listTickets(),
      apiAdminV22SyncService.health(),
    ]);
    if (orderResult.ok) {
      setOrders(orderResult.data);
      setSelectedOrderId((current) => current || orderResult.data[0]?.id || null);
    }
    if (ticketResult.ok) {
      setTickets(ticketResult.data);
      setSelectedTicketId((current) => current || ticketResult.data[0]?.id || null);
    }
    setSyncOk(syncResult.ok && Boolean(syncResult.data.supportTickets && syncResult.data.courierContact && syncResult.data.privacyBoundary));
  };

  useEffect(() => { refresh().catch(() => Alert.alert(copy.appBar, copy.error)); }, []);

  useEffect(() => {
    if (!selectedOrderId) { setCourier(null); return; }
    apiSupportService.getCourierContact(selectedOrderId).then((result) => { if (result.ok) setCourier(result.data); }).catch(() => setCourier(null));
  }, [selectedOrderId]);

  const sendTicket = async () => {
    if (!message.trim()) return Alert.alert(copy.support, copy.message);
    setBusy(true);
    const category = selectedOrderId && ticketCategory === 'OTHER' ? 'ORDER' : ticketCategory;
    const result = await apiSupportService.createTicket({ subject: subject.trim() || copy.support, message: message.trim(), category, orderId: selectedOrderId });
    setBusy(false);
    if (!result.ok) return Alert.alert(copy.appBar, getUserFacingErrorMessage(result.error, copy.error));
    setSubject('');
    setMessage('');
    setTicketCategory('OTHER');
    setSelectedTicketId(result.data.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(copy.sent, copy.sentText);
    refresh().catch(() => {});
  };

  const replyToTicket = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setBusy(true);
    const result = await apiSupportService.sendMessage(selectedTicket.id, replyText.trim());
    setBusy(false);
    if (!result.ok) return Alert.alert(copy.support, getUserFacingErrorMessage(result.error, copy.error));
    setReplyText('');
    setTickets((current) => current.map((ticket) => ticket.id === result.data.id ? result.data : ticket));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const closeTicket = () => {
    if (!selectedTicket) return;
    Alert.alert(copy.closeTitle, copy.closeText, [
      { text: copy.cancel || 'Cancel', style: 'cancel' },
      {
        text: copy.closeConfirm,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const result = await apiSupportService.closeTicket(selectedTicket.id);
            setBusy(false);
            if (!result.ok) return Alert.alert(copy.support, getUserFacingErrorMessage(result.error, copy.error));
            setTickets((current) => current.map((ticket) => ticket.id === result.data.id ? result.data : ticket));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            Alert.alert(copy.support, copy.closeDone);
          })();
        },
      },
    ]);
  };

  const callCourier = async () => {
    const phone = courier?.courier?.phone;
    if (!phone) return;
    await Linking.openURL(`tel:${phone}`).catch(() => Alert.alert(copy.courier, copy.error));
  };

  const sendCourier = async () => {
    if (!selectedOrderId || !courierMessage.trim()) return;
    if (containsSensitiveText(courierMessage)) {
      Alert.alert(copy.courierBlockedTitle, copy.courierBlockedText);
      return;
    }
    setBusy(true);
    const result = await apiSupportService.sendCourierMessage(selectedOrderId, courierMessage.trim());
    setBusy(false);
    if (!result.ok) return Alert.alert(copy.courier, getUserFacingErrorMessage(result.error, copy.error));
    setCourierMessage('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(copy.courier, copy.courierSent);
    refresh().catch(() => {});
  };

  return (
    <ModalScreen title={copy.appBar} closeIcon="arrow_back">
      <ScreenScroll>
        <PageIntro title={copy.title} subtitle={copy.subtitle} />

        <View style={styles.section}>
          <SurfaceCard padding={14} tone={syncOk ? 'accent' : 'default'}>
            <View style={styles.safeRow}>
              <IconBubble icon={syncOk ? 'sync' : 'sync_problem'} tone={syncOk ? 'rose' : 'neutral'} size={42} />
              <View style={styles.safeCopy}>
                <Text style={[styles.cardTitle, { color: colors.onBackground }]}>{syncOk ? copy.synced : copy.syncIssue}</Text>
                <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{copy.internalHidden}</Text>
              </View>
              <PressScale onPress={() => refresh().catch(() => Alert.alert(copy.appBar, copy.error))} style={styles.refreshButton}>
                <Text style={styles.refreshText}>{copy.refresh}</Text>
              </PressScale>
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SurfaceCard padding={16}>
            <View style={styles.safeRow}>
              <IconBubble icon="verified_user" tone="rose" size={42} />
              <View style={styles.safeCopy}>
                <Text style={[styles.cardTitle, { color: colors.onBackground }]}>{copy.safety}</Text>
                <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{copy.safetyText}</Text>
              </View>
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.order} />
          <SurfaceCard padding={10}>
            {orders.length ? orders.slice(0, 6).map((order) => {
              const active = order.id === selectedOrderId;
              return (
                <PressScale key={order.id} onPress={() => setSelectedOrderId(order.id)} style={[styles.orderRow, active && styles.orderRowActive, active && isDark && styles.orderRowActiveDark]}>
                  <Text style={[styles.orderText, { color: active ? LousaPalette.berry : colors.onBackground }]}>{orderLabel(order)}</Text>
                  {active ? <MaterialSymbol name="check" size={18} color={LousaPalette.berry} /> : null}
                </PressScale>
              );
            }) : <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{copy.noOrders}</Text>}
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.courier} />
          <SurfaceCard padding={16}>
            {courier?.available ? (
              <>
                <View style={styles.safeRow}>
                  <IconBubble icon="delivery_truck_speed" tone="lavender" size={42} />
                  <View style={styles.safeCopy}>
                    <Text style={[styles.cardTitle, { color: colors.onBackground }]}>{courier.courier?.name}</Text>
                    <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{courier.privacyNote}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  {courier.canCall ? <PressScale onPress={callCourier} style={styles.primaryAction}><Text style={styles.primaryText}>{copy.callCourier}</Text></PressScale> : null}
                </View>
                <Text style={[styles.inputLabel, { color: colors.onBackground }]}>{copy.messageCourier}</Text>
                <TextInput value={courierMessage} onChangeText={setCourierMessage} multiline placeholder={copy.courierMessageHint} placeholderTextColor={colors.onSurfaceVariant} style={[styles.textArea, { color: colors.onBackground, borderColor: colors.outlineVariant }]} />
                <PressScale disabled={busy || !courierMessage.trim()} onPress={sendCourier} style={[styles.primaryWide, (!courierMessage.trim() || busy) && styles.disabled]}><Text style={styles.primaryText}>{copy.send}</Text></PressScale>
              </>
            ) : (
              <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{courier?.message || copy.courierUnavailable}</Text>
            )}
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.tickets} />
          {tickets.length ? tickets.slice(0, 8).map((ticket) => {
            const active = selectedTicket?.id === ticket.id;
            return (
              <PressScale key={ticket.id} onPress={() => setSelectedTicketId(ticket.id)}>
                <SurfaceCard padding={14} style={[styles.ticketCard, active && styles.ticketActive]}>
                  <View style={styles.ticketHeader}>
                    <Text numberOfLines={1} style={[styles.cardTitle, styles.ticketTitle, { color: colors.onBackground }]}>{ticket.subject}</Text>
                    <StatusPill label={ticket.status} tone={statusTone(ticket.status)} />
                  </View>
                  <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{ticket.safeSummary}</Text>
                  {ticket.lastMessageAt ? <Text style={[styles.meta, { color: colors.onSurfaceVariant }]}>{copy.lastReply}: {formatTicketTime(ticket.lastMessageAt, language)}</Text> : null}
                  {ticket.orderCode ? <Text style={[styles.meta, { color: colors.onSurfaceVariant }]}>{ticket.orderCode}</Text> : null}
                </SurfaceCard>
              </PressScale>
            );
          }) : <SurfaceCard padding={16}><Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{copy.emptyTickets}</Text></SurfaceCard>}
        </View>

        {selectedTicket ? (
          <View style={styles.section}>
            <SectionHeader title={selectedTicket.subject} eyebrow={copy.customerVisible} />
            <SurfaceCard padding={14}>
              {selectedTicket.messages?.length ? selectedTicket.messages.map((item) => (
                <View key={item.id} style={[styles.messageBubble, item.senderType === 'CUSTOMER' ? styles.customerMessage : styles.teamMessage]}>
                  <Text style={[styles.messageSender, { color: colors.onSurfaceVariant }]}>{messageLabel(item)}</Text>
                  <Text style={[styles.messageBody, { color: colors.onBackground }]}>{item.body}</Text>
                </View>
              )) : <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{copy.noMessages}</Text>}
              {!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) ? (
                <>
                  <TextInput value={replyText} onChangeText={setReplyText} multiline placeholder={copy.replyPlaceholder} placeholderTextColor={colors.onSurfaceVariant} style={[styles.textArea, styles.replyArea, { color: colors.onBackground, borderColor: colors.outlineVariant }]} />
                  <PressScale disabled={busy || !replyText.trim()} onPress={replyToTicket} style={[styles.primaryWide, (!replyText.trim() || busy) && styles.disabled]}><Text style={styles.primaryText}>{copy.reply}</Text></PressScale>
                  <PressScale disabled={busy} onPress={closeTicket} style={styles.closeAction}><Text style={styles.closeActionText}>{copy.closeTicket}</Text></PressScale>
                </>
              ) : null}
            </SurfaceCard>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title={copy.support} />
          <SurfaceCard padding={16}>
            <View style={styles.topicList}>
              {copy.topics.map((topic, index) => {
                const categories = ['ACCOUNT', 'OTHER', 'DELIVERY', 'OTHER', 'PAYMENT', 'OTHER'];
                const active = subject === topic;
                return (
                  <PressScale
                    key={topic}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => { setSubject(topic); setTicketCategory(categories[index]); }}
                    style={[styles.topicChip, active && styles.topicChipActive]}
                  >
                    <Text style={[styles.topicText, active && styles.topicTextActive]}>{topic}</Text>
                  </PressScale>
                );
              })}
            </View>
            <Text style={[styles.inputLabel, { color: colors.onBackground }]}>{copy.subject}</Text>
            <TextInput value={subject} onChangeText={setSubject} placeholder={copy.subject} placeholderTextColor={colors.onSurfaceVariant} style={[styles.input, { color: colors.onBackground, borderColor: colors.outlineVariant }]} />
            <Text style={[styles.inputLabel, { color: colors.onBackground }]}>{copy.message}</Text>
            <TextInput value={message} onChangeText={setMessage} multiline placeholder={copy.message} placeholderTextColor={colors.onSurfaceVariant} style={[styles.textArea, { color: colors.onBackground, borderColor: colors.outlineVariant }]} />
            <PressScale disabled={busy || !message.trim()} onPress={sendTicket} style={[styles.primaryWide, (!message.trim() || busy) && styles.disabled]}><Text style={styles.primaryText}>{copy.send}</Text></PressScale>
          </SurfaceCard>
        </View>
      </ScreenScroll>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  safeRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  safeCopy: { flex: 1 },
  cardTitle: { fontFamily: 'sans-serif-medium', fontSize: 16, lineHeight: 21 },
  body: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 19, marginTop: 4 },
  meta: { fontFamily: 'sans-serif', fontSize: 11, marginTop: 8 },
  refreshButton: { borderRadius: 16, paddingHorizontal: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8E7ED' },
  refreshText: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 12 },
  orderRow: { minHeight: 50, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderRowActive: { backgroundColor: '#F8E7ED' },
  orderRowActiveDark: { backgroundColor: 'rgba(217,133,165,0.14)' },
  orderText: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  inputLabel: { fontFamily: 'sans-serif-medium', fontSize: 13, marginTop: 12, marginBottom: 8 },
  topicList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  topicChip: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: '#E8DFE4', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  topicChipActive: { borderColor: LousaPalette.berry, backgroundColor: '#F8E7ED' },
  topicText: { fontFamily: 'sans-serif-medium', fontSize: 12, color: '#716771' },
  topicTextActive: { color: LousaPalette.berry },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, fontFamily: 'sans-serif', fontSize: 15 },
  textArea: { minHeight: 112, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingTop: 12, fontFamily: 'sans-serif', fontSize: 15, textAlignVertical: 'top' },
  replyArea: { marginTop: 14, minHeight: 92 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  primaryAction: { backgroundColor: LousaPalette.berry, borderRadius: 18, paddingHorizontal: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primaryWide: { backgroundColor: LousaPalette.berry, borderRadius: 20, minHeight: 52, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontFamily: 'sans-serif-medium', fontSize: 15 },
  closeAction: { minHeight: 48, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  closeActionText: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 14 },
  disabled: { opacity: 0.45 },
  ticketCard: { marginBottom: 10 },
  ticketActive: { borderColor: LousaPalette.berry, borderWidth: 1 },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ticketTitle: { flex: 1 },
  messageBubble: { borderRadius: 18, padding: 12, marginBottom: 10 },
  customerMessage: { backgroundColor: '#F8E7ED' },
  teamMessage: { backgroundColor: '#F2EDF1' },
  messageSender: { fontFamily: 'sans-serif-medium', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  messageBody: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 20 },
});
