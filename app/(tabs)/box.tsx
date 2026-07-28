import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ScreenScroll, TabbedScreen } from '../../src/components/layout';
import { DeliveryMapPreview } from '../../src/components/DeliveryMapPreview';
import {
  HeroCard,
  InlineMessage,
  ListRow,
  ListSection,
  PrimaryButton,
  SectionSurface,
  StatusPill,
  TextButton,
} from '../../src/components/ui';
import { BOX_PLANS, formatAmd } from '../../src/data/boxCatalog';
import { useBoxStore, useCycleStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getCycleData } from '../../src/utils/cycleEngine';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import { buildPreparationWindowCopy, calculatePreparationWindow } from '../../src/services/preparationWindow';
import { getUserFacingErrorMessage } from '../../src/services/errorMessages';
import { fromLocalDateString } from '../../src/utils/date';
import { getServiceMode, services } from '../../src/services';
import type { SubscriptionAction } from '../../src/services/contracts';
import { beginGuestAccountUpgrade } from '../../src/features/auth/guest/guestSession';

const COPY = {
  ru: {
    title: 'LOUSA BOX', subtitle: 'Бокс, который помогает подготовиться заранее. Вы выбираете состав — LOUSA ничего не добавляет без подтверждения.',
    prediction: 'Планирование доставки', preparation: 'Окно подготовки LOUSA', days: 'дн. до следующей менструации', inside: 'LOUSA BOX',
    choose: 'Собрать LOUSA BOX', guestChoose: 'Создать аккаунт для заказа', guestNote: 'В гостевом режиме можно посмотреть состав и рекомендации. Для адреса, оплаты, заказа и отслеживания доставки нужен аккаунт.', benefits: [
      ['favorite', 'Входит в тариф', 'Базовые средства на цикл. Состав можно уточнить перед заказом.'],
      ['local_cafe', 'Можно добавить', 'Тепло, чай, снек или дополнительные средства — только если вы выберете их вручную.'],
      ['auto_awesome', 'Мягкие детали', 'Карточка заботы и небольшой подарок месяца.'],
    ],
    active: 'Активная подписка', paused: 'На паузе', noOrder: 'Бокс ещё не заказан', noOrderBody: 'Выберите дату доставки и адрес.', orderAccepted: 'Заказ принят', orderAcceptedBody: 'Мы подготовим бокс и сообщим, когда он будет передан курьеру.', onWay: 'Доставка в пути', dateMissing: 'Дата доставки не выбрана', dateMissingBody: 'Укажите удобное окно доставки.', addressIncomplete: 'Адрес заполнен не полностью', next: 'Следующая доставка', deliveryWindow: 'Временное окно', delivery: 'Путь вашего бокса', manage: 'Изменить состав', pause: 'Поставить на паузу', resume: 'Возобновить',
    privacy: 'Курьер видит только адрес, телефон и время доставки — данные цикла ему недоступны.',
    progress: 'Готовность заказа', eta: 'Следующий этап', personal: 'Состав под вашим контролем', order: 'Заказ', nextStage: 'Следующий этап', feedback: 'Оценить бокс', updateStatus: 'Обновить статус', pause30: 'Пауза на 30 дней', addressTitle: 'Адрес доставки', fixAddress: 'Исправить адрес', noAddress: 'Адрес ещё не добавлен', missingAddress: 'Не заполнено поле', addressLabels: { city: 'Город', region: 'Регион', street: 'Улица', house: 'Дом', entrance: 'Подъезд', floor: 'Этаж', apartment: 'Квартира', intercom: 'Домофон', comment: 'Комментарий', map: 'Точка на карте' }, stepLabels: { scheduled: 'Бокс запланирован', packing: 'Собираем ваш LOUSA BOX', courier: 'Курьер назначен', delivered: 'Бокс доставлен' },
  },
  en: {
    title: 'LOUSA BOX', subtitle: 'A preparation box you control. LOUSA never adds items without your confirmation.',
    prediction: 'Delivery prediction', preparation: 'LOUSA preparation window', days: 'days until your next period', inside: 'What is inside',
    choose: 'Build LOUSA BOX', guestChoose: 'Create an account to order', guestNote: 'Guest mode lets you browse contents and recommendations. An account is required for addresses, payments, orders and delivery tracking.', benefits: [
      ['favorite', 'Included in the plan', 'Core cycle products. You can refine the contents before ordering.'],
      ['local_cafe', 'Optional add-ons', 'Warmth, tea, snacks or extra products — only if you choose them manually.'],
      ['auto_awesome', 'Soft details', 'A care card and a small monthly gift.'],
    ],
    active: 'Active subscription', paused: 'Paused', noOrder: 'Box not ordered yet', noOrderBody: 'Choose a delivery date and address.', orderAccepted: 'Order accepted', orderAcceptedBody: 'We will prepare your box and let you know when it is handed to the courier.', onWay: 'Delivery in progress', dateMissing: 'Delivery date not selected', dateMissingBody: 'Choose a convenient delivery window.', addressIncomplete: 'Address is incomplete', next: 'Next delivery', deliveryWindow: 'Delivery window', delivery: 'Your box journey', manage: 'Edit contents', pause: 'Pause', resume: 'Resume',
    privacy: 'The courier only sees the address, phone number and delivery window — never your cycle data.',
    progress: 'Order progress', eta: 'Next step', personal: 'Personal care', order: 'Order', nextStage: 'Next stage', feedback: 'Rate this box', updateStatus: 'Update status', pause30: 'Pause for 30 days', addressTitle: 'Delivery address', fixAddress: 'Fix address', noAddress: 'No address added yet', missingAddress: 'Missing field', addressLabels: { city: 'City', region: 'Region', street: 'Street', house: 'House', entrance: 'Entrance', floor: 'Floor', apartment: 'Apartment', intercom: 'Intercom', comment: 'Comment', map: 'Map point' }, stepLabels: { scheduled: 'Box scheduled', packing: 'Packing for your cycle', courier: 'Courier on the pink scooter', delivered: 'Box delivered' },
  },
  hy: {
    title: 'LOUSA BOX', subtitle: 'Բոքս, որը օգնում է նախապատրաստվել նախապես։ Դուք եք ընտրում կազմը։',
    prediction: 'Առաքման կանխատեսում', preparation: 'LOUSA-ի նախապատրաստման պատուհան', days: 'օր մինչև հաջորդ դաշտանը', inside: 'LOUSA BOX',
    choose: 'Կազմել LOUSA BOX', guestChoose: 'Ստեղծել հաշիվ պատվերի համար', guestNote: 'Հյուրի ռեժիմում կարելի է դիտել պարունակությունն ու առաջարկները։ Հասցեի, վճարման, պատվերի և առաքման հետևման համար հաշիվ է պետք։', benefits: [
      ['favorite', 'Ներառված է պլանում', 'Ցիկլի հիմնական միջոցներ։ Կազմը կարելի է ճշտել պատվերից առաջ։'],
      ['local_cafe', 'Կարելի է ավելացնել', 'Թեյ, ջերմություն, սնեք կամ լրացուցիչ միջոցներ՝ միայն ձեր ընտրությամբ։'],
      ['auto_awesome', 'Մեղմ մանրուքներ', 'Խնամքի քարտ և ամսվա փոքր նվեր։'],
    ],
    active: 'Ակտիվ բաժանորդագրություն', paused: 'Դադարեցված', noOrder: 'Բոքսը դեռ պատվիրված չէ', noOrderBody: 'Ընտրեք առաքման օրը և հասցեն։', orderAccepted: 'Պատվերն ընդունված է', orderAcceptedBody: 'Մենք կպատրաստենք բոքսը և կտեղեկացնենք, երբ այն փոխանցվի առաքիչին։', onWay: 'Առաքումն ընթացքի մեջ է', dateMissing: 'Առաքման օրը ընտրված չէ', dateMissingBody: 'Նշեք հարմար առաքման պատուհան։', addressIncomplete: 'Հասցեն ամբողջությամբ լրացված չէ', next: 'Հաջորդ առաքումը', deliveryWindow: 'Ժամային պատուհան', delivery: 'Քո բոքսի ճանապարհը', manage: 'Փոխել պարունակությունը', pause: 'Դադարեցնել', resume: 'Վերսկսել',
    privacy: 'Առաքիչը տեսնում է միայն հասցեն, հեռախոսը և առաքման ժամերը՝ ոչ ցիկլի տվյալները։',
    progress: 'Պատվերի պատրաստվածություն', eta: 'Հաջորդ փուլը', personal: 'Անհատական խնամք', order: 'Պատվեր', nextStage: 'Հաջորդ փուլ', feedback: 'Գնահատել բոքսը', updateStatus: 'Թարմացնել կարգավիճակը', pause30: 'Դադար 30 օրով', addressTitle: 'Առաքման հասցե', fixAddress: 'Ուղղել հասցեն', noAddress: 'Հասցեն դեռ ավելացված չէ', missingAddress: 'Չլրացված դաշտ', addressLabels: { city: 'Քաղաք', region: 'Մարզ', street: 'Փողոց', house: 'Տուն', entrance: 'Մուտք', floor: 'Հարկ', apartment: 'Բնակարան', intercom: 'Դոմոֆոն', comment: 'Մեկնաբանություն', map: 'Քարտեզի կետ' }, stepLabels: { scheduled: 'Բոքսը պլանավորված է', packing: 'Հավաքում ենք ըստ քո ցիկլի', courier: 'Առաքիչը վարդագույն սկուտերով', delivered: 'Բոքսը առաքված է' },
  },
} as const;

