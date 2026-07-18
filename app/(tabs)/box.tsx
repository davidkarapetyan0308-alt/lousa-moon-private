import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ScreenScroll, TabbedScreen, useResponsiveLayout } from '../../src/components/layout';
import { DeliveryMapPreview } from '../../src/components/DeliveryMapPreview';
import {
  IconBubble,
  PressScale,
  PrimaryAction,
  SectionHeader,
  StatusPill,
  SurfaceCard,
} from '../../src/components/ui';
import { BOX_PLANS, formatAmd } from '../../src/data/boxCatalog';
import { useBoxStore, useCycleStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getCycleData } from '../../src/utils/cycleEngine';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import { buildPreparationWindowCopy, calculatePreparationWindow } from '../../src/services/preparationWindow';
import { fromLocalDateString } from '../../src/utils/date';
import { getServiceMode, services } from '../../src/services';
import type { SubscriptionAction } from '../../src/services/contracts';

const COPY = {
  ru: {
    title: 'LOUSA BOX', subtitle: 'Бокс, который помогает подготовиться заранее. Вы выбираете состав — LOUSA ничего не добавляет без подтверждения.',
    prediction: 'Планирование доставки', preparation: 'Окно подготовки LOUSA', days: 'дн. до следующей менструации', inside: 'LOUSA BOX',
    choose: 'Собрать LOUSA BOX', benefits: [
      ['favorite', 'Входит в тариф', 'Базовые средства на цикл. Состав можно уточнить перед заказом.'],
      ['local_cafe', 'Можно добавить', 'Тепло, чай, снек или дополнительные средства — только если вы выберете их вручную.'],
      ['auto_awesome', 'Мягкие детали', 'Карточка заботы и небольшой подарок месяца.'],
    ],
    active: 'Активная подписка', paused: 'На паузе', next: 'Следующая доставка', delivery: 'Путь вашего бокса', manage: 'Изменить состав', pause: 'Поставить на паузу', resume: 'Возобновить',
    privacy: 'Курьер видит только адрес, телефон и время доставки — данные цикла ему недоступны.',
    progress: 'Готовность заказа', eta: 'Следующий этап', personal: 'Состав под вашим контролем', order: 'Заказ', nextStage: 'Следующий этап', feedback: 'Оценить бокс', updateStatus: 'Обновить статус', pause30: 'Пауза на 30 дней', stepLabels: { scheduled: 'Бокс запланирован', packing: 'Собираем ваш LOUSA BOX', courier: 'Курьер назначен', delivered: 'Бокс доставлен' },
  },
  en: {
    title: 'LOUSA BOX', subtitle: 'A preparation box you control. LOUSA never adds items without your confirmation.',
    prediction: 'Delivery prediction', preparation: 'LOUSA preparation window', days: 'days until your next period', inside: 'What is inside',
    choose: 'Build LOUSA BOX', benefits: [
      ['favorite', 'Included in the plan', 'Core cycle products. You can refine the contents before ordering.'],
      ['local_cafe', 'Optional add-ons', 'Warmth, tea, snacks or extra products — only if you choose them manually.'],
      ['auto_awesome', 'Soft details', 'A care card and a small monthly gift.'],
    ],
    active: 'Active subscription', paused: 'Paused', next: 'Next delivery', delivery: 'Your box journey', manage: 'Edit contents', pause: 'Pause', resume: 'Resume',
    privacy: 'The courier only sees the address, phone number and delivery window — never your cycle data.',
    progress: 'Order progress', eta: 'Next step', personal: 'Personal care', order: 'Order', nextStage: 'Next stage', feedback: 'Rate this box', updateStatus: 'Update status', pause30: 'Pause for 30 days', stepLabels: { scheduled: 'Box scheduled', packing: 'Packing for your cycle', courier: 'Courier on the pink scooter', delivered: 'Box delivered' },
  },
  hy: {
    title: 'LOUSA BOX', subtitle: 'Բոքս, որը օգնում է նախապատրաստվել նախապես։ Դուք եք ընտրում կազմը։',
    prediction: 'Առաքման կանխատեսում', preparation: 'LOUSA-ի նախապատրաստման պատուհան', days: 'օր մինչև հաջորդ դաշտանը', inside: 'LOUSA BOX',
    choose: 'Կազմել LOUSA BOX', benefits: [
      ['favorite', 'Ներառված է պլանում', 'Ցիկլի հիմնական միջոցներ։ Կազմը կարելի է ճշտել պատվերից առաջ։'],
      ['local_cafe', 'Կարելի է ավելացնել', 'Թեյ, ջերմություն, սնեք կամ լրացուցիչ միջոցներ՝ միայն ձեր ընտրությամբ։'],
      ['auto_awesome', 'Մեղմ մանրուքներ', 'Խնամքի քարտ և ամսվա փոքր նվեր։'],
    ],
    active: 'Ակտիվ բաժանորդագրություն', paused: 'Դադարեցված', next: 'Հաջորդ առաքումը', delivery: 'Քո բոքսի ճանապարհը', manage: 'Փոխել պարունակությունը', pause: 'Դադարեցնել', resume: 'Վերսկսել',
    privacy: 'Առաքիչը տեսնում է միայն հասցեն, հեռախոսը և առաքման ժամերը՝ ոչ ցիկլի տվյալները։',
    progress: 'Պատվերի պատրաստվածություն', eta: 'Հաջորդ փուլը', personal: 'Անհատական խնամք', order: 'Պատվեր', nextStage: 'Հաջորդ փուլ', feedback: 'Գնահատել բոքսը', updateStatus: 'Թարմացնել կարգավիճակը', pause30: 'Դադար 30 օրով', stepLabels: { scheduled: 'Բոքսը պլանավորված է', packing: 'Հավաքում ենք ըստ քո ցիկլի', courier: 'Առաքիչը վարդագույն սկուտերով', delivered: 'Բոքսը առաքված է' },
  },
} as const;

