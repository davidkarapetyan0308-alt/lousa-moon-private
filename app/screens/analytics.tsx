import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ModalScreen, PageIntro, ScreenScroll, useResponsiveLayout } from '../../src/components/layout';
import { IconBubble, PressScale, PrimaryAction, SectionHeader, StatusPill, SurfaceCard } from '../../src/components/ui';
import { MoodType, SymptomType, useCycleStore, useUserStore, useWellnessStore } from '../../src/store';
import { MOOD_ITEMS, SYMPTOM_LABELS } from '../../src/data/wellnessCatalog';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getCycleData } from '../../src/utils/cycleEngine';
import { fromLocalDateString } from '../../src/utils/date';
import { summarizePredictionAccuracy } from '../../src/services/predictionAccuracy';

const COPY = {
  ru: {
    appBar: 'Аналитика', title: 'Твои наблюдения', subtitle: 'Не просто графики — понятные выводы из ежедневных записей.',
    periods: ['7 дней', '30 дней', '3 месяца'], notEnough: 'Пока мало данных', notEnoughText: 'Добавь хотя бы три ежедневные записи, чтобы LOUSA начала находить закономерности.', log: 'Добавить запись',
    insightTitle: 'Главный вывод', insight: 'Твоя энергия чаще снижается ближе к предполагаемому началу менструации. Продолжай записи, чтобы вывод стал точнее.',
    energy: 'Средняя энергия', water: 'Вода в день', sleep: 'Средний сон', frequent: 'Частый симптом', none: 'Нет данных',
    trend: 'Энергия за последние дни', diary: 'Последние записи', noSymptoms: 'Без симптомов', day: 'день цикла', records: 'записей', accuracy: 'Точность прошлых прогнозов', averageError: 'Среднее отклонение', insideRange: 'Попадание в диапазон', forecasts: 'проверенных прогнозов',
  },
  en: {
    appBar: 'Analytics', title: 'Your observations', subtitle: 'Not just charts — clear insights from your daily check-ins.',
    periods: ['7 days', '30 days', '3 months'], notEnough: 'Not enough data yet', notEnoughText: 'Add at least three daily check-ins so LOUSA can start finding patterns.', log: 'Add a check-in',
    insightTitle: 'Main insight', insight: 'Your energy tends to drop closer to your expected period. Keep logging to make this insight more accurate.',
    energy: 'Average energy', water: 'Water per day', sleep: 'Average sleep', frequent: 'Frequent symptom', none: 'No data',
    trend: 'Energy over recent days', diary: 'Recent entries', noSymptoms: 'No symptoms', day: 'cycle day', records: 'entries', accuracy: 'Past forecast accuracy', averageError: 'Average error', insideRange: 'Inside predicted range', forecasts: 'evaluated forecasts',
  },
  hy: {
    appBar: 'ՎԵՐԼՈՒԾՈՒԹՅՈՒՆ', title: 'Քո դիտարկումները', subtitle: 'Ոչ միայն գրաֆիկներ, այլ հասկանալի եզրակացություններ օրական նշումներից։',
    periods: ['7 օր', '30 օր', '3 ամիս'], notEnough: 'Տվյալները դեռ քիչ են', notEnoughText: 'Ավելացրու առնվազն երեք օրական գրառում, որպեսզի LOUSA-ն սկսի նկատել օրինաչափությունները։', log: 'Ավելացնել գրառում',
    insightTitle: 'Գլխավոր եզրակացություն', insight: 'Քո էներգիան հաճախ նվազում է սպասվող դաշտանին մոտենալիս։ Շարունակի՛ր գրառումները՝ ճշտությունը բարձրացնելու համար։',
    energy: 'Միջին էներգիա', water: 'Ջուր օրական', sleep: 'Միջին քուն', frequent: 'Հաճախակի ախտանիշ', none: 'Տվյալ չկա',
    trend: 'Էներգիան վերջին օրերին', diary: 'Վերջին գրառումները', noSymptoms: 'Առանց ախտանիշների', day: 'ցիկլի օր', records: 'գրառում', accuracy: 'Նախորդ կանխատեսումների ճշտությունը', averageError: 'Միջին շեղում', insideRange: 'Կանխատեսված միջակայքում', forecasts: 'ստուգված կանխատեսում',
  },
} as const;

