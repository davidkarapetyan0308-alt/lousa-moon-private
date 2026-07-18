import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { RealisticMoon } from '../../src/components/RealisticMoon';
import { ScreenScroll, TabbedScreen, useResponsiveLayout } from '../../src/components/layout';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { PressScale, StatusPill, SurfaceCard } from '../../src/components/ui';
import {
  useBoxStore,
  useCycleStore,
  useEngagementStore,
  useUserStore,
  useWellnessStore,
  MoodType,
} from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import {
  buildDailyInsight,
  buildImmediateCheckInResponse,
  calculateGentleProgress,
  selectTodayPriority,
  shouldShowContextualBox,
} from '../../src/services/engagement';
import { getCycleData } from '../../src/utils/cycleEngine';
import { fromLocalDateString, toLocalDateString } from '../../src/utils/date';
import { getMoonPhase, getMoonPhaseLabel } from '../../src/utils/moonPhase';
import { trackProductEvent } from '../../src/services/productAnalytics';
import { buildPreparationWindowCopy, calculatePreparationWindow } from '../../src/services/preparationWindow';

const COPY = {
  ru: {
    morning: 'Доброе утро', day: 'Добрый день', evening: 'Добрый вечер', night: 'Доброй ночи',
    dayOfCycle: 'день цикла', confidence: 'Уверенность', confidenceValues: { insufficient: 'недостаточно данных', low: 'низкая', medium: 'средняя', high: 'высокая' },
    phase: { menstrual: 'Менструальная фаза', follicular: 'Фолликулярное окно', ovulation: 'Предполагаемая овуляция', luteal: 'Лютеиновая фаза' },
    forecastInsufficient: 'Отметьте дату начала последней менструации',
    forecastRange: 'Вероятный диапазон: {range}',
    forecastPassed: 'Прогнозируемое окно прошло. LOUSA не будет считать, что новый цикл начался без вашей отметки.',
    cycleNeedsUpdate: 'Текущий день цикла не подтверждён',
    openCalendar: 'Уточнить в календаре',
    how: 'Как вы себя чувствуете?', howBody: 'Отметьте самочувствие. Запись можно изменить в любой момент.', detail: 'Добавить запись', change: 'Изменить',
    moods: { calm: 'Спокойно', happy: 'Хорошо', tired: 'Устала', anxious: 'Тревожно', irritable: 'Раздражённо' },
    insightHelpful: 'Полезно', insightNo: 'Не про меня', source: 'Почему это показано',
    careDays: 'записей в этом месяце', cycles: 'цикл ещё не настроен',
    upcoming: 'Сейчас важно', boxTitle: 'LOUSA BOX', open: 'Открыть', boxFeedback: 'Следующий бокс учтёт твой отзыв.',
    disclaimer: 'Это наблюдение по вашим записям, не диагноз.', prepPrivacy: 'Курьер видит только адрес, телефон и окно доставки. Ваш цикл, заметки и самочувствие остаются приватными.',
  },
  en: {
    morning: 'Good morning', day: 'Good afternoon', evening: 'Good evening', night: 'Good night',
    dayOfCycle: 'cycle day', confidence: 'Confidence', confidenceValues: { insufficient: 'not enough data', low: 'low', medium: 'medium', high: 'high' },
    phase: { menstrual: 'Menstrual phase', follicular: 'Follicular phase', ovulation: 'Estimated ovulation', luteal: 'Luteal phase' },
    forecastInsufficient: 'Add the first period start date',
    forecastRange: 'Your next period is most likely {range}',
    forecastPassed: 'The forecast window has passed. LOUSA will not assume a new cycle without your confirmation.',
    cycleNeedsUpdate: 'The current cycle day is not confirmed',
    openCalendar: 'Update in calendar',
    how: 'How do you feel today?', howBody: 'Log a mood or add a short note. LOUSA will use it to notice gentle patterns.', detail: 'Add entry', change: 'Change',
    moods: { calm: 'Calm', happy: 'Good', tired: 'Tired', anxious: 'Anxious', irritable: 'Irritable' },
    insightHelpful: 'Helpful', insightNo: 'Not for me', source: 'Why this appears',
    careDays: 'entries this month', cycles: 'cycle not set yet', upcoming: 'Important now', boxTitle: 'LOUSA BOX', open: 'Open', boxFeedback: 'Your next box will use your feedback.',
    disclaimer: 'Observations use only your own entries and are not a diagnosis.', prepPrivacy: 'The courier only sees the address, phone and delivery window. Your cycle, notes and wellbeing stay private.',
  },
  hy: {
    morning: 'Բարի լույս', day: 'Բարի օր', evening: 'Բարի երեկո', night: 'Բարի գիշեր',
    dayOfCycle: 'ցիկլի օր', confidence: 'Վստահություն', confidenceValues: { insufficient: 'տվյալները քիչ են', low: 'ցածր', medium: 'միջին', high: 'բարձր' },
    phase: { menstrual: 'Դաշտանային փուլ', follicular: 'Ֆոլիկուլային փուլ', ovulation: 'Ենթադրվող օվուլյացիա', luteal: 'Լյուտեինային փուլ' },
    forecastInsufficient: 'Նշեք առաջին ամսաթիվը',
    forecastRange: 'Հաջորդ դաշտանը առավել հավանական է {range}',
    forecastPassed: 'Կանխատեսվող շրջանն անցել է։ LOUSA-ն նոր ցիկլ չի հաստատի առանց ձեր նշման։',
    cycleNeedsUpdate: 'Ցիկլի ընթացիկ օրը հաստատված չէ',
    openCalendar: 'Ճշտել օրացույցում',
    how: 'Ինչպե՞ս եք զգում այսօր', howBody: 'Նշեք տրամադրությունը կամ ավելացրեք կարճ գրառում։', detail: 'Ավելացնել գրառում', change: 'Փոխել',
    moods: { calm: 'Հանգիստ', happy: 'Լավ', tired: 'Հոգնած', anxious: 'Անհանգիստ', irritable: 'Գրգռված' },
    insightHelpful: 'Օգտակար է', insightNo: 'Ինձ չի վերաբերում', source: 'Ինչու է սա ցուցադրվում',
    careDays: 'գրառում այս ամսում', cycles: 'ցիկլը դեռ կարգավորված չէ', upcoming: 'Հիմա կարևոր է', boxTitle: 'LOUSA BOX', open: 'Բացել', boxFeedback: 'Հաջորդ բոքսը կհաշվի քո կարծիքը։',
    disclaimer: 'Դիտարկումները հիմնված են միայն ձեր գրառումների վրա և ախտորոշում չեն։', prepPrivacy: 'Առաքիչը տեսնում է միայն հասցեն, հեռախոսը և առաքման ժամը։ Ցիկլը և գրառումները մնում են անձնական։',
  },
} as const;