function humanDate(dateString: string, language: 'ru' | 'en' | 'hy') {
  const locale = language === 'ru' ? 'ru-RU' : language === 'hy' ? 'hy-AM' : 'en-US';
  return fromLocalDateString(dateString).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

export default function BoxScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((s) => s.language);
  const copy = COPY[language] || COPY.ru;
  const box = useBoxStore();
  const applyServerSubscription = useBoxStore((state) => state.applyServerSubscription);
  const replaceOrdersFromServer = useBoxStore((state) => state.replaceOrdersFromServer);
  const syncPauseState = useBoxStore((state) => state.syncPauseState);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  useEffect(() => {
    syncPauseState();
    if (getServiceMode() !== 'api') return;
    let cancelled = false;
    Promise.all([services.subscription.getSubscription(), services.orders.listOrders()]).then(([subscriptionResult, orderResult]) => {
      if (cancelled) return;
      if (subscriptionResult.ok) applyServerSubscription(subscriptionResult.data);
      if (orderResult.ok) replaceOrdersFromServer(orderResult.data);
      const failure = !subscriptionResult.ok ? subscriptionResult.error.message : !orderResult.ok ? orderResult.error.message : '';
      setSubscriptionError(failure);
    });
    return () => { cancelled = true; };
  }, [applyServerSubscription, replaceOrdersFromServer, syncPauseState]);
  const { compactWidth } = useResponsiveLayout();
  const { lastPeriodStart, avgCycleLength, avgPeriodLength, periodHistory, periodRecords, onboardingProfile } = useCycleStore();

  const cycle = useMemo(
    () => getCycleData(lastPeriodStart ? fromLocalDateString(lastPeriodStart) : null, avgCycleLength, avgPeriodLength, new Date(), periodHistory.length, periodRecords, { cycleContext: onboardingProfile.cycleContext, factors: onboardingProfile.factors }),
    [lastPeriodStart, avgCycleLength, avgPeriodLength, periodHistory.length, periodRecords, onboardingProfile.cycleContext, onboardingProfile.factors]
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
  const openSubscription = () => router.push('/screens/subscription');
  const runSubscriptionAction = async (input: SubscriptionAction) => {
    if (subscriptionBusy) return;
    setSubscriptionBusy(true);
    setSubscriptionError('');
    const result = await services.subscription.updateSubscription(input);
    if (result.ok) {
      applyServerSubscription(result.data);
    } else {
      setSubscriptionError(result.error.message);
      Alert.alert(language === 'en' ? 'Could not update subscription' : language === 'hy' ? 'Չհաջողվեց փոխել բաժանորդագրությունը' : 'Не удалось изменить подписку', result.error.message);
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

  return (
    <TabbedScreen backgroundVariant={isDark ? 'cosmic' : 'liquid'}>
      <ScreenScroll tabbed contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={styles.header}>
          <Text style={[styles.title, { color: colors.onBackground }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{copy.subtitle}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(240).delay(30).reduceMotion(ReduceMotion.System)} style={styles.hero}>
          <View style={styles.heroImageWrap}><Image source={box.isSubscribed ? planImage : require('../../assets/images/box/box-open.png')} style={styles.heroImage} resizeMode="contain" /></View>
          <View style={styles.heroContent}>
            <StatusPill tone={box.isSubscribed ? 'success' : 'night'} icon={box.isSubscribed ? 'check_circle' : 'auto_awesome'} label={box.isSubscribed ? (box.paused ? copy.paused : copy.active) : (language === 'en' ? 'You control the contents' : language === 'hy' ? 'Դուք եք ընտրում կազմը' : 'Вы контролируете состав')} />
            <Text style={styles.heroTitle}>{box.isSubscribed ? plan.name : 'LOUSA BOX'}</Text>
            <Text style={styles.heroMeta}>{box.isSubscribed ? `${formatAmd(plan.monthlyPriceAmd, language)} / ${language === 'en' ? 'month' : language === 'hy' ? 'ամիս' : 'месяц'}` : (hasCycleData ? `${cycle.daysUntilPeriod} ${copy.days}` : (language === 'en' ? 'Delivery date can be selected manually' : language === 'hy' ? 'Առաքման օրը կարելի է ընտրել ձեռքով' : 'Дату доставки можно выбрать вручную'))}</Text>
          </View>
        </Animated.View>

        {!box.isSubscribed ? (
          <>
            <Animated.View entering={FadeInDown.duration(220).delay(45).reduceMotion(ReduceMotion.System)} style={styles.section}>
              <SurfaceCard padding={18} tone="accent">
                <View style={styles.predictionRow}>
                  <IconBubble icon="event_available" tone="rose" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardEyebrow, { color: colors.onSurfaceVariant }]}>{copy.preparation}</Text>
                    <Text style={[styles.predictionValue, { color: colors.onBackground }]}>{preparationCopy.title}</Text>
                  </View>
                </View>
                <Text style={[styles.predictionNote, { color: colors.onSurfaceVariant }]}>{preparationCopy.body}</Text>
              </SurfaceCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(220).delay(55).reduceMotion(ReduceMotion.System)} style={styles.section}>
              <SurfaceCard padding={20} tone="accent">
                <View style={styles.predictionRow}>
                  <IconBubble icon="calendar_month" tone="rose" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardEyebrow, { color: colors.onSurfaceVariant }]}>{copy.prediction}</Text>
                    <Text style={[styles.predictionValue, { color: colors.onBackground }]}>{hasCycleData ? `${cycle.daysUntilPeriod} ${copy.days}` : (language === 'en' ? 'Choose a date manually' : language === 'hy' ? 'Ընտրեք օրը ձեռքով' : 'Выберите дату вручную')}</Text>
                  </View>
                  <MaterialSymbol name="arrow_forward" size={20} color={isDark ? '#F1B7CD' : LousaPalette.berry} />
                </View>
                <Text style={[styles.predictionNote, { color: colors.onSurfaceVariant }]}>
                  {hasCycleData
                    ? (language === 'en' ? 'The target delivery date will update when you log a new period.' : language === 'hy' ? 'Առաքման օրը կթարմացվի նոր գրառումից հետո։' : 'Дата доставки будет обновляться после каждой новой отметки.')
                    : (language === 'en' ? 'LOUSA will not guess your cycle. You can choose a delivery date manually.' : language === 'hy' ? 'LOUSA-ն չի գուշակի ձեր ցիկլը։ Առաքման օրը կարող եք ընտրել ձեռքով։' : 'LOUSA не будет угадывать цикл. Дату доставки можно выбрать вручную.')}
                </Text>
              </SurfaceCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(220).delay(85).reduceMotion(ReduceMotion.System)} style={styles.section}>
              <SectionHeader title={copy.inside} />
              <Image source={require('../../assets/images/box/box-comfort.png')} style={styles.productsImage} resizeMode="contain" />
              <SurfaceCard padding={4}>
                {copy.benefits.map(([icon, title, text], index) => (
                  <View key={title} style={[styles.benefitRow, index > 0 && { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : LousaPalette.line, borderTopWidth: 1 }]}>
                    <IconBubble icon={icon} tone={index === 1 ? 'lavender' : 'rose'} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.benefitTitle, { color: colors.onBackground }]}>{title}</Text>
                      <Text style={[styles.benefitText, { color: colors.onSurfaceVariant }]}>{text}</Text>
                    </View>
                  </View>
                ))}
              </SurfaceCard>
              <Text style={[styles.trustNote, { color: colors.onSurfaceVariant }]}>
                {language === 'en' ? 'Included, recommended and paid add-ons are shown separately. Nothing is added without your choice.' : language === 'hy' ? 'Ներառվածը, առաջարկվողը և վճարովի հավելումները ցուցադրվում են առանձին։ Ոչինչ չի ավելացվում առանց ձեր ընտրության։' : 'Входит в тариф, рекомендации и платные дополнения показываются отдельно. Ничего не добавляется без вашего выбора.'}
              </Text>
            </Animated.View>

            <PrimaryAction label={copy.choose} icon="arrow_forward" onPress={openSubscription} />
          </>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(220).delay(45).reduceMotion(ReduceMotion.System)} style={styles.section}>
              <SectionHeader title={copy.preparation} />
              <SurfaceCard padding={18} tone="accent">
                <View style={styles.predictionRow}>
                  <IconBubble icon="event_available" tone="rose" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.predictionValue, { color: colors.onBackground }]}>{preparationCopy.title}</Text>
                    <Text style={[styles.predictionNote, { color: colors.onSurfaceVariant }]}>{preparationCopy.body}</Text>
                  </View>
                </View>
              </SurfaceCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(220).delay(55).reduceMotion(ReduceMotion.System)} style={styles.section}>
              <SectionHeader title={copy.next} actionLabel={copy.manage} onAction={openSubscription} />
              <SurfaceCard padding={20}>
                <View style={styles.subscriptionTop}>
                  <View>
                    <Text style={[styles.cardEyebrow, { color: colors.onSurfaceVariant }]}>{plan.name}</Text>
                    <Text style={[styles.deliveryDate, { color: colors.onBackground }]}>{humanDate(currentOrder?.plannedDeliveryDate || box.nextDeliveryDate, language)}</Text>
                  </View>
                  <StatusPill tone={box.paused ? 'warning' : 'success'} label={box.paused ? copy.paused : copy.active} />
                </View>
                <View style={[styles.addressRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : LousaPalette.line }]}>
                  <MaterialSymbol name="location_on" size={18} color={colors.onSurfaceVariant} />
                  <Text style={[styles.addressText, { color: colors.onSurfaceVariant }]} numberOfLines={2}>{box.address || '—'}</Text>
                </View>
              </SurfaceCard>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(220).delay(85).reduceMotion(ReduceMotion.System)} style={styles.section}>
              <SectionHeader title={copy.delivery} />
              <SurfaceCard padding={20}>
                <View style={styles.progressHeader}>
                  <View>
                    <Text style={[styles.cardEyebrow, { color: colors.onSurfaceVariant }]}>{copy.progress}</Text>
                    <Text style={[styles.progressValue, { color: colors.onBackground }]}>{progress}%</Text>
                  </View>
                  <View style={styles.nextStageBlock}><Text style={[styles.nextStageLabel, { color: colors.onSurfaceVariant }]}>{copy.nextStage}</Text><Text style={[styles.nextStageValue, { color: colors.onBackground }]}>{copy.stepLabels[stepIds[Math.min(activeStep + 1, 3)]]}</Text></View>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEE7EB' }]}>
                  <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: isDark ? '#DFA6BC' : LousaPalette.berry }]} />
                </View>
                {stepIds.map((stepId, index) => {
                  const step = { id: stepId };
                  const done = index < activeStep;
                  const current = index === activeStep;
                  return (
                    <View key={step.id} style={styles.stepRow}>
                      <View style={styles.stepRail}>
                        <View style={[
                          styles.stepDot,
                          {
                            backgroundColor: done || current ? (isDark ? '#DFA6BC' : LousaPalette.berry) : (isDark ? '#37323D' : '#EEE7EB'),
                            borderColor: current ? (isDark ? '#F1C1D2' : LousaPalette.rose) : 'transparent',
                          },
                        ]}>
                          {done ? <MaterialSymbol name="check" size={15} color="#FFFFFF" /> : current ? <View style={styles.currentDot} /> : null}
                        </View>
                        {index < stepIds.length - 1 ? <View style={[styles.stepLine, { backgroundColor: index < activeStep ? (isDark ? '#8C6074' : '#DCA1B7') : (isDark ? '#37323D' : '#EEE7EB') }]} /> : null}
                      </View>
                      <View style={{ flex: 1, paddingBottom: index === stepIds.length - 1 ? 0 : 18 }}>
                        <Text style={[styles.stepTitle, { color: current || done ? colors.onBackground : colors.onSurfaceVariant }]}>{copy.stepLabels[step.id]}</Text>
                        {current ? <Text style={[styles.stepMeta, { color: colors.onSurfaceVariant }]}>{language === 'en' ? 'Current status' : language === 'hy' ? 'Ընթացիկ կարգավիճակ' : 'Текущий статус'}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </SurfaceCard>
            </Animated.View>

            {(currentOrder?.status === 'out_for_delivery' || currentOrder?.status === 'courier_assigned' || box.status === 'courier') ? (
              <Animated.View entering={FadeInDown.duration(220).delay(105).reduceMotion(ReduceMotion.System)} style={styles.section}>
                <DeliveryMapPreview
                  title={language === 'en' ? 'Anna is bringing your LOUSA BOX' : language === 'hy' ? 'Աննան բերում է քո LOUSA BOX-ը' : 'Анна везёт твой LOUSA BOX'}
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
              <Animated.View entering={FadeInDown.duration(220).delay(105).reduceMotion(ReduceMotion.System)} style={styles.section}>
                <Image source={require('../../assets/images/delivery/delivery-complete.png')} style={styles.deliveredImage} resizeMode="cover" />
                <PrimaryAction label={copy.feedback} icon="rate_review" onPress={() => router.push('/screens/box-feedback')} />
              </Animated.View>
            ) : null}

            {currentOrder?.items?.length ? (
              <View style={styles.section}>
                <SectionHeader title={copy.inside} />
                <SurfaceCard padding={8}>
                  {currentOrder.items.slice(0, 8).map((item, index) => (
                    <View key={item.id} style={[styles.itemRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? LousaPalette.lineDark : LousaPalette.line }]}>
                      <View style={{ flex: 1 }}><Text style={[styles.itemName, { color: colors.onBackground }]}>{item.name}</Text><Text style={[styles.itemReason, { color: colors.onSurfaceVariant }]}>{item.reason}</Text></View>
                      <Text style={[styles.itemQuantity, { color: colors.onBackground }]}>×{item.quantity}</Text>
                    </View>
                  ))}
                </SurfaceCard>
              </View>
            ) : null}

            <SurfaceCard padding={16} tone="accent" style={styles.privacyCard}>
              <MaterialSymbol name="lock" size={20} color={isDark ? '#F1B7CD' : LousaPalette.berry} />
              <Text style={[styles.privacyText, { color: colors.onSurfaceVariant }]}>{copy.privacy}</Text>
            </SurfaceCard>

            {subscriptionError ? <Text style={styles.subscriptionError}>{subscriptionError}</Text> : null}
            <View style={[styles.actionsRow, compactWidth && styles.actionsColumn]}>
              <PressScale onPress={pauseSubscription} disabled={subscriptionBusy} accessibilityState={{ disabled: subscriptionBusy, busy: subscriptionBusy }} style={[styles.secondaryButton, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : LousaPalette.line }]}>
                <Text style={[styles.secondaryText, { color: colors.onBackground }]}>{box.paused ? copy.resume : copy.pause}</Text>
              </PressScale>
              <PressScale onPress={openSubscription} style={[styles.secondaryButton, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : LousaPalette.line }]}>
                <Text style={[styles.secondaryText, { color: colors.onBackground }]}>{copy.manage}</Text>
              </PressScale>
            </View>
          </>
        )}

      </ScreenScroll>
    </TabbedScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  header: { marginTop: 4, marginBottom: 18 },
  title: { fontFamily: 'sans-serif-medium', fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  subtitle: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21, marginTop: 7, maxWidth: 340 },
  hero: { borderRadius: 28, overflow: 'hidden', marginBottom: 24, backgroundColor: '#F8E9EF', shadowColor: '#2C1A31', shadowOpacity: 0.035, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  heroImageWrap: { height: 188, backgroundColor: '#F5E7EC' },
  heroImage: { width: '100%', height: '100%' },
  heroContent: { padding: 20, alignItems: 'flex-start', backgroundColor: '#FFF9FB' },
  heroTitle: { color: '#4D2E3D', fontFamily: 'sans-serif-medium', fontSize: 27, lineHeight: 32, marginTop: 10 },
  heroMeta: { color: 'rgba(77,46,61,0.72)', fontFamily: 'sans-serif-medium', fontSize: 13, marginTop: 5 },
  section: { marginBottom: 28 },
  predictionRow: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  cardEyebrow: { fontFamily: 'sans-serif-medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1 },
  predictionValue: { fontFamily: 'sans-serif-medium', fontSize: 17, lineHeight: 22, marginTop: 3 },
  predictionNote: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 18, marginTop: 16 },
  productsImage: { width: '100%', height: 224, borderRadius: 28, marginBottom: 12, backgroundColor: '#F8EFF2' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 },
  benefitTitle: { fontFamily: 'sans-serif-medium', fontSize: 14 },
  benefitText: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 2 },
  trustNote: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 18, marginTop: 12, paddingHorizontal: 4 },
  subscriptionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  deliveryDate: { fontFamily: 'serif', fontSize: 29, lineHeight: 34, marginTop: 2 },
  addressRow: { borderTopWidth: 1, paddingTop: 14, marginTop: 16, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  addressText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17 },
  progressHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  progressValue: { fontFamily: 'sans-serif-medium', fontSize: 24, lineHeight: 29, marginTop: 2 },
  nextStageBlock: { maxWidth: 190, alignItems: 'flex-end' },
  nextStageLabel: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  nextStageValue: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 17, textAlign: 'right', marginTop: 2 },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
  progressFill: { height: '100%', borderRadius: 4 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { width: 26, alignItems: 'center' },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  currentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  stepLine: { width: 2, flex: 1, minHeight: 24 },
  stepTitle: { fontFamily: 'sans-serif-medium', fontSize: 14, lineHeight: 20, marginTop: 3 },
  stepMeta: { fontFamily: 'sans-serif', fontSize: 12, marginTop: 2 },
  courierCard: { height: 220, borderRadius: 28, overflow: 'hidden', backgroundColor: '#F6E9EE' },
  courierImage: { width: '100%', height: '100%' },
  courierShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(40,15,35,0.24)' },
  courierContent: { ...StyleSheet.absoluteFillObject, padding: 18, justifyContent: 'flex-end', alignItems: 'flex-start' },
  courierTitle: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 26, lineHeight: 30, maxWidth: '75%', marginTop: 8 },
  deliveredImage: { width: '100%', height: 300, borderRadius: 28 },
  orderControl: { minHeight: 48, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  orderControlText: { fontFamily: 'sans-serif-medium', fontSize: 12.5 },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 14 },
  privacyText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionsColumn: { flexDirection: 'column' },
  secondaryButton: { flex: 1, minHeight: 52, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { fontFamily: 'sans-serif-medium', fontSize: 12, textAlign: 'center' },
  subscriptionError: { color: LousaPalette.danger, fontFamily: 'sans-serif', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  orderBadge: { position: 'absolute', top: 12, right: 12, borderRadius: 999, backgroundColor: 'rgba(23,19,29,0.84)', paddingHorizontal: 10, paddingVertical: 6 },
  orderBadgeText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 12 },
  itemRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  itemName: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  itemReason: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16, marginTop: 2 },
  itemQuantity: { fontFamily: 'sans-serif-medium', fontSize: 13 },
});