const MOOD_ICONS: Record<MoodType, string> = Object.fromEntries(MOOD_ITEMS.map((item) => [item.id, item.icon])) as Record<MoodType, string>;

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { compactWidth } = useResponsiveLayout();
  const language = useUserStore((s) => s.language);
  const copy = COPY[language] || COPY.ru;
  const symptomNames = SYMPTOM_LABELS[language];
  const logs = useWellnessStore((s) => s.dailyLogs);
  const cycle = useCycleStore();
  const predictionAccuracy = useMemo(() => summarizePredictionAccuracy(cycle.predictionEvaluations), [cycle.predictionEvaluations]);
  const [periodIndex, setPeriodIndex] = useState(0);
  const locale = language === 'en' ? 'en-US' : language === 'hy' ? 'hy-AM' : 'ru-RU';

  const sorted = useMemo(() => Object.values(logs).sort((a, b) => b.date.localeCompare(a.date)), [logs]);
  const visible = useMemo(() => sorted.slice(0, periodIndex === 0 ? 7 : periodIndex === 1 ? 30 : 90), [sorted, periodIndex]);
  const enough = visible.length >= 3;

  const stats = useMemo(() => {
    if (!visible.length) return { energy: 0, water: 0, sleep: 0, symptom: null as SymptomType | null };
    const symptomCounts = {} as Record<SymptomType, number>;
    visible.forEach((log) => log.symptoms.forEach((item) => { symptomCounts[item] = (symptomCounts[item] || 0) + 1; }));
    const symptom = (Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null) as SymptomType | null;
    return {
      energy: Math.round(visible.reduce((sum, item) => sum + item.energy, 0) / visible.length),
      water: Math.round((visible.reduce((sum, item) => sum + item.water, 0) / visible.length) * 10) / 10,
      sleep: Math.round((visible.reduce((sum, item) => sum + item.sleep, 0) / visible.length) * 10) / 10,
      symptom,
    };
  }, [visible]);

  const chartData = useMemo(() => [...visible].reverse().slice(-7), [visible]);

  if (!enough) {
    return (
      <ModalScreen title={copy.appBar} closeIcon="arrow_back">
        <ScreenScroll contentContainerStyle={styles.emptyScroll}>
          <View style={styles.emptyWrap}>
            <Image source={require('../../assets/images/states/empty-analytics.png')} style={styles.emptyImage} resizeMode="contain" />
            <Text style={[styles.emptyTitle, { color: colors.onBackground }]}>{copy.notEnough}</Text>
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>{copy.notEnoughText}</Text>
            <View style={styles.emptyAction}><PrimaryAction label={copy.log} icon="edit_note" onPress={() => router.push('/screens/log-state')} /></View>
          </View>
        </ScreenScroll>
      </ModalScreen>
    );
  }

  return (
    <ModalScreen title={copy.appBar} closeIcon="arrow_back">
      <ScreenScroll>
        <PageIntro title={copy.title} subtitle={copy.subtitle} />

        <View style={styles.periodTabs}>
          {copy.periods.map((label, index) => (
            <PressScale key={label} onPress={() => setPeriodIndex(index)} style={[styles.periodTab, periodIndex === index && styles.periodTabActive]}>
              <Text style={[styles.periodText, { color: periodIndex === index ? '#fff' : colors.onBackground }]}>{label}</Text>
            </PressScale>
          ))}
        </View>

        <SurfaceCard padding={20} tone="accent" style={styles.insightCard}>
          <View style={styles.insightHead}>
            <IconBubble icon="auto_awesome" tone="rose" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightEyebrow, { color: LousaPalette.berry }]}>{copy.insightTitle}</Text>
              <Text style={[styles.insightText, { color: colors.onBackground }]}>{copy.insight}</Text>
            </View>
          </View>
          <StatusPill label={`${visible.length} ${copy.records}`} tone="rose" icon="fact_check" />
        </SurfaceCard>

        <View style={[styles.statsGrid, compactWidth && styles.statsGridCompact]}>
          {[
            { label: copy.energy, value: `${stats.energy}/5`, icon: 'bolt', tone: 'rose' as const },
            { label: copy.water, value: `${stats.water}`, icon: 'water_drop', tone: 'lavender' as const },
            { label: copy.sleep, value: `${stats.sleep} h`, icon: 'bedtime', tone: 'neutral' as const },
            { label: copy.frequent, value: stats.symptom ? symptomNames[stats.symptom] : copy.none, icon: 'healing', tone: 'rose' as const },
          ].map((item) => (
            <SurfaceCard key={item.label} padding={15} style={styles.statCard}>
              <IconBubble icon={item.icon} tone={item.tone} size={38} />
              <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>{item.label}</Text>
              <Text style={[styles.statValue, { color: colors.onBackground }]} numberOfLines={2}>{item.value}</Text>
            </SurfaceCard>
          ))}
        </View>

        {predictionAccuracy.total > 0 ? <View style={styles.section}>
          <SectionHeader title={copy.accuracy} />
          <SurfaceCard padding={18}>
            <View style={styles.accuracyRow}>
              <View style={styles.accuracyMetric}>
                <Text style={[styles.accuracyValue, { color: colors.onBackground }]}>{predictionAccuracy.averageAbsoluteErrorDays} d</Text>
                <Text style={[styles.accuracyLabel, { color: colors.onSurfaceVariant }]}>{copy.averageError}</Text>
              </View>
              <View style={[styles.accuracyDivider, { backgroundColor: colors.outlineVariant }]} />
              <View style={styles.accuracyMetric}>
                <Text style={[styles.accuracyValue, { color: colors.onBackground }]}>{predictionAccuracy.insideRangeRate}%</Text>
                <Text style={[styles.accuracyLabel, { color: colors.onSurfaceVariant }]}>{copy.insideRange}</Text>
              </View>
            </View>
            <Text style={[styles.accuracyFootnote, { color: colors.onSurfaceVariant }]}>{predictionAccuracy.total} {copy.forecasts}</Text>
          </SurfaceCard>
        </View> : null}

        <View style={styles.section}>
          <SectionHeader title={copy.trend} />
          <SurfaceCard padding={18}>
            <View style={styles.chart}>
              {chartData.map((item) => {
                const day = new Date(`${item.date}T12:00:00`);
                return (
                  <View key={item.date} style={styles.barItem}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${Math.max(10, item.energy * 20)}%` }]} />
                    </View>
                    <Text style={[styles.barValue, { color: colors.onBackground }]}>{item.energy}</Text>
                    <Text style={[styles.barLabel, { color: colors.onSurfaceVariant }]}>{day.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2)}</Text>
                  </View>
                );
              })}
            </View>
          </SurfaceCard>
        </View>

        <View style={styles.section}>
          <SectionHeader title={copy.diary} />
          <SurfaceCard padding={4}>
            {visible.slice(0, 7).map((log, index) => {
              const date = new Date(`${log.date}T12:00:00`);
              const cycleData = getCycleData(cycle.lastPeriodStart ? fromLocalDateString(cycle.lastPeriodStart) : null, cycle.avgCycleLength, cycle.avgPeriodLength, date, cycle.periodHistory.length, cycle.periodRecords, { cycleContext: cycle.onboardingProfile.cycleContext, factors: cycle.onboardingProfile.factors });
              return (
                <React.Fragment key={log.date}>
                  <View style={styles.logRow}>
                    <View style={styles.dateBlock}>
                      <Text style={[styles.dateDay, { color: colors.onBackground }]}>{date.getDate()}</Text>
                      <Text style={[styles.dateMonth, { color: colors.onSurfaceVariant }]}>{date.toLocaleDateString(locale, { month: 'short' })}</Text>
                    </View>
                    <IconBubble icon={log.mood ? MOOD_ICONS[log.mood] : 'radio_button_unchecked'} tone="rose" size={40} />
                    <View style={styles.logCopy}>
                      <Text style={[styles.logTitle, { color: colors.onBackground }]}>{cycleData.currentDay} {copy.day}</Text>
                      <Text style={[styles.logMeta, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
                        {log.symptoms.length ? log.symptoms.map((item) => symptomNames[item]).join(' · ') : copy.noSymptoms}
                      </Text>
                    </View>
                    <StatusPill label={`${log.energy}/5`} tone="neutral" />
                  </View>
                  {index < Math.min(6, visible.length - 1) ? <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} /> : null}
                </React.Fragment>
              );
            })}
          </SurfaceCard>
        </View>
      </ScreenScroll>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  emptyScroll: { flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 },
  emptyImage: { width: 190, height: 190 },
  emptyTitle: { fontFamily: 'serif', fontSize: 30, marginTop: 14, textAlign: 'center' },
  emptyText: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 390, marginTop: 8 },
  emptyAction: { width: '100%', maxWidth: 360, marginTop: 24 },
  periodTabs: { flexDirection: 'row', gap: 7, padding: 5, borderRadius: 22, backgroundColor: 'rgba(118,92,108,0.08)', marginBottom: 18 },
  periodTab: { flex: 1, minHeight: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  periodTabActive: { backgroundColor: LousaPalette.berry },
  periodText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  insightCard: { gap: 16 },
  insightHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  insightEyebrow: { fontFamily: 'sans-serif-medium', textTransform: 'uppercase', letterSpacing: 1.4, fontSize: 12 },
  insightText: { fontFamily: 'sans-serif-medium', fontSize: 15, lineHeight: 22, marginTop: 5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statsGridCompact: { flexDirection: 'column' },
  statCard: { width: '48%', flexGrow: 1, minHeight: 132 },
  statLabel: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 10 },
  statValue: { fontFamily: 'sans-serif-medium', fontSize: 16, lineHeight: 20, marginTop: 3 },
  section: { marginTop: 28 }, accuracyRow: { flexDirection: 'row', alignItems: 'stretch' }, accuracyMetric: { flex: 1, alignItems: 'center', paddingHorizontal: 8 }, accuracyDivider: { width: StyleSheet.hairlineWidth }, accuracyValue: { fontFamily: 'sans-serif-medium', fontSize: 22 }, accuracyLabel: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 4 }, accuracyFootnote: { fontFamily: 'sans-serif', fontSize: 12, textAlign: 'center', marginTop: 14 },
  chart: { height: 190, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  barItem: { flex: 1, alignItems: 'center' },
  barTrack: { width: '72%', maxWidth: 30, height: 128, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F3E9ED', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 14, backgroundColor: LousaPalette.rose },
  barValue: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 5 },
  barLabel: { fontFamily: 'sans-serif', fontSize: 12, marginTop: 2 },
  logRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 10 },
  dateBlock: { width: 36, alignItems: 'center' },
  dateDay: { fontFamily: 'serif', fontSize: 21 },
  dateMonth: { fontFamily: 'sans-serif-medium', fontSize: 12, textTransform: 'uppercase' },
  logCopy: { flex: 1 },
  logTitle: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  logMeta: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16, marginTop: 3 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14, opacity: 0.55 },
});
