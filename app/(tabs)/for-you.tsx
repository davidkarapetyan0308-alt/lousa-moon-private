import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ScreenScroll, TabbedScreen, useResponsiveLayout } from '../../src/components/layout';
import { PressScale, StatusPill, SurfaceCard } from '../../src/components/ui';
import { useBoxStore, useCycleStore, useUserStore, useWellnessStore } from '../../src/store';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getCycleData } from '../../src/utils/cycleEngine';
import { formatHumanDate, fromLocalDateString } from '../../src/utils/date';

const COPY = {
  ru: {
    appBar: 'Для тебя', title: 'Сегодня для вас', subtitle: 'Коротко о том, что известно сегодня и что можно сделать дальше.',
    today: 'Сегодня', cycleDay: 'день цикла', cycleUncertain: 'Текущий день цикла не подтверждён', noCycle: 'Цикл ещё не рассчитан', noCycleBody: 'Отметьте первый день менструации. Прогноз не станет записью автоматически, а ошибочную дату всегда можно изменить.',
    why: 'Почему LOUSA это показывает', basedOne: 'Расчёт основан только на одной подтверждённой дате. Это предварительная оценка с широким диапазоном.', basedFew: 'Расчёт основан на нескольких подтверждённых циклах. Диапазон обновится после новых записей.', basedEnough: 'Расчёт основан на вашей истории циклов и её вариативности. Это всё равно прогноз, а не медицинский факт.',
    possible: 'Что может происходить', possibleBody: 'Самочувствие у всех разное. Отмечайте только то, что действительно замечаете у себя.',
    actions: 'Что можно сделать', mood: 'Отметить самочувствие', calendar: 'Проверить или исправить дату', reminder: 'Настроить напоминания', patterns: 'Посмотреть свои закономерности',
    box: 'LOUSA BOX', boxPending: 'Окно подготовки пока не рассчитано', boxPendingBody: 'Подтвердите дату начала цикла, чтобы LOUSA смогла предложить предварительное окно подготовки. Доставка включена в тариф.', boxReady: 'Подготовка привязана к вашему прогнозу', boxReadyBody: 'Дата будет обновляться после каждой новой подтверждённой записи. Доставка включена в тариф без доплаты.',
    forecast: 'Предварительный диапазон',
    forecastPassed: 'Прогнозируемое окно прошло. Отметьте факт или выберите «Пока не начались» в календаре.',
    basedMissed: 'LOUSA не предполагает пропущенные циклы автоматически. Последнее прогнозное окно прошло без подтверждённой записи.', confidence: 'Уверенность', insufficient: 'данных недостаточно', low: 'низкая', medium: 'средняя', high: 'повышенная',
    materials: 'Полезно знать', materialsList: [
      ['edit_calendar', 'Как правильно отмечать цикл', 'Подтверждайте только реальные события. Прогнозные дни не считаются записями.', '/(tabs)/cycle'],
      ['difference', 'Чем прогноз отличается от факта', 'Сплошная отметка создана вами, пунктирная — только расчёт LOUSA.', '/(tabs)/cycle'],
      ['undo', 'Как исправить ошибочную дату', 'Нажмите день в календаре, измените или удалите запись, затем прогноз пересчитается.', '/(tabs)/cycle'],
      ['privacy_tip', 'Кто видит ваши данные', 'Курьер видит только данные доставки. Цикл, симптомы и заметки остаются приватными.', '/screens/legal?document=privacy'],
    ],
    disclaimer: 'LOUSA не ставит диагнозы и не заменяет консультацию врача.',
  },
  en: {
    appBar: 'For you', title: 'For you today', subtitle: 'A short view of what is known and what you can do next.',
    today: 'Today', cycleDay: 'cycle day', cycleUncertain: 'Current cycle day is not confirmed', noCycle: 'Your cycle is not calculated yet', noCycleBody: 'Record the first day of your period. A prediction never becomes a record automatically, and an incorrect date can always be changed.',
    why: 'Why LOUSA shows this', basedOne: 'The estimate is based on one confirmed start date only. It is preliminary and uses a wide range.', basedFew: 'The estimate is based on several confirmed cycles. The range updates after new records.', basedEnough: 'The estimate uses your cycle history and variability. It is still a forecast, not a medical fact.',
    possible: 'What may happen', possibleBody: 'Some people notice changes in energy, mood or discharge on different cycle days. Everyone is different, so rely on your own observations.',
    actions: 'What you can do', mood: 'Record how you feel', calendar: 'Check or correct a date', reminder: 'Set reminders', patterns: 'View your patterns',
    box: 'LOUSA BOX', boxPending: 'The preparation window is not calculated yet', boxPendingBody: 'Confirm a cycle start date to receive a preliminary preparation window. Delivery is included in your plan.', boxReady: 'Preparation follows your forecast', boxReadyBody: 'The date updates after each new confirmed record. Delivery is included with no extra fee.',
    forecast: 'Preliminary range',
    forecastPassed: 'The forecast window has passed. Record what happened or choose “Not started yet” in the calendar.',
    basedMissed: 'LOUSA never invents missing cycles. The last forecast window passed without a confirmed record.', confidence: 'Confidence', insufficient: 'insufficient data', low: 'low', medium: 'medium', high: 'higher',
    materials: 'Useful guides', materialsList: [
      ['edit_calendar', 'How to record your cycle', 'Confirm real events only. Forecast days are never saved as records.', '/(tabs)/cycle'],
      ['difference', 'Forecast versus fact', 'Solid marks are created by you; dashed marks are LOUSA estimates.', '/(tabs)/cycle'],
      ['undo', 'How to fix a wrong date', 'Tap the day, edit or delete the record, and the forecast will be recalculated.', '/(tabs)/cycle'],
      ['privacy_tip', 'Who can see your data', 'A courier sees delivery information only. Cycle data and notes remain private.', '/screens/legal?document=privacy'],
    ],
    disclaimer: 'LOUSA does not diagnose conditions and does not replace medical care.',
  },
  hy: {
    appBar: 'Քեզ համար', title: 'Այսօր քեզ համար', subtitle: 'Միայն հաստատված գրառումներից հասկանալի տեղեկություն՝ առանց հորինված խորհուրդների։',
    today: 'Այսօր', cycleDay: 'ցիկլի օր', cycleUncertain: 'Ցիկլի ընթացիկ օրը հաստատված չէ', noCycle: 'Ցիկլը դեռ հաշվարկված չէ', noCycleBody: 'Նշեք դաշտանի առաջին օրը։ Կանխատեսումը ինքնուրույն գրառում չի դառնում, իսկ սխալ ամսաթիվը միշտ կարելի է փոխել։',
    why: 'Ինչու է LOUSA-ն սա ցույց տալիս', basedOne: 'Գնահատումը հիմնված է միայն մեկ հաստատված ամսաթվի վրա և ունի լայն միջակայք։', basedFew: 'Գնահատումը հիմնված է մի քանի հաստատված ցիկլերի վրա և կթարմացվի նոր գրառումներից հետո։', basedEnough: 'Գնահատումը հաշվի է առնում ցիկլերի պատմությունն ու փոփոխականությունը, բայց շարունակում է լինել կանխատեսում։',
    possible: 'Ինչ կարող է տեղի ունենալ', possibleBody: 'Ցիկլի տարբեր օրերին որոշ մարդիկ նկատում են էներգիայի, տրամադրության կամ արտադրության փոփոխություններ։ Յուրաքանչյուրի մոտ տարբեր է։',
    actions: 'Ինչ կարող եք անել', mood: 'Նշել ինքնազգացողությունը', calendar: 'Ստուգել կամ ուղղել ամսաթիվը', reminder: 'Կարգավորել հիշեցումները', patterns: 'Դիտել օրինաչափությունները',
    box: 'LOUSA BOX', boxPending: 'Պատրաստման շրջանը դեռ հաշվարկված չէ', boxPendingBody: 'Հաստատեք ցիկլի սկիզբը՝ նախնական պատրաստման շրջանը ստանալու համար։ Առաքումը ներառված է սակագնում։', boxReady: 'Պատրաստումը կապված է կանխատեսման հետ', boxReadyBody: 'Ամսաթիվը կթարմացվի յուրաքանչյուր նոր հաստատված գրառումից հետո։ Առաքումն անվճար է սակագնի շրջանակում։',
    forecast: 'Նախնական միջակայք',
    forecastPassed: 'Կանխատեսվող շրջանն անցել է։ Նշեք փաստը կամ օրացույցում ընտրեք «Դեռ չի սկսվել»։',
    basedMissed: 'LOUSA-ն բաց թողնված ցիկլեր չի ենթադրում։ Վերջին կանխատեսվող շրջանն անցել է առանց հաստատված գրառման։', confidence: 'Վստահություն', insufficient: 'տվյալները քիչ են', low: 'ցածր', medium: 'միջին', high: 'բարձրացված',
    materials: 'Օգտակար նյութեր', materialsList: [
      ['edit_calendar', 'Ինչպես նշել ցիկլը', 'Հաստատեք միայն իրական իրադարձությունները։ Կանխատեսումը գրառում չէ։', '/(tabs)/cycle'],
      ['difference', 'Կանխատեսում և փաստ', 'Լցված նշումը ձեր գրառումն է, կետագիծը՝ LOUSA-ի հաշվարկը։', '/(tabs)/cycle'],
      ['undo', 'Ինչպես ուղղել սխալ ամսաթիվը', 'Սեղմեք օրվա վրա, փոխեք կամ ջնջեք գրառումը, և կանխատեսումը կվերահաշվարկվի։', '/(tabs)/cycle'],
      ['privacy_tip', 'Ով է տեսնում տվյալները', 'Առաքիչը տեսնում է միայն առաքման տվյալները։ Ցիկլի գրառումներն անձնական են։', '/screens/legal?document=privacy'],
    ],
    disclaimer: 'LOUSA-ն ախտորոշում չի կատարում և չի փոխարինում բժշկին։',
  },
} as const;