function humanDate(dateString: string, language: 'ru' | 'en' | 'hy') {
  const locale = language === 'ru' ? 'ru-RU' : language === 'hy' ? 'hy-AM' : 'en-US';
  return fromLocalDateString(dateString).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}


export default function BoxScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((state) => state.language);
  const isGuestMode = useUserStore((state) => state.isGuestMode);
  const copy = COPY[language] || COPY.ru;
  const box = useBoxStore();
  const applyServerSubscription = useBoxStore((state) => state.applyServerSubscription);
  const replaceOrdersFromServer = useBoxStore((state) => state.replaceOrdersFromServer);
  const syncPauseState = useBoxStore((state) => state.syncPauseState);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const { lastPeriodStart, avgCycleLength, avgPeriodLength, periodHistory, periodRecords, onboardingProfile } = useCycleStore();

  useEffect(() => {
    syncPauseState();
    if (isGuestMode || getServiceMode() !== 'api') return;
    let cancelled = false;
    Promise.all([services.subscription.getSubscription(), services.orders.listOrders()]).then(([subscriptionResult, orderResult]) => {
      if (cancelled) return;
      if (subscriptionResult.ok) applyServerSubscription(subscriptionResult.data);
      if (orderResult.ok) replaceOrdersFromServer(orderResult.data);
      const failure = !subscriptionResult.ok ? getUserFacingErrorMessage(subscriptionResult.error) : !orderResult.ok ? getUserFacingErrorMessage(orderResult.error) : '';
      setSubscriptionError(failure);
    });
    return () => { cancelled = true; };
  }, [applyServerSubscription, isGuestMode, replaceOrdersFromServer, syncPauseState]);

  const cycle = useMemo(
    () => getCycleData(lastPeriodStart ? fromLocalDateString(lastPeriodStart) : null, avgCycleLength, avgPeriodLength, new Date(), periodHistory.length, periodRecords, { cycleContext: onboardingProfile.cycleContext, factors: onboardingProfile.factors }),
    [lastPeriodStart, avgCycleLength, avgPeriodLength, periodHistory.length, periodRecords, onboardingProfile.cycleContext, onboardingProfile.factors],
  );
  const prediction = useMemo(() => calculateCyclePrediction(periodRecords, {
    fallbackCycleLength: avgCycleLength,
    fallbackPeriodLength: avgPeriodLength,
    cycleContext: onboardingProfile.cycleContext,
    factors: onboardingProfile.factors,
  }), [periodRecords, avgCycleLength, avgPeriodLength, onboardingProfile.cycleContext, onboardingProfile.factors]);
  const preparationWindow = useMemo(() => calculatePreparationWindow(prediction), [prediction]);
  const preparationCopy = useMemo(() => buildPreparationWindowCopy(preparationWindow, language), [preparationWindow, language]);
  const plan = BOX_PLANS.find((item) => item.id === box.planId) || BOX_PLANS[1];
  const currentOrder = box.orders[0] || null;
  const hasCycleData = periodRecords.some((record) => record.confirmed && !record.deletedAt && !record.needsReview);
  const planImage = box.planId === 'essential'
    ? require('../../assets/images/box/box-essential.png')
    : box.planId === 'ritual'
      ? require('../../assets/images/box/box-moon-ritual.png')
      : require('../../assets/images/box/box-comfort.png');
  const orderStepIndex = currentOrder?.status === 'delivered' ? 3
    : ['courier_assigned', 'out_for_delivery'].includes(currentOrder?.status || '') ? 2
      : ['packing', 'ready'].includes(currentOrder?.status || '') ? 1 : 0;
  const activeStep = currentOrder ? orderStepIndex : Math.max(0, ['scheduled', 'packing', 'courier', 'delivered'].indexOf(box.status));
  const progress = Math.round(((activeStep + 1) / 4) * 100);
  const stepIds = ['scheduled', 'packing', 'courier', 'delivered'] as const;
  const openSubscription = () => {
    if (isGuestMode) {
      beginGuestAccountUpgrade();
      router.push({ pathname: '/auth/login', params: { mode: 'signup' } });
      return;
    }
    router.push('/screens/subscription');
  };

  const runSubscriptionAction = async (input: SubscriptionAction) => {
    if (isGuestMode) { openSubscription(); return; }
    if (subscriptionBusy) return;
    setSubscriptionBusy(true);
    setSubscriptionError('');
    const result = await services.subscription.updateSubscription(input);
    if (result.ok) {
      applyServerSubscription(result.data);
    } else {
      const message = getUserFacingErrorMessage(result.error, language === 'en' ? 'Could not update the subscription. Try again.' : language === 'hy' ? 'Չհաջողվեց փոխել բաժանորդագրությունը։ Փորձեք կրկին։' : 'Не удалось изменить подписку. Попробуйте ещё раз.');
      setSubscriptionError(message);
      Alert.alert(
        language === 'en' ? 'Could not update subscription' : language === 'hy' ? 'Չհաջողվեց փոխել բաժանորդագրությունը' : 'Не удалось изменить подписку',
        message,
      );
    }
    setSubscriptionBusy(false);
  };

  const pauseSubscription = () => {
    if (box.paused) {
      void runSubscriptionAction({ action: 'resume' });
      return;
    }
    Alert.alert(copy.pause, '', [
      { text: language === 'en' ? 'Skip next box' : language === 'hy' ? 'Բաց թողնել հաջորդ բոքսը' : 'Пропустить следующий бокс', onPress: () => void runSubscriptionAction({ action: 'skip_next' }) },
      { text: copy.pause30, onPress: () => { const date = new Date(); date.setDate(date.getDate() + 30); void runSubscriptionAction({ action: 'pause_until', pauseUntil: date.toISOString() }); } },
      { text: language === 'en' ? 'Pause indefinitely' : language === 'hy' ? 'Դադարեցնել անժամկետ' : 'Поставить на паузу бессрочно', onPress: () => void runSubscriptionAction({ action: 'pause_indefinite' }) },
      { text: language === 'en' ? 'Cancel' : language === 'hy' ? 'Չեղարկել' : 'Отмена', style: 'cancel' },
    ]);
  };

  const nextDelivery = currentOrder?.plannedDeliveryDate || box.nextDeliveryDate;
  const currentStatusLabel = copy.stepLabels[stepIds[Math.min(activeStep, 3)]];
  const nextStatusLabel = copy.stepLabels[stepIds[Math.min(activeStep + 1, 3)]];
  const missingAddressKeys = box.deliveryAddress
    ? (['city', 'street', 'house'] as const).filter((key) => !box.deliveryAddress?.[key]?.trim())
    : (['city', 'street', 'house'] as const);
  const addressIsComplete = Boolean(box.deliveryAddress && missingAddressKeys.length === 0);
  const isDeliveryInTransit = Boolean(
    currentOrder && ['courier_assigned', 'out_for_delivery'].includes(currentOrder.status),
  ) || box.status === 'courier';
  const hasDeliveryDate = Boolean(nextDelivery?.trim());
  const hasMapPoint = typeof box.deliveryAddress?.latitude === 'number'
    && Number.isFinite(box.deliveryAddress.latitude)
    && typeof box.deliveryAddress?.longitude === 'number'
    && Number.isFinite(box.deliveryAddress.longitude);
  const stateTitle = !box.isSubscribed
    ? copy.noOrder
    : !hasDeliveryDate
      ? copy.dateMissing
      : !addressIsComplete
        ? copy.addressIncomplete
        : isDeliveryInTransit
          ? copy.onWay
          : copy.orderAccepted;
  const stateBody = !box.isSubscribed
    ? copy.noOrderBody
    : !hasDeliveryDate
      ? copy.dateMissingBody
      : !addressIsComplete
        ? `${copy.missingAddress}: ${missingAddressKeys.map((key) => copy.addressLabels[key]).join(', ')}`
        : copy.orderAcceptedBody;

  return (
    <TabbedScreen backgroundVariant={isDark ? 'cosmic' : 'minimal'}>
      <ScreenScroll tabbed contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={styles.header}>
          <Text style={[styles.title, { color: colors.onBackground }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{copy.subtitle}</Text>
        </Animated.View>

        <HeroCard tone={box.isSubscribed ? 'rose' : 'neutral'} style={styles.hero}>
          <Image source={box.isSubscribed ? planImage : require('../../assets/images/box/box-open.png')} style={styles.heroImage} resizeMode="contain" />
          <StatusPill
            tone={box.isSubscribed ? (box.paused ? 'warning' : 'success') : 'rose'}
            icon={box.isSubscribed ? (box.paused ? 'pause_circle' : 'check_circle') : 'tune'}
            label={box.isSubscribed ? (box.paused ? copy.paused : copy.active) : (language === 'en' ? 'You choose every item' : language === 'hy' ? 'Դուք եք ընտրում յուրաքանչյուր ապրանք' : 'Каждый товар выбираете вы')}
          />
          <Text style={[styles.heroTitle, { color: colors.onBackground }]}>{stateTitle}</Text>
          <Text style={[styles.heroMeta, { color: colors.onSurfaceVariant }]}>{stateBody}</Text>
          {box.isSubscribed ? (
            <Text style={[styles.planMeta, { color: colors.onSurfaceVariant }]}>
              {plan.name} · {formatAmd(plan.monthlyPriceAmd, language)} / {language === 'en' ? 'month' : language === 'hy' ? 'ամիս' : 'месяц'}
            </Text>
          ) : null}

          {!box.isSubscribed ? (
            <View style={styles.heroAction}>
              <PrimaryButton label={isGuestMode ? copy.guestChoose : copy.choose} icon={isGuestMode ? "lock" : "arrow_forward"} onPress={openSubscription} />
            </View>
          ) : (
            <View style={styles.deliverySummary}>
              <View style={styles.deliverySummaryCopy}>
                <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>{copy.next}</Text>
                <Text style={[styles.deliveryDate, { color: colors.onBackground }]}>{hasDeliveryDate ? humanDate(nextDelivery, language) : '—'}</Text>
                <Text style={[styles.addressText, { color: colors.onSurfaceVariant }]}>{copy.deliveryWindow}: {box.deliveryWindow || '—'}</Text>
                <Text numberOfLines={3} style={[styles.addressText, { color: colors.onSurfaceVariant }]}>{box.deliveryAddress?.formattedAddress || box.address || '—'}</Text>
              </View>
              <TextButton label={copy.manage} icon="arrow_forward" onPress={openSubscription} />
            </View>
          )}
        </HeroCard>

        {isGuestMode ? <InlineMessage body={copy.guestNote} tone="warning" /> : null}

        {box.isSubscribed && !isGuestMode ? (
          <SectionSurface style={styles.block}>
            <View style={styles.addressHeader}>
              <Text style={[styles.cardTitle, { color: colors.onBackground }]}>{copy.addressTitle}</Text>
              <TextButton label={copy.fixAddress} onPress={() => router.push('/screens/address-map')} />
            </View>
            {box.deliveryAddress ? (
              <View style={styles.addressRows}>
                {[
                  [copy.addressLabels.city, box.deliveryAddress.city],
                  [copy.addressLabels.street, box.deliveryAddress.street],
                  [copy.addressLabels.house, box.deliveryAddress.house],
                  [copy.addressLabels.region, box.deliveryAddress.region],
                  [copy.addressLabels.entrance, box.deliveryAddress.entrance],
                  [copy.addressLabels.floor, box.deliveryAddress.floor],
                  [copy.addressLabels.apartment, box.deliveryAddress.apartment],
                  [copy.addressLabels.intercom, box.deliveryAddress.intercomCode],
                  [copy.addressLabels.comment, box.deliveryAddress.instructions],
                  [copy.addressLabels.map, hasMapPoint ? `${box.deliveryAddress.latitude.toFixed(5)}, ${box.deliveryAddress.longitude.toFixed(5)}` : '—'],
                ].map(([label, value]) => (
                  <View key={label} style={styles.addressRow}>
                    <Text style={[styles.addressLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
                    <Text style={[styles.addressValue, { color: colors.onBackground }]}>{value || '—'}</Text>
                  </View>
                ))}
                {missingAddressKeys.map((key) => (
                  <InlineMessage key={key} body={`${copy.missingAddress}: ${copy.addressLabels[key]}`} tone="warning" />
                ))}
              </View>
            ) : (
              <>
                <InlineMessage body={copy.noAddress} tone="warning" />
                <PrimaryButton label={copy.fixAddress} icon="location_on" onPress={() => router.push('/screens/address-map')} />
              </>
            )}
          </SectionSurface>
        ) : null}

        {!box.isSubscribed ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>{copy.preparation}</Text>
            <SectionSurface style={styles.block}>
              <View style={styles.preparationRow}>
                <View style={styles.iconSquare}><MaterialSymbol name="event_available" size={22} color={LousaPalette.berry} /></View>
                <View style={styles.flexOne}>
                  <Text style={[styles.cardTitle, { color: colors.onBackground }]}>{preparationCopy.title}</Text>
                  <Text style={[styles.cardBody, { color: colors.onSurfaceVariant }]}>{preparationCopy.body}</Text>
                </View>
              </View>
              <View style={[styles.estimateRow, { borderTopColor: colors.outlineVariant }]}>
                <MaterialSymbol name="calendar_month" size={18} color={colors.onSurfaceVariant} />
                <Text style={[styles.estimateText, { color: colors.onSurfaceVariant }]}>
                  {hasCycleData
                    ? `${cycle.daysUntilPeriod} ${copy.days}`
                    : (language === 'en' ? 'LOUSA will not guess your cycle. You can choose the date manually.' : language === 'hy' ? 'LOUSA-ն չի գուշակի ձեր ցիկլը։ Կարող եք օրը ընտրել ձեռքով։' : 'LOUSA не будет угадывать цикл. Дату можно выбрать вручную.')}
                </Text>
              </View>
            </SectionSurface>

            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>{copy.inside}</Text>
            <ListSection style={styles.block}>
              {copy.benefits.map(([icon, title, text], index) => (
                <ListRow key={title} icon={icon} title={title} detail={text} divider={index < copy.benefits.length - 1} />
              ))}
            </ListSection>
            <InlineMessage
              body={language === 'en' ? 'Included items, recommendations and paid add-ons are shown separately. Nothing is added without your choice.' : language === 'hy' ? 'Ներառվածը, առաջարկները և վճարովի հավելումները ցուցադրվում են առանձին։ Ոչինչ չի ավելացվում առանց ձեր ընտրության։' : 'Включённые товары, рекомендации и платные дополнения показаны отдельно. Ничего не добавляется без вашего выбора.'}
            />
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>{copy.delivery}</Text>
            <SectionSurface style={styles.block}>
              <View style={styles.progressHeader}>
                <View>
                  <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>{copy.progress}</Text>
                  <Text style={[styles.progressValue, { color: colors.onBackground }]}>{progress}%</Text>
                </View>
                <View style={styles.nextStageBlock}>
                  <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>{copy.nextStage}</Text>
                  <Text style={[styles.nextStageValue, { color: colors.onBackground }]}>{activeStep >= 3 ? currentStatusLabel : nextStatusLabel}</Text>
                </View>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEE7EB' }]}>
                <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: isDark ? '#DFA6BC' : LousaPalette.berry }]} />
              </View>
              <Text style={[styles.currentStatus, { color: colors.onSurfaceVariant }]}>{currentStatusLabel}</Text>
            </SectionSurface>

            {(currentOrder?.status === 'out_for_delivery' || currentOrder?.status === 'courier_assigned' || box.status === 'courier') ? (
              <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={styles.block}>
                <DeliveryMapPreview
                  title={language === 'en' ? 'Your LOUSA Box is on the way' : language === 'hy' ? 'Ձեր LOUSA Box-ը ճանապարհին է' : 'Ваш LOUSA Box уже в пути'}
                  eta={currentOrder?.deliveryAddressSnapshot?.estimatedMinutes
                    ? (language === 'en' ? `Approximately ${currentOrder.deliveryAddressSnapshot.estimatedMinutes} minutes` : language === 'hy' ? `Մոտ ${currentOrder.deliveryAddressSnapshot.estimatedMinutes} րոպե` : `Примерно ${currentOrder.deliveryAddressSnapshot.estimatedMinutes} минут`)
                    : (language === 'en' ? 'Waiting for courier GPS' : language === 'hy' ? 'Սպասում ենք առաքիչի GPS-ին' : 'Ожидаем GPS курьера')}
                  latitude={currentOrder?.deliveryAddressSnapshot?.latitude}
                  longitude={currentOrder?.deliveryAddressSnapshot?.longitude}
                  demo={false}
                />
              </Animated.View>
            ) : null}

            {(currentOrder?.status === 'delivered' || box.status === 'delivered') ? (
              <View style={styles.block}>
                <PrimaryButton label={copy.feedback} icon="rate_review" onPress={() => router.push('/screens/box-feedback')} />
              </View>
            ) : null}

            {currentOrder?.items?.length ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>{copy.inside}</Text>
                <ListSection style={styles.block}>
                  {currentOrder.items.slice(0, 8).map((item, index) => (
                    <ListRow
                      key={item.id}
                      title={item.name}
                      detail={item.reason}
                      trailing={<Text style={[styles.itemQuantity, { color: colors.onBackground }]}>×{item.quantity}</Text>}
                      divider={index < Math.min(currentOrder.items.length, 8) - 1}
                    />
                  ))}
                </ListSection>
              </>
            ) : null}

            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>{language === 'en' ? 'Manage' : language === 'hy' ? 'Կառավարում' : 'Управление'}</Text>
            <ListSection style={styles.block}>
              <ListRow
                icon="tune"
                title={copy.manage}
                detail={language === 'en' ? 'Plan, contents and delivery' : language === 'hy' ? 'Պլան, պարունակություն և առաքում' : 'Тариф, состав и доставка'}
                onPress={openSubscription}
              />
              <ListRow
                icon={box.paused ? 'play_circle' : 'pause_circle'}
                title={box.paused ? copy.resume : copy.pause}
                detail={box.paused ? (language === 'en' ? 'Continue the subscription' : language === 'hy' ? 'Շարունակել բաժանորդագրությունը' : 'Продолжить подписку') : (language === 'en' ? 'Skip or pause without cancelling' : language === 'hy' ? 'Բաց թողնել կամ դադարեցնել առանց չեղարկման' : 'Пропустить или приостановить без отмены')}
                onPress={pauseSubscription}
                divider={false}
              />
            </ListSection>

            <InlineMessage body={copy.privacy} tone="neutral" />
          </>
        )}

        {subscriptionError ? <InlineMessage body={subscriptionError} tone="danger" /> : null}
        {subscriptionBusy ? <Text style={[styles.busyText, { color: colors.onSurfaceVariant }]}>{language === 'en' ? 'Updating subscription…' : language === 'hy' ? 'Բաժանորդագրությունը թարմացվում է…' : 'Обновляем подписку…'}</Text> : null}
      </ScreenScroll>
    </TabbedScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  header: { marginTop: 4, marginBottom: 18 },
  title: { fontFamily: 'sans-serif-medium', fontSize: 29, lineHeight: 35, letterSpacing: -0.3 },
  subtitle: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 440 },
  hero: { marginBottom: 22 },
  heroImage: { width: '100%', height: 150, marginBottom: 10 },
  heroTitle: { fontFamily: 'sans-serif-medium', fontSize: 25, lineHeight: 31, marginTop: 10 },
  heroMeta: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 19, marginTop: 4 },
  planMeta: { fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  heroAction: { marginTop: 18 },
  deliverySummary: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8DFE4', paddingTop: 14, gap: 8 },
  deliverySummaryCopy: { flex: 1 },
  summaryLabel: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 17 },
  deliveryDate: { fontFamily: 'sans-serif-medium', fontSize: 22, lineHeight: 28, marginTop: 2 },
  addressText: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  sectionTitle: { fontFamily: 'sans-serif-medium', fontSize: 20, lineHeight: 26, marginBottom: 10 },
  block: { marginBottom: 18 },
  addressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  addressRows: { gap: 8 },
  addressRow: { minHeight: 30, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8DFE4', paddingBottom: 7 },
  addressLabel: { flex: 1, fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18 },
  addressValue: { flex: 1.4, fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 18, textAlign: 'right' },
  preparationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconSquare: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#F8E7ED', alignItems: 'center', justifyContent: 'center' },
  flexOne: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: 'sans-serif-medium', fontSize: 17, lineHeight: 22 },
  cardBody: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 19, marginTop: 4 },
  estimateRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  estimateText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18 },
  progressHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  progressValue: { fontFamily: 'sans-serif-medium', fontSize: 24, lineHeight: 29, marginTop: 2 },
  nextStageBlock: { maxWidth: 190, alignItems: 'flex-end' },
  nextStageValue: { fontFamily: 'sans-serif-medium', fontSize: 13, lineHeight: 18, textAlign: 'right', marginTop: 2 },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', borderRadius: 4 },
  currentStatus: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  itemQuantity: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  busyText: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 10 },
});