const MOODS: { id: Extract<MoodType, 'calm' | 'happy' | 'tired' | 'anxious' | 'irritable'>; icon: string }[] = [
  { id: 'calm', icon: 'sentiment_calm' },
  { id: 'happy', icon: 'sentiment_very_satisfied' },
  { id: 'tired', icon: 'bedtime' },
  { id: 'anxious', icon: 'sentiment_stressed' },
  { id: 'irritable', icon: 'sentiment_dissatisfied' },
];

function greetingForHour(copy: { morning: string; day: string; evening: string; night: string }) {
  const hour = new Date().getHours();
  if (hour < 6) return copy.night;
  if (hour < 12) return copy.morning;
  if (hour < 17) return copy.day;
  return copy.evening;
}

function formatRange(start: string, end: string, language: 'ru' | 'en' | 'hy') {
  const locale = language === 'en' ? 'en-US' : language === 'hy' ? 'hy-AM' : 'ru-RU';
  const startText = fromLocalDateString(start).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const endText = fromLocalDateString(end).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return start === end ? startText : `${startText}–${endText}`;
}

export default function TodayScreen() {
  const { colors, isDark } = useTheme();
  const { compactWidth } = useResponsiveLayout();
  const language = useUserStore((state) => state.language);
  const name = useUserStore((state) => state.name);
  const communicationStyle = useUserStore((state) => state.communicationStyle);
  const copy = COPY[language];
  const cycleStore = useCycleStore();
  const wellness = useWellnessStore();
  const box = useBoxStore();
  const engagement = useEngagementStore();
  const today = toLocalDateString();
  const todayLog = wellness.getLog(today);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

  const prediction = useMemo(() => calculateCyclePrediction(cycleStore.periodRecords, {
    fallbackCycleLength: cycleStore.avgCycleLength,
    fallbackPeriodLength: cycleStore.avgPeriodLength,
    cycleContext: cycleStore.onboardingProfile.cycleContext,
    factors: cycleStore.onboardingProfile.factors,
  }), [cycleStore.periodRecords, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, cycleStore.onboardingProfile.cycleContext, cycleStore.onboardingProfile.factors]);

  const cycle = useMemo(() => getCycleData(
    cycleStore.lastPeriodStart ? fromLocalDateString(cycleStore.lastPeriodStart) : null,
    cycleStore.avgCycleLength,
    cycleStore.avgPeriodLength,
    new Date(),
    cycleStore.periodHistory.length,
    cycleStore.periodRecords,
    { cycleContext: cycleStore.onboardingProfile.cycleContext, factors: cycleStore.onboardingProfile.factors },
  ), [cycleStore]);
  const moon = useMemo(() => getMoonPhase(new Date()), []);
  const insight = useMemo(() => buildDailyInsight({ language, logs: wellness.dailyLogs, feedback: engagement.insightFeedback }), [language, wellness.dailyLogs, engagement.insightFeedback]);
  const priority = useMemo(() => selectTodayPriority({
    language,
    migrationReviewRequired: cycleStore.migrationReviewRequired,
    prediction,
    todayLog,
    isOnboarded: true,
    confirmedPeriods: prediction.confirmedPeriodsCount || 0,
    orders: box.orders,
    feedbackOrderIds: box.feedback.map((item) => item.orderId),
  }), [language, cycleStore.migrationReviewRequired, prediction, todayLog, box.orders, box.feedback]);
  const progress = useMemo(() => calculateGentleProgress({
    logs: wellness.dailyLogs,
    periods: cycleStore.periodRecords,
    feedback: engagement.insightFeedback,
    weeklySummariesOpened: engagement.weeklySummariesOpened,
  }), [wellness.dailyLogs, cycleStore.periodRecords, engagement.insightFeedback, engagement.weeklySummariesOpened]);
  const activeOrder = box.orders.find((order) => !['cancelled', 'refunded'].includes(order.status)) || null;

  const confirmedPeriods = useMemo(() => cycleStore.periodRecords.filter((record) => record.confirmed && !record.deletedAt && !record.needsReview), [cycleStore.periodRecords]);
  const hasCycleData = confirmedPeriods.length > 0;
  const displayName = name.trim().split(/\s+/)[0] || '';
  const cyclePositionKnown = hasCycleData && cycle.isCyclePositionKnown;
  const hasFeedback = activeOrder ? box.feedback.some((item) => item.orderId === activeOrder.id) : false;
  const showBox = shouldShowContextualBox({ order: activeOrder, hasFeedback });
  const preparationWindow = useMemo(() => calculatePreparationWindow(prediction), [prediction]);
  const preparationCopy = useMemo(() => buildPreparationWindowCopy(preparationWindow, language), [preparationWindow, language]);

  useEffect(() => {
    trackProductEvent('insight_viewed', { language, source: 'today', demo: useUserStore.getState().isDemoMode }).catch(() => {});
  }, [insight.id, language]);

  const chooseMood = (mood: MoodType) => {
    wellness.setMood(today, mood);
    engagement.recordQuickCheckIn();
    trackProductEvent('quick_checkin_completed', { language, entry_mode: 'one_tap', style: communicationStyle, demo: useUserStore.getState().isDemoMode }).catch(() => {});
    setCheckInMessage(buildImmediateCheckInResponse({ language, mood, logs: { ...wellness.dailyLogs, [today]: { ...todayLog, mood } }, communicationStyle }));
  };

  const moonSize = compactWidth ? 68 : 76;
  const moonPhaseLabel = getMoonPhaseLabel(moon.phase, language);

  const forecastText = prediction.expectedWindowPassed
    ? copy.forecastPassed
    : prediction.earliestStart && prediction.latestStart
      ? copy.forecastRange.replace('{range}', formatRange(prediction.earliestStart, prediction.latestStart, language))
      : copy.forecastInsufficient;

  return (
    <TabbedScreen backgroundVariant={isDark ? 'cosmic' : 'minimal'}>
      <ScreenScroll tabbed contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.greeting, compactWidth && styles.greetingCompact, { color: colors.onBackground }]}>
            {greetingForHour(copy)}{displayName ? `, ${displayName}` : ''}
          </Text>
          <View style={styles.progressLine}>
            <Text style={[styles.progressText, { color: colors.onSurfaceVariant }]}>{progress.careDaysThisMonth} {copy.careDays}</Text>
            <View style={[styles.dot, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.progressText, { color: colors.onSurfaceVariant }]}>{hasCycleData ? `${progress.confirmedCycles} ${language === 'en' ? copy.cycles : language === 'hy' ? copy.cycles : 'подтверждённых циклов'}` : copy.cycles}</Text>
          </View>
        </View>

        <SurfaceCard padding={18} tone={isDark ? 'night' : 'default'} style={styles.cycleCard}>
          <View style={styles.cycleCopy}>
            {cyclePositionKnown ? (
              <>
                <Text style={[styles.cycleDay, { color: colors.onBackground }]}>{cycle.currentDay} {copy.dayOfCycle}</Text>
                <Text style={[styles.phase, { color: colors.onSurfaceVariant }]}>{copy.phase[cycle.phase]}</Text>
                <Text style={[styles.forecast, { color: colors.onBackground }]}>{forecastText}</Text>
                <Text style={[styles.confidence, { color: colors.onSurfaceVariant }]}>{copy.confidence}: {copy.confidenceValues[prediction.confidence]}</Text>
              </>
            ) : hasCycleData ? (
              <>
                <Text style={[styles.cycleDay, { color: colors.onBackground }]}>{copy.cycleNeedsUpdate}</Text>
                <Text style={[styles.forecast, styles.noDataForecast, { color: colors.onSurfaceVariant }]}>{copy.forecastPassed}</Text>
                <PressScale onPress={() => router.push('/(tabs)/cycle')} style={styles.noDataButton}>
                  <Text style={styles.noDataButtonText}>{copy.openCalendar}</Text>
                  <MaterialSymbol name="arrow_forward" size={16} color={LousaPalette.berry} />
                </PressScale>
              </>
            ) : (
              <>
                <Text style={[styles.cycleDay, { color: colors.onBackground }]}>
                  {language === 'en' ? 'Cycle not set yet' : language === 'hy' ? 'Ցիկլը դեռ կարգավորված չէ' : 'Цикл пока не настроен'}
                </Text>
                <Text style={[styles.forecast, styles.noDataForecast, { color: colors.onSurfaceVariant }]}>
                  {language === 'en'
                    ? 'Add the start date of your last period — LOUSA will build a cautious forecast.'
                    : language === 'hy'
                      ? 'Նշեք վերջին դաշտանի սկիզբը, և LOUSA-ն կկազմի զգուշավոր կանխատեսում։'
                      : 'Отметьте дату начала последней менструации — и LOUSA начнёт строить осторожный прогноз.'}
                </Text>
                <PressScale onPress={() => router.push('/screens/period-editor')} style={styles.noDataButton}>
                  <Text style={styles.noDataButtonText}>{language === 'en' ? 'Add date' : language === 'hy' ? 'Նշել ամսաթիվը' : 'Отметить дату'}</Text>
                  <MaterialSymbol name="arrow_forward" size={16} color={LousaPalette.berry} />
                </PressScale>
              </>
            )}
          </View>
          <View style={[styles.moonColumn, compactWidth && styles.moonColumnCompact]}>
            <RealisticMoon
              size={moonSize}
              illumination={moon.illumination}
              phase={moon.phase}
              showGlow={hasCycleData}
              showBorder
              accessibilityLabel={`${moonPhaseLabel}, ${Math.round(moon.illumination * 100)}%`}
            />
            <Text style={[styles.moonPhaseLabel, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
              {moonPhaseLabel}
            </Text>
          </View>
        </SurfaceCard>

        <SurfaceCard padding={18} tone="default" style={styles.preparationCard}>
          <View style={styles.preparationHeader}>
            <IconLine icon="event_available" />
            <View style={styles.preparationCopy}>
              <Text style={[styles.sectionEyebrow, { color: LousaPalette.berry }]}>{preparationCopy.eyebrow}</Text>
              <Text style={[styles.preparationTitle, { color: colors.onBackground }]}>{preparationCopy.title}</Text>
              <Text style={[styles.preparationBody, { color: colors.onSurfaceVariant }]}>{preparationCopy.body}</Text>
            </View>
          </View>
          <View style={styles.preparationActions}>
            <PressScale onPress={() => preparationWindow.state === 'no_data' ? router.push('/screens/period-editor') : router.push('/(tabs)/box')} style={styles.preparationPrimary}>
              <Text style={styles.preparationPrimaryText}>{preparationCopy.actionLabel}</Text>
              <MaterialSymbol name="arrow_forward" size={16} color="#FFFFFF" />
            </PressScale>
            <PressScale onPress={() => router.push('/auth/onboarding')} style={[styles.preparationSecondary, { borderColor: colors.outlineVariant }]}>
              <Text style={[styles.preparationSecondaryText, { color: colors.onSurfaceVariant }]}>{preparationCopy.secondaryLabel}</Text>
            </PressScale>
          </View>
          <View style={[styles.preparationPrivacy, { borderTopColor: colors.outlineVariant }]}>
            <MaterialSymbol name="lock" size={15} color={colors.outline} />
            <Text style={[styles.preparationPrivacyText, { color: colors.onSurfaceVariant }]}>{copy.prepPrivacy}</Text>
          </View>
        </SurfaceCard>

        <SurfaceCard padding={18} tone="default" style={styles.checkInCard}>
          <View style={styles.checkInHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.checkInTitle, { color: colors.onBackground }]}>{copy.how}</Text>
              <Text style={[styles.checkInBody, { color: colors.onSurfaceVariant }]}>{copy.howBody}</Text>
            </View>
            {todayLog.mood ? <StatusPill tone="rose" label={copy.change} /> : null}
          </View>
          <View style={styles.moodsRow}>
            {MOODS.map((item) => {
              const selected = todayLog.mood === item.id;
              return (
                <PressScale
                  key={item.id}
                  accessibilityLabel={copy.moods[item.id]}
                  onPress={() => chooseMood(item.id)}
                  style={styles.moodOption}
                >
                  <View style={[
                    styles.moodCircle,
                    {
                      backgroundColor: selected ? LousaPalette.berry : (isDark ? 'rgba(255,255,255,0.07)' : '#FFFDFE'),
                      borderColor: selected ? LousaPalette.berry : colors.outlineVariant,
                    },
                  ]}>
                    <MaterialSymbol name={item.icon} size={22} color={selected ? '#FFFFFF' : colors.onSurfaceVariant} />
                  </View>
                  {selected ? (
                    <Text numberOfLines={2} style={[styles.moodText, { color: colors.onBackground }]}>{copy.moods[item.id]}</Text>
                  ) : <View style={styles.moodLabelPlaceholder} />}
                </PressScale>
              );
            })}
          </View>
          {checkInMessage ? (
            <Animated.View entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)} style={[styles.instantResponse, { borderTopColor: colors.outlineVariant }]}>
              <MaterialSymbol name="auto_awesome" size={17} color={LousaPalette.berry} />
              <Text style={[styles.instantText, { color: colors.onSurfaceVariant }]}>{checkInMessage}</Text>
            </Animated.View>
          ) : null}
          <PressScale onPress={() => router.push('/screens/log-state')} style={styles.detailAction}>
            <Text style={styles.detailText}>{copy.detail}</Text>
            <MaterialSymbol name="arrow_forward" size={17} color={LousaPalette.berry} />
          </PressScale>
        </SurfaceCard>

        {priority.type !== 'quick_check_in' && priority.type !== 'none' ? (
          <View style={styles.section}>
            <Text style={[styles.sectionEyebrow, { color: LousaPalette.berry }]}>{copy.upcoming}</Text>
            <PressScale onPress={() => priority.route && router.push(priority.route as any)}>
              <SurfaceCard padding={17} style={styles.priorityCard}>
                <IconLine icon={priority.type === 'delivery_today' ? 'delivery_dining' : priority.type.includes('box') || priority.type === 'feedback_required' ? 'redeem' : 'calendar_month'} />
                <View style={styles.priorityCopy}>
                  <Text style={[styles.priorityTitle, { color: colors.onBackground }]}>{priority.title}</Text>
                  {priority.description ? <Text style={[styles.priorityBody, { color: colors.onSurfaceVariant }]}>{priority.description}</Text> : null}
                </View>
                <MaterialSymbol name="chevron_right" size={20} color={colors.outline} />
              </SurfaceCard>
            </PressScale>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionEyebrow, { color: LousaPalette.berry }]}>{insight.category}</Text>
          <SurfaceCard padding={19} style={styles.insightCard}>
            <Text style={[styles.insightTitle, { color: colors.onBackground }]}>{insight.title}</Text>
            <Text style={[styles.insightBody, { color: colors.onSurfaceVariant }]}>{insight.body}</Text>
            <View style={styles.insightActions}>
              <PressScale onPress={() => { engagement.submitInsightFeedback(insight.id, 'helpful'); trackProductEvent('insight_feedback_submitted', { language, response: 'helpful' }).catch(() => {}); }} style={[styles.feedbackButton, styles.feedbackPrimary]}>
                <MaterialSymbol name="favorite" size={16} color="#FFFFFF" />
                <Text style={styles.feedbackPrimaryText}>{copy.insightHelpful}</Text>
              </PressScale>
              <PressScale onPress={() => { engagement.submitInsightFeedback(insight.id, 'not_relevant'); trackProductEvent('insight_feedback_submitted', { language, response: 'not_relevant' }).catch(() => {}); }} style={[styles.feedbackButton, { borderColor: colors.outlineVariant }]}>
                <Text style={[styles.feedbackSecondaryText, { color: colors.onSurfaceVariant }]}>{copy.insightNo}</Text>
              </PressScale>
            </View>
            <PressScale onPress={() => setShowSource((value) => !value)} style={styles.sourceButton}>
              <MaterialSymbol name="info" size={15} color={colors.outline} />
              <Text style={[styles.sourceText, { color: colors.outline }]}>{copy.source}</Text>
            </PressScale>
            {showSource ? <Text style={[styles.sourceNote, { color: colors.onSurfaceVariant }]}>{insight.sourceNote} {copy.disclaimer}</Text> : null}
          </SurfaceCard>
        </View>

        {showBox && activeOrder ? (
          <View style={styles.section}>
            <PressScale onPress={() => activeOrder.status === 'delivered' && !hasFeedback ? router.push('/screens/box-feedback') : router.push('/(tabs)/box')}>
              <SurfaceCard padding={18} tone="accent" style={styles.contextBox}>
                <IconLine icon={activeOrder.status === 'out_for_delivery' ? 'delivery_dining' : 'redeem'} />
                <View style={styles.priorityCopy}>
                  <Text style={[styles.priorityTitle, { color: colors.onBackground }]}>{copy.boxTitle}</Text>
                  <Text style={[styles.priorityBody, { color: colors.onSurfaceVariant }]}>{activeOrder.status === 'delivered' && !hasFeedback ? copy.boxFeedback : priority.type.includes('box') || priority.type === 'delivery_today' ? priority.description : copy.boxFeedback}</Text>
                </View>
                <Text style={styles.openText}>{copy.open}</Text>
              </SurfaceCard>
            </PressScale>
          </View>
        ) : null}
      </ScreenScroll>
    </TabbedScreen>
  );
}