export default function ForYouScreen() {
  const { colors, isDark } = useTheme();
  const { compactWidth } = useResponsiveLayout();
  const language = useUserStore((state) => state.language);
  const copy = COPY[language];
  const cycle = useCycleStore();
  const wellness = useWellnessStore();
  const box = useBoxStore();
  const confirmed = useMemo(() => cycle.periodRecords.filter((item) => item.confirmed && !item.deletedAt && !item.needsReview), [cycle.periodRecords]);
  const prediction = useMemo(() => calculateCyclePrediction(cycle.periodRecords, {
    fallbackCycleLength: cycle.avgCycleLength,
    fallbackPeriodLength: cycle.avgPeriodLength,
    cycleContext: cycle.onboardingProfile.cycleContext,
    factors: cycle.onboardingProfile.factors,
    negativeBleedingDates: cycle.cycleObservations.filter((item) => item.type === 'no_bleeding' && !item.deletedAt).map((item) => item.date),
  }), [cycle.periodRecords, cycle.avgCycleLength, cycle.avgPeriodLength, cycle.onboardingProfile.cycleContext, cycle.onboardingProfile.factors, cycle.cycleObservations]);
  const hasCycle = confirmed.length > 0;
  const cycleData = useMemo(() => getCycleData(
    cycle.lastPeriodStart ? fromLocalDateString(cycle.lastPeriodStart) : null,
    cycle.avgCycleLength,
    cycle.avgPeriodLength,
    new Date(),
    cycle.periodHistory.length,
    cycle.periodRecords,
    { cycleContext: cycle.onboardingProfile.cycleContext, factors: cycle.onboardingProfile.factors },
  ), [cycle.lastPeriodStart, cycle.avgCycleLength, cycle.avgPeriodLength, cycle.periodHistory.length, cycle.periodRecords, cycle.onboardingProfile.cycleContext, cycle.onboardingProfile.factors]);
  const cyclePositionKnown = hasCycle && cycleData.isCyclePositionKnown;
  const logCount = Object.values(wellness.dailyLogs).filter((log) => log.mood || log.energy || log.symptoms.length || log.notes).length;
  const whyText = prediction.expectedWindowPassed
    ? copy.basedMissed
    : confirmed.length <= 1
      ? copy.basedOne
      : prediction.completedCyclesCount < 6
        ? copy.basedFew
        : copy.basedEnough;
  const confidenceLabel = copy[prediction.confidence];

  return (
    <TabbedScreen title={copy.appBar} backgroundVariant={isDark ? 'cosmic' : 'minimal'}>
      <ScreenScroll tabbed contentContainerStyle={styles.content}>
        <Text style={[styles.heroTitle, compactWidth && styles.heroTitleCompact, { color: colors.onBackground }]}>{copy.title}</Text>
        <Text style={[styles.heroSubtitle, { color: colors.onSurfaceVariant }]}>{copy.subtitle}</Text>

        <SurfaceCard padding={20} tone="accent" style={styles.cardGap}>
          <Text style={styles.eyebrow}>{copy.today}</Text>
          {cyclePositionKnown ? (
            <>
              <Text style={[styles.todayTitle, { color: colors.onBackground }]}>{cycleData.currentDay} {copy.cycleDay}</Text>
              <View style={styles.pills}>
                <StatusPill tone={prediction.confidence === 'high' ? 'success' : prediction.confidence === 'medium' ? 'rose' : 'neutral'} label={`${copy.confidence}: ${confidenceLabel}`} />
                <StatusPill tone="neutral" label={`${confirmed.length} ${language === 'en' ? 'confirmed starts' : language === 'hy' ? 'հաստատված սկիզբ' : 'подтверждённых начал'}`} />
              </View>
              {prediction.expectedWindowPassed ? (
                <View style={styles.forecastBlock}>
                  <Text style={[styles.forecastLabel, { color: colors.onSurfaceVariant }]}>{copy.forecast}</Text>
                  <Text style={[styles.forecastValue, { color: colors.onBackground }]}>{copy.forecastPassed}</Text>
                </View>
              ) : prediction.earliestStart && prediction.latestStart ? (
                <View style={styles.forecastBlock}>
                  <Text style={[styles.forecastLabel, { color: colors.onSurfaceVariant }]}>{copy.forecast}</Text>
                  <Text style={[styles.forecastValue, { color: colors.onBackground }]}>{formatHumanDate(prediction.earliestStart, language)}–{formatHumanDate(prediction.latestStart, language)}</Text>
                </View>
              ) : null}
            </>
          ) : hasCycle ? (
            <>
              <Text style={[styles.todayTitle, { color: colors.onBackground }]}>{copy.cycleUncertain}</Text>
              <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{copy.forecastPassed}</Text>
              <ActionButton icon="edit_calendar" label={copy.calendar} onPress={() => router.push('/(tabs)/cycle')} />
            </>
          ) : (
            <>
              <Text style={[styles.todayTitle, { color: colors.onBackground }]}>{copy.noCycle}</Text>
              <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{copy.noCycleBody}</Text>
              <ActionButton icon="calendar_month" label={copy.calendar} onPress={() => router.push('/(tabs)/cycle')} />
            </>
          )}
        </SurfaceCard>

        <InfoCard icon="help_center" title={copy.why} body={whyText} />
        <InfoCard icon="self_improvement" title={copy.possible} body={copy.possibleBody} />

        <SectionTitle title={copy.actions} />
        <View style={styles.actionGrid}>
          <ActionTile icon="favorite" label={copy.mood} note={`${logCount} ${language === 'en' ? 'entries saved' : language === 'hy' ? 'գրառում' : 'записей'}`} onPress={() => router.push('/(tabs)/wellness')} />
          <ActionTile icon="edit_calendar" label={copy.calendar} note={language === 'en' ? 'Edit and undo records' : language === 'hy' ? 'Փոխել կամ ջնջել գրառումը' : 'Изменить или удалить запись'} onPress={() => router.push('/(tabs)/cycle')} />
          <ActionTile icon="notifications" label={copy.reminder} note={language === 'en' ? 'Private notifications' : language === 'hy' ? 'Անձնական հիշեցումներ' : 'Приватные уведомления'} onPress={() => router.push('/screens/notifications')} />
          <ActionTile icon="monitoring" label={copy.patterns} note={language === 'en' ? 'Only your own data' : language === 'hy' ? 'Միայն ձեր տվյալները' : 'Только ваши данные'} onPress={() => router.push('/screens/analytics')} />
        </View>

        <SectionTitle title={copy.box} />
        <SurfaceCard padding={19} style={styles.cardGap}>
          <View style={styles.boxHeader}>
            <View style={styles.iconCircle}><MaterialSymbol name="redeem" size={22} color={LousaPalette.berry} /></View>
            <View style={styles.flexOne}>
              <Text style={[styles.cardTitle, { color: colors.onBackground }]}>{hasCycle ? copy.boxReady : copy.boxPending}</Text>
              <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{hasCycle ? copy.boxReadyBody : copy.boxPendingBody}</Text>
            </View>
          </View>
          <View style={styles.pills}>
            <StatusPill tone="success" icon="local_shipping" label={language === 'en' ? 'Delivery included' : language === 'hy' ? 'Առաքումը ներառված է' : 'Доставка включена'} />
            {box.planId ? <StatusPill tone="neutral" label={String(box.planId).toUpperCase()} /> : null}
          </View>
        </SurfaceCard>

        <SectionTitle title={copy.materials} />
        <View style={[styles.materialList, { borderColor: colors.outlineVariant }]}>
          {copy.materialsList.map(([icon, title, body, route], index) => (
            <PressScale key={title} onPress={() => router.push(route as any)} style={[styles.materialRow, index > 0 && { borderTopColor: colors.outlineVariant, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.materialIcon}><MaterialSymbol name={icon} size={20} color={LousaPalette.berry} /></View>
              <View style={styles.flexOne}>
                <Text style={[styles.materialTitle, { color: colors.onBackground }]}>{title}</Text>
                <Text style={[styles.materialBody, { color: colors.onSurfaceVariant }]}>{body}</Text>
              </View>
              <MaterialSymbol name="chevron_right" size={20} color={colors.outline} />
            </PressScale>
          ))}
        </View>

        <View style={[styles.disclaimer, { borderColor: colors.outlineVariant }]}>
          <MaterialSymbol name="health_and_safety" size={18} color={colors.onSurfaceVariant} />
          <Text style={[styles.disclaimerText, { color: colors.onSurfaceVariant }]}>{copy.disclaimer}</Text>
        </View>
      </ScreenScroll>
    </TabbedScreen>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>{title}</Text>;
}

function InfoCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <SurfaceCard padding={18} style={styles.cardGap}>
      <View style={styles.infoRow}>
        <View style={styles.iconCircle}><MaterialSymbol name={icon} size={21} color={LousaPalette.berry} /></View>
        <View style={styles.flexOne}>
          <Text style={[styles.cardTitle, { color: colors.onBackground }]}>{title}</Text>
          <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{body}</Text>
        </View>
      </View>
    </SurfaceCard>
  );
}

function ActionButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} style={styles.inlineAction}>
      <MaterialSymbol name={icon} size={18} color="#FFFFFF" />
      <Text style={styles.inlineActionText}>{label}</Text>
    </PressScale>
  );
}

