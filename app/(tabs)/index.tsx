import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { RealisticMoon } from '../../src/components/RealisticMoon';
import { ScreenScroll, TabbedScreen, useResponsiveLayout } from '../../src/components/layout';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import {
  HeroCard,
  PrimaryButton,
  SectionSurface,
  StatusPill,
  TextButton,
} from '../../src/components/ui';
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
  buildImmediateCheckInResponse,
  calculateGentleProgress,
  selectTodayPriority,
} from '../../src/services/engagement';
import { getCycleData } from '../../src/utils/cycleEngine';
import { differenceInLocalDays, fromLocalDateString, toLocalDateString } from '../../src/utils/date';
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
    cycleNeedsUpdate: 'Прогноз уточняется',
    nextCycle: 'Следующий цикл — {date}', expectedIn: 'Ожидается примерно через {days}.', expectedToday: 'Ожидается примерно сегодня.', addAnotherDate: 'Добавьте ещё одну подтверждённую дату, чтобы расчёт стал точнее.',
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
    cycleNeedsUpdate: 'Forecast is being refined',
    nextCycle: 'Next period — {date}', expectedIn: 'Expected in about {days}.', expectedToday: 'Expected around today.', addAnotherDate: 'Add one more confirmed date to improve the forecast.',
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
    cycleNeedsUpdate: 'Կանխատեսումը ճշտվում է',
    nextCycle: 'Հաջորդ ցիկլը՝ {date}', expectedIn: 'Սպասվում է մոտ {days} հետո։', expectedToday: 'Սպասվում է մոտավորապես այսօր։', addAnotherDate: 'Ավելացրեք ևս մեկ հաստատված ամսաթիվ՝ հաշվարկը ճշտելու համար։',
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
  ), [cycleStore.lastPeriodStart, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, cycleStore.periodHistory.length, cycleStore.periodRecords, cycleStore.onboardingProfile.cycleContext, cycleStore.onboardingProfile.factors]);
  const moon = useMemo(() => getMoonPhase(new Date()), []);
  const progress = useMemo(() => calculateGentleProgress({
    logs: wellness.dailyLogs,
    periods: cycleStore.periodRecords,
    feedback: engagement.insightFeedback,
    weeklySummariesOpened: engagement.weeklySummariesOpened,
  }), [wellness.dailyLogs, cycleStore.periodRecords, engagement.insightFeedback, engagement.weeklySummariesOpened]);
  const activeOrder = box.orders.find((order) => !['cancelled', 'refunded'].includes(order.status)) || null;
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

  const confirmedPeriods = useMemo(
    () => cycleStore.periodRecords.filter((record) => record.confirmed && !record.deletedAt && !record.needsReview),
    [cycleStore.periodRecords],
  );
  const hasCycleData = confirmedPeriods.length > 0;
  const displayName = name.trim().split(/\s+/)[0] || '';
  const cyclePositionKnown = hasCycleData && cycle.isCyclePositionKnown;
  const preparationWindow = useMemo(() => calculatePreparationWindow(prediction), [prediction]);
  const preparationCopy = useMemo(() => buildPreparationWindowCopy(preparationWindow, language), [preparationWindow, language]);

  const chooseMood = (mood: MoodType) => {
    wellness.setMood(today, mood);
    engagement.recordQuickCheckIn();
    trackProductEvent('quick_checkin_completed', { language, entry_mode: 'one_tap', style: communicationStyle, demo: useUserStore.getState().isDemoMode }).catch(() => {});
    setCheckInMessage(buildImmediateCheckInResponse({ language, mood, logs: { ...wellness.dailyLogs, [today]: { ...todayLog, mood } }, communicationStyle }));
  };

  const moonSize = compactWidth ? 62 : 70;
  const moonPhaseLabel = getMoonPhaseLabel(moon.phase, language);
  const forecastText = prediction.expectedWindowPassed
    ? copy.forecastPassed
    : prediction.earliestStart && prediction.latestStart
      ? copy.forecastRange.replace('{range}', formatRange(prediction.earliestStart, prediction.latestStart, language))
      : copy.forecastInsufficient;

  const mostLikelyDateText = prediction.mostLikelyStart
    ? formatRange(prediction.mostLikelyStart, prediction.mostLikelyStart, language)
    : '';
  const daysUntilMostLikely = prediction.mostLikelyStart
    ? differenceInLocalDays(fromLocalDateString(prediction.mostLikelyStart), fromLocalDateString(today))
    : null;
  const expectedTimingText = daysUntilMostLikely === null || daysUntilMostLikely < 0
    ? forecastText
    : daysUntilMostLikely === 0
      ? copy.expectedToday
      : copy.expectedIn.replace('{days}', language === 'en' ? `${daysUntilMostLikely} days` : language === 'hy' ? `${daysUntilMostLikely} օր` : `${daysUntilMostLikely} дн.`);

  const cyclePrimaryLabel = cyclePositionKnown
    ? copy.openCalendar
    : hasCycleData
      ? copy.openCalendar
      : language === 'en'
        ? 'Add date'
        : language === 'hy'
          ? 'Ավելացնել ամսաթիվ'
          : 'Добавить дату';
  const cyclePrimaryRoute = hasCycleData ? '/(tabs)/cycle' : '/screens/period-editor';

  const orderTitle = activeOrder
    ? activeOrder.status === 'out_for_delivery'
      ? (language === 'en' ? 'Your Box is on the way' : language === 'hy' ? 'Ձեր Box-ը ճանապարհին է' : 'Ваш Box уже в пути')
      : activeOrder.status === 'delivered'
        ? (language === 'en' ? 'Your Box was delivered' : language === 'hy' ? 'Ձեր Box-ը առաքված է' : 'Ваш Box доставлен')
        : (language === 'en' ? 'Your next LOUSA Box' : language === 'hy' ? 'Ձեր հաջորդ LOUSA Box-ը' : 'Ваш следующий LOUSA Box')
    : preparationCopy.title;
  const orderBody = activeOrder
    ? (priority.description || preparationCopy.body)
    : preparationCopy.body;

  return (
    <TabbedScreen backgroundVariant={isDark ? 'cosmic' : 'minimal'}>
      <ScreenScroll tabbed contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.greeting, compactWidth && styles.greetingCompact, { color: colors.onBackground }]}>
            {greetingForHour(copy)}{displayName ? `, ${displayName}` : ''}
          </Text>
          <Text style={[styles.progressText, { color: colors.onSurfaceVariant }]}>
            {progress.careDaysThisMonth} {copy.careDays} · {hasCycleData ? `${progress.confirmedCycles} ${language === 'en' ? 'confirmed cycles' : language === 'hy' ? 'հաստատված ցիկլ' : 'подтверждённых циклов'}` : copy.cycles}
          </Text>
        </View>

        <HeroCard tone={isDark ? 'night' : 'rose'} style={styles.block}>
          <View style={styles.cycleCard}>
            <View style={styles.cycleCopy}>
              {cyclePositionKnown && prediction.confidence !== 'insufficient' && mostLikelyDateText ? (
                <>
                  <Text style={[styles.cycleDay, { color: colors.onBackground }]}>{copy.nextCycle.replace('{date}', mostLikelyDateText)}</Text>
                  <Text style={[styles.phase, { color: colors.onSurfaceVariant }]}>{cycle.currentDay} {copy.dayOfCycle} · {copy.phase[cycle.phase]}</Text>
                  <Text style={[styles.forecast, { color: colors.onBackground }]}>{expectedTimingText}</Text>
                  <StatusPill tone={prediction.confidence === 'high' ? 'success' : prediction.confidence === 'medium' ? 'rose' : 'neutral'} label={`${copy.confidence}: ${copy.confidenceValues[prediction.confidence]}`} />
                </>
              ) : hasCycleData ? (
                <>
                  <Text style={[styles.cycleDay, { color: colors.onBackground }]}>{copy.cycleNeedsUpdate}</Text>
                  <Text style={[styles.forecast, { color: colors.onSurfaceVariant }]}>{prediction.expectedWindowPassed ? copy.forecastPassed : copy.addAnotherDate}</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.cycleDay, { color: colors.onBackground }]}>
                    {language === 'en' ? 'Cycle not set yet' : language === 'hy' ? 'Ցիկլը դեռ կարգավորված չէ' : 'Цикл пока не настроен'}
                  </Text>
                  <Text style={[styles.forecast, { color: colors.onSurfaceVariant }]}>
                    {language === 'en'
                      ? 'Add the start date of your last period. LOUSA will build a cautious forecast.'
                      : language === 'hy'
                        ? 'Նշեք վերջին դաշտանի սկիզբը։ LOUSA-ն կկազմի զգուշավոր կանխատեսում։'
                        : 'Отметьте дату начала последней менструации. LOUSA построит осторожный прогноз.'}
                  </Text>
                </>
              )}
            </View>
            <View style={styles.moonColumn}>
              <RealisticMoon
                size={moonSize}
                illumination={moon.illumination}
                phase={moon.phase}
                showGlow={hasCycleData}
                showBorder
                accessibilityLabel={`${moonPhaseLabel}, ${Math.round(moon.illumination * 100)}%`}
              />
              <Text style={[styles.moonPhaseLabel, { color: colors.onSurfaceVariant }]} numberOfLines={2}>{moonPhaseLabel}</Text>
            </View>
          </View>
          <View style={styles.heroAction}>
            <PrimaryButton label={cyclePrimaryLabel} icon="calendar_month" onPress={() => router.push(cyclePrimaryRoute as any)} />
          </View>
        </HeroCard>

        <SectionSurface style={styles.block}>
          <View style={styles.checkInHeader}>
            <View style={styles.flexOne}>
              <Text style={[styles.checkInTitle, { color: colors.onBackground }]}>{copy.how}</Text>
              <Text style={[styles.checkInBody, { color: colors.onSurfaceVariant }]}>{copy.howBody}</Text>
            </View>
            {todayLog.mood ? <StatusPill tone="rose" label={copy.change} /> : null}
          </View>
          <View style={styles.moodsRow}>
            {MOODS.map((item) => {
              const selected = todayLog.mood === item.id;
              return (
                <TextButton
                  key={item.id}
                  label={copy.moods[item.id]}
                  icon={item.icon}
                  iconPlacement="left"
                  fullWidth={false}
                  compact
                  onPress={() => chooseMood(item.id)}
                  style={[
                    styles.moodButton,
                    {
                      backgroundColor: selected ? (isDark ? 'rgba(217,133,165,0.18)' : '#F8E7ED') : 'transparent',
                      borderColor: selected ? LousaPalette.rose : colors.outlineVariant,
                    },
                  ]}
                />
              );
            })}
          </View>
          {checkInMessage ? (
            <Animated.View entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)} style={[styles.instantResponse, { borderTopColor: colors.outlineVariant }]}>
              <MaterialSymbol name="auto_awesome" size={17} color={LousaPalette.berry} />
              <Text style={[styles.instantText, { color: colors.onSurfaceVariant }]}>{checkInMessage}</Text>
            </Animated.View>
          ) : null}
          <TextButton label={copy.detail} onPress={() => router.push('/screens/wellness-log')} icon="arrow_forward" />
        </SectionSurface>

        <HeroCard tone={activeOrder ? 'success' : 'neutral'} style={styles.block}>
          <View style={styles.contextHeader}>
            <View style={styles.contextIcon}>
              <MaterialSymbol name={activeOrder?.status === 'out_for_delivery' ? 'delivery_dining' : activeOrder ? 'redeem' : 'event_available'} size={22} color={LousaPalette.berry} />
            </View>
            <View style={styles.flexOne}>
              <Text style={[styles.contextTitle, { color: colors.onBackground }]}>{orderTitle}</Text>
              <Text style={[styles.contextBody, { color: colors.onSurfaceVariant }]}>{orderBody}</Text>
            </View>
          </View>
          <View style={styles.contextAction}>
            <PrimaryButton
              label={activeOrder ? copy.open : preparationCopy.actionLabel}
              icon={activeOrder ? 'redeem' : 'arrow_forward'}
              onPress={() => router.push(activeOrder ? '/(tabs)/box' : (preparationWindow.state === 'no_data' ? '/screens/period-editor' : '/(tabs)/box'))}
            />
          </View>
          {!activeOrder ? (
            <TextButton label={preparationCopy.secondaryLabel} onPress={() => router.push('/auth/onboarding')} />
          ) : null}
          <View style={[styles.privacyNote, { borderTopColor: colors.outlineVariant }]}>
            <MaterialSymbol name="lock" size={15} color={colors.outline} />
            <Text style={[styles.privacyText, { color: colors.onSurfaceVariant }]}>{copy.prepPrivacy}</Text>
          </View>
        </HeroCard>
      </ScreenScroll>
    </TabbedScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4 },
  intro: { marginTop: 2, marginBottom: 16 },
  greeting: { fontFamily: 'sans-serif-medium', fontSize: 25, lineHeight: 31, letterSpacing: -0.2 },
  greetingCompact: { fontSize: 21, lineHeight: 27 },
  progressText: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  block: { marginBottom: 18 },
  cycleCard: { minHeight: 126, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cycleCopy: { flex: 1, minWidth: 0 },
  cycleDay: { fontFamily: 'sans-serif-medium', fontSize: 21, lineHeight: 27 },
  phase: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 18, marginTop: 2 },
  forecast: { fontFamily: 'sans-serif', fontSize: 13.5, lineHeight: 20, marginTop: 10, marginBottom: 10 },
  moonColumn: { width: 82, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  moonPhaseLabel: { fontFamily: 'sans-serif-medium', fontSize: 10.5, lineHeight: 14, textAlign: 'center', marginTop: -3, maxWidth: 82 },
  heroAction: { marginTop: 16 },
  checkInHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flexOne: { flex: 1, minWidth: 0 },
  checkInTitle: { fontFamily: 'sans-serif-medium', fontSize: 19, lineHeight: 25 },
  checkInBody: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 19, marginTop: 4 },
  moodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  moodButton: { borderWidth: 1, borderRadius: 16 },
  instantResponse: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 },
  instantText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18 },
  contextHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  contextIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#F8E7ED', alignItems: 'center', justifyContent: 'center' },
  contextTitle: { fontFamily: 'sans-serif-medium', fontSize: 18, lineHeight: 24 },
  contextBody: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 20, marginTop: 4 },
  contextAction: { marginTop: 16 },
  privacyNote: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  privacyText: { flex: 1, fontFamily: 'sans-serif', fontSize: 11.5, lineHeight: 17 },
});