function IconLine({ icon }: { icon: string }) {
  return <View style={styles.iconLine}><MaterialSymbol name={icon} size={21} color={LousaPalette.berry} /></View>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 4 },
  intro: { marginTop: 2, marginBottom: 16 },
  greeting: { fontFamily: 'sans-serif-medium', fontSize: 25, lineHeight: 31, letterSpacing: -0.2 },
  greetingCompact: { fontSize: 20, lineHeight: 26 },
  progressLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  progressText: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 16 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  cycleCard: { minHeight: 138, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 },
  cycleCopy: { flex: 1, minWidth: 0 },
  cycleDay: { fontFamily: 'sans-serif-medium', fontSize: 20, lineHeight: 26 },
  phase: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 18, marginTop: 2 },
  forecast: { fontFamily: 'sans-serif-medium', fontSize: 13.5, lineHeight: 20, marginTop: 13 },
  confidence: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16, marginTop: 4 },
  moonColumn: { width: 94, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  moonColumnCompact: { width: 82 },
  moonPhaseLabel: { fontFamily: 'sans-serif-medium', fontSize: 10.5, lineHeight: 14, textAlign: 'center', marginTop: -4, maxWidth: 92 },
  noDataForecast: { marginTop: 9, maxWidth: 285 },
  noDataButton: { marginTop: 12, minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: '#E7DADF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: '#FFFDFE' },
  noDataButtonText: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 13 },
  preparationCard: { marginBottom: 18 },
  preparationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  preparationCopy: { flex: 1, minWidth: 0 },
  preparationTitle: { fontFamily: 'sans-serif-medium', fontSize: 18, lineHeight: 24, marginTop: 3 },
  preparationBody: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 19, marginTop: 7 },
  preparationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  preparationPrimary: { minHeight: 48, borderRadius: 999, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: LousaPalette.berry },
  preparationPrimaryText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 12.5 },
  preparationSecondary: { minHeight: 48, borderRadius: 999, paddingHorizontal: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  preparationSecondaryText: { fontFamily: 'sans-serif-medium', fontSize: 12.5 },
  preparationPrivacy: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  preparationPrivacyText: { flex: 1, fontFamily: 'sans-serif', fontSize: 11.5, lineHeight: 17 },
  checkInCard: { marginBottom: 18 },
  checkInHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkInTitle: { fontFamily: 'sans-serif-medium', fontSize: 20, lineHeight: 26, letterSpacing: -0.1 },
  checkInBody: { fontFamily: 'sans-serif', fontSize: 13.5, lineHeight: 20, marginTop: 5 },
  moodsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, marginTop: 18 },
  moodOption: { flex: 1, alignItems: 'center', minWidth: 0, minHeight: 78 },
  moodCircle: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  moodText: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 7, minHeight: 24 },
  moodLabelPlaceholder: { height: 24, marginTop: 7 },
  instantResponse: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, marginTop: 12 },
  instantText: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 18 },
  detailAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  detailText: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 13.5 },
  section: { marginBottom: 18 },
  sectionEyebrow: { fontFamily: 'sans-serif-medium', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 9 },
  priorityCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconLine: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8E7ED', alignItems: 'center', justifyContent: 'center' },
  priorityCopy: { flex: 1, minWidth: 0 },
  priorityTitle: { fontFamily: 'sans-serif-medium', fontSize: 15, lineHeight: 20 },
  priorityBody: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 18, marginTop: 3 },
  insightCard: {},
  insightTitle: { fontFamily: 'sans-serif-medium', fontSize: 20, lineHeight: 26 },
  insightBody: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21, marginTop: 9 },
  insightActions: { flexDirection: 'row', gap: 9, marginTop: 17, flexWrap: 'wrap' },
  feedbackButton: { minHeight: 48, borderRadius: 999, paddingHorizontal: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  feedbackPrimary: { backgroundColor: LousaPalette.berry, borderColor: LousaPalette.berry },
  feedbackPrimaryText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 12 },
  feedbackSecondaryText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  sourceButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 7 },
  sourceText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  sourceNote: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 1 },
  contextBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  openText: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 12 },
});