function ActionTile({ icon, label, note, onPress }: { icon: string; label: string; note: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressScale onPress={onPress} style={[styles.actionTile, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
      <View style={styles.iconCircle}><MaterialSymbol name={icon} size={20} color={LousaPalette.berry} /></View>
      <Text style={[styles.actionTitle, { color: colors.onBackground }]}>{label}</Text>
      <Text style={[styles.actionNote, { color: colors.onSurfaceVariant }]}>{note}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 6 },
  heroTitle: { fontFamily: 'sans-serif-medium', fontSize: 31, lineHeight: 38, letterSpacing: -0.3 },
  heroTitleCompact: { fontSize: 28, lineHeight: 34 },
  heroSubtitle: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18, maxWidth: 520 },
  eyebrow: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  todayTitle: { fontFamily: 'sans-serif-medium', fontSize: 24, lineHeight: 30, marginTop: 7 },
  cardGap: { marginBottom: 13 },
  body: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 20, marginTop: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  forecastBlock: { marginTop: 15, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7DDE1' },
  forecastLabel: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17 },
  forecastValue: { fontFamily: 'sans-serif-medium', fontSize: 15, lineHeight: 21, marginTop: 2 },
  sectionTitle: { fontFamily: 'sans-serif-medium', fontSize: 21, lineHeight: 27, marginTop: 11, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  boxHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8E7ED', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: 'sans-serif-medium', fontSize: 16, lineHeight: 21 },
  flexOne: { flex: 1, minWidth: 0 },
  inlineAction: { alignSelf: 'flex-start', minHeight: 48, borderRadius: 23, backgroundColor: LousaPalette.berry, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  inlineActionText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 13 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  actionTile: { width: '48%', minHeight: 132, borderRadius: 24, borderWidth: 1, padding: 15 },
  actionTitle: { fontFamily: 'sans-serif-medium', fontSize: 14, lineHeight: 19, marginTop: 11 },
  actionNote: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 4 },
  materialList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  materialRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  materialIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8E7ED', alignItems: 'center', justifyContent: 'center' },
  materialTitle: { fontFamily: 'sans-serif-medium', fontSize: 14, lineHeight: 19 },
  materialBody: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 2 },
  disclaimer: { minHeight: 58, borderWidth: 1, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 6 },
  disclaimerText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17 },
});
