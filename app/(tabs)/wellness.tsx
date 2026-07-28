import React, { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { router } from 'expo-router';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ScreenScroll, TabbedScreen, useResponsiveLayout } from '../../src/components/layout';
import {
  IconBubble,
  PressScale,
  PrimaryButton,
  SectionHeader,
  StatusPill,
  SurfaceCard,
} from '../../src/components/ui';
import { useCycleStore, useUserStore, useWellnessStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getCycleData } from '../../src/utils/cycleEngine';
import { fromLocalDateString, toLocalDateString } from '../../src/utils/date';
import { getDailyTip } from '../../src/utils/tips';

const COPY = {
  ru: {
    title: 'Забота о себе', subtitle: 'Небольшие действия, которые помогают лучше понимать своё состояние.',
    today: 'Сегодня', energy: 'Энергия', water: 'Вода', sleep: 'Сон', glasses: 'стак.', hours: 'ч',
    plan: 'Твой план на день', edit: 'Отметить состояние', assistant: 'Справочник LOUSA', assistantText: 'Задай вопрос о самочувствии, цикле или подготовке к менструации.', ask: 'Открыть помощника',
    insights: 'Наблюдения', analytics: 'Посмотреть аналитику', cycleUncertain: 'День цикла не подтверждён', uncertainTip: 'Прогнозное окно прошло. Ориентируйтесь на реальное самочувствие и уточните запись в календаре.', privacy: 'Твои личные записи остаются приватными и не передаются курьеру.',
    tasks: { hydrate: 'Выпей ещё один стакан воды', rest: 'Оставь время на восстановление', move: 'Добавь мягкую активность', note: 'Запиши изменение самочувствия' },
  },
  en: {
    title: 'Self-care', subtitle: 'Small actions that help you understand how you feel.',
    today: 'Today', energy: 'Energy', water: 'Water', sleep: 'Sleep', glasses: 'glasses', hours: 'h',
    plan: 'Your plan for today', edit: 'Log how you feel', assistant: 'LOUSA guide', assistantText: 'Ask about wellbeing, your cycle or preparing for your period.', ask: 'Open assistant',
    insights: 'Insights', analytics: 'View analytics', cycleUncertain: 'Cycle day not confirmed', uncertainTip: 'The forecast window passed. Follow how you actually feel and update the calendar when ready.', privacy: 'Your private check-ins are never shared with the courier.',
    tasks: { hydrate: 'Drink one more glass of water', rest: 'Leave room for recovery', move: 'Add gentle movement', note: 'Log any change in how you feel' },
  },
  hy: {
    title: 'Ինքնախնամք', subtitle: 'Փոքր գործողություններ, որոնք օգնում են ավելի լավ հասկանալ ինքնազգացողությունը։',
    today: 'Այսօր', energy: 'Էներգիա', water: 'Ջուր', sleep: 'Քուն', glasses: 'բաժակ', hours: 'ժ',
    plan: 'Քո այսօրվա պլանը', edit: 'Նշել ինքնազգացողությունը', assistant: 'LOUSA տեղեկատու', assistantText: 'Հարցրու ինքնազգացողության, ցիկլի կամ դաշտանին պատրաստվելու մասին։', ask: 'Բացել օգնականը',
    insights: 'Դիտարկումներ', analytics: 'Դիտել վերլուծությունը', cycleUncertain: 'Ցիկլի օրը հաստատված չէ', uncertainTip: 'Կանխատեսվող շրջանն անցել է։ Կողմնորոշվեք իրական ինքնազգացողությամբ և ճշտեք օրացույցը։', privacy: 'Քո անձնական գրառումները երբեք չեն փոխանցվում առաքիչին։',
    tasks: { hydrate: 'Խմիր ևս մեկ բաժակ ջուր', rest: 'Ժամանակ թող վերականգնման համար', move: 'Ավելացրու մեղմ շարժում', note: 'Նշիր ինքնազգացողության փոփոխությունը' },
  },
} as const;

function MiniMetric({ icon, label, value, tone, onPress, style }: { icon: string; label: string; value: string; tone: 'rose' | 'lavender' | 'neutral'; onPress: () => void; style?: any }) {
  const { colors } = useTheme();
  return (
    <PressScale onPress={onPress} style={[styles.metricPress, style]} accessibilityLabel={`${label}: ${value}`}>
      <SurfaceCard padding={14} style={styles.metricCard}>
        <IconBubble icon={icon} tone={tone} size={38} />
        <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
        <Text style={[styles.metricValue, { color: colors.onBackground }]}>{value}</Text>
      </SurfaceCard>
    </PressScale>
  );
}

export default function WellnessScreen() {
  const { colors, isDark } = useTheme();
  const { compactWidth } = useResponsiveLayout();
  const language = useUserStore((s) => s.language);
  const copy = COPY[language] || COPY.ru;
  const cycleStore = useCycleStore();
  const wellness = useWellnessStore();
  const todayLog = wellness.todayLog();

  const cycle = useMemo(
    () => getCycleData(
      cycleStore.lastPeriodStart ? fromLocalDateString(cycleStore.lastPeriodStart) : null,
      cycleStore.avgCycleLength,
      cycleStore.avgPeriodLength,
      new Date(),
      cycleStore.periodHistory.length,
      cycleStore.periodRecords,
      { cycleContext: cycleStore.onboardingProfile.cycleContext, factors: cycleStore.onboardingProfile.factors }
    ),
    [cycleStore.lastPeriodStart, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, cycleStore.periodHistory.length, cycleStore.periodRecords, cycleStore.onboardingProfile.cycleContext, cycleStore.onboardingProfile.factors]
  );
  const tip = useMemo(
    () => cycle.isCyclePositionKnown ? getDailyTip(cycle.phase, cycle.currentDay, language) : copy.uncertainTip,
    [cycle.isCyclePositionKnown, cycle.phase, cycle.currentDay, language, copy.uncertainTip],
  );

  const lastSeven = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = toLocalDateString(date);
      const log = wellness.dailyLogs[key];
      return { key, energy: log?.energy ?? 0, hasLog: Boolean(log) };
    });
  }, [wellness.dailyLogs]);

  const loggedDays = lastSeven.filter((item) => item.hasLog).length;

  const tasks = [
    { icon: 'water_drop', label: copy.tasks.hydrate, done: todayLog.water >= 6 },
    { icon: 'bedtime', label: copy.tasks.rest, done: todayLog.sleep >= 7 },
    { icon: 'directions_walk', label: copy.tasks.move, done: todayLog.energy >= 4 },
    { icon: 'edit_note', label: copy.tasks.note, done: Boolean(todayLog.notes || todayLog.mood) },
  ];

  return (
    <TabbedScreen backgroundVariant={isDark ? 'cosmic' : 'liquid'}>
      <ScreenScroll tabbed contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={styles.header}>
          <Text style={[styles.title, { color: colors.onBackground }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{copy.subtitle}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(240).delay(30).reduceMotion(ReduceMotion.System)} style={styles.heroCard}>
          <SurfaceCard padding={20} tone="accent">
            <View style={styles.heroTop}>
              <IconBubble icon="spa" tone="rose" size={46} />
              <StatusPill tone={cycle.isCyclePositionKnown ? "rose" : "neutral"} label={cycle.isCyclePositionKnown ? `${copy.today} · ${cycle.currentDay}` : copy.cycleUncertain} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.onBackground }]} numberOfLines={4}>{tip}</Text>
            <PressScale onPress={() => router.push('/screens/wellness-log' as any)} style={styles.heroAction}>
              <Text style={styles.heroActionText}>{copy.edit}</Text>
              <MaterialSymbol name="arrow_forward" size={18} color="#FFFFFF" />
            </PressScale>
          </SurfaceCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(55).reduceMotion(ReduceMotion.System)} style={styles.metricsRow}>
          <MiniMetric style={compactWidth ? styles.metricHalf : undefined} icon="bolt" label={copy.energy} value={`${todayLog.energy}/5`} tone="rose" onPress={() => router.push('/screens/wellness-log' as any)} />
          <MiniMetric style={compactWidth ? styles.metricHalf : undefined} icon="water_drop" label={copy.water} value={`${todayLog.water} ${copy.glasses}`} tone="lavender" onPress={() => wellness.addWater(toLocalDateString())} />
          <MiniMetric style={compactWidth ? styles.metricWide : undefined} icon="bedtime" label={copy.sleep} value={`${todayLog.sleep} ${copy.hours}`} tone="neutral" onPress={() => router.push('/screens/wellness-log' as any)} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(85).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <SectionHeader title={copy.plan} actionLabel={copy.edit} onAction={() => router.push('/screens/wellness-log' as any)} />
          <SurfaceCard padding={4}>
            {tasks.map((task, index) => (
              <PressScale
                key={task.label}
                onPress={() => router.push('/screens/wellness-log' as any)}
                style={[
                  styles.taskRow,
                  index > 0 && { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : LousaPalette.line, borderTopWidth: 1 },
                ]}
              >
                <IconBubble icon={task.icon} tone={task.done ? 'rose' : 'neutral'} size={40} />
                <Text style={[styles.taskText, { color: task.done ? colors.onSurfaceVariant : colors.onBackground }]}>{task.label}</Text>
                <View style={[
                  styles.taskCheck,
                  {
                    backgroundColor: task.done ? (isDark ? '#4B755E' : LousaPalette.successSoft) : 'transparent',
                    borderColor: task.done ? (isDark ? '#77A78C' : LousaPalette.success) : colors.outlineVariant,
                  },
                ]}>
                  {task.done ? <MaterialSymbol name="check" size={15} color={isDark ? '#CDE8D8' : LousaPalette.success} /> : null}
                </View>
              </PressScale>
            ))}
          </SurfaceCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(105).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <SectionHeader title={copy.insights} actionLabel={copy.analytics} onAction={() => router.push('/screens/analytics')} />
          <SurfaceCard padding={20}>
            <View style={styles.chartTop}>
              <View>
                <Text style={[styles.chartTitle, { color: colors.onBackground }]}>{language === 'en' ? 'Energy over 7 days' : language === 'hy' ? 'Էներգիան՝ 7 օրվա ընթացքում' : 'Энергия за 7 дней'}</Text>
                <Text style={[styles.chartMeta, { color: colors.onSurfaceVariant }]}>{language === 'en' ? 'Only logged days are shown' : language === 'hy' ? 'Ցուցադրվում են միայն նշված օրերը' : 'Показываются только заполненные дни'}</Text>
              </View>
              <IconBubble icon="monitoring" tone="lavender" />
            </View>
            {loggedDays < 3 ? (
              <View style={styles.emptyInsight}>
                <Image source={require('../../assets/images/states/empty-analytics.png')} style={styles.emptyIllustration} resizeMode="contain" accessible={false} />
                <Text style={[styles.emptyInsightTitle, { color: colors.onBackground }]}>{language === 'en' ? 'Not enough data yet' : language === 'hy' ? 'Տվյալները դեռ բավարար չեն' : 'Пока недостаточно данных'}</Text>
                <Text style={[styles.emptyInsightText, { color: colors.onSurfaceVariant }]}>{language === 'en' ? 'Complete a few more daily check-ins to see your energy pattern.' : language === 'hy' ? 'Լրացրու ևս մի քանի օր՝ էներգիայի դինամիկան տեսնելու համար։' : 'Заполни дневник ещё несколько дней, чтобы увидеть динамику энергии.'}</Text>
              </View>
            ) : (
              <View style={styles.chart}>
                {lastSeven.map((item) => (
                  <View key={item.key} style={styles.barColumn}>
                    <View style={[styles.barTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2EDF1' }]}>
                      <View style={[styles.barFill, { height: `${Math.max(item.hasLog ? 12 : 4, item.energy * 20)}%`, backgroundColor: item.hasLog ? (isDark ? '#D8A3B8' : LousaPalette.rose) : (isDark ? '#4A444F' : '#DED6DB') }]} />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.outline }]}>{fromLocalDateString(item.key).toLocaleDateString(language === 'en' ? 'en-US' : language === 'hy' ? 'hy-AM' : 'ru-RU', { weekday: 'short' }).slice(0, 2)}</Text>
                  </View>
                ))}
              </View>
            )}
          </SurfaceCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(120).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <SectionHeader title={copy.assistant} />
          <SurfaceCard padding={20} tone="accent">
            <View style={styles.assistantTop}>
              <IconBubble icon="auto_awesome" tone="rose" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.assistantTitle, { color: colors.onBackground }]}>{copy.assistant}</Text>
                <Text style={[styles.assistantText, { color: colors.onSurfaceVariant }]}>{copy.assistantText}</Text>
              </View>
            </View>
            <PrimaryButton label={copy.ask} icon="chat" onPress={() => router.push('/screens/help-assistant')} />
          </SurfaceCard>
        </Animated.View>

        <SurfaceCard padding={15} tone="flat" style={styles.privacyRow}>
          <MaterialSymbol name="lock" size={18} color={colors.onSurfaceVariant} />
          <Text style={[styles.privacyText, { color: colors.onSurfaceVariant }]}>{copy.privacy}</Text>
        </SurfaceCard>

      </ScreenScroll>
    </TabbedScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  header: { marginTop: 4, marginBottom: 18 },
  title: { fontFamily: 'serif', fontSize: 32, lineHeight: 37 },
  subtitle: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 20, marginTop: 7 },
  heroCard: { marginBottom: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroTitle: { fontFamily: 'serif', fontSize: 23, lineHeight: 28, marginTop: 10 },
  heroAction: { marginTop: 16, minHeight: 48, borderRadius: 22, paddingHorizontal: 16, backgroundColor: LousaPalette.berry, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroActionText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 12 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  metricPress: { flexGrow: 1, flexBasis: '31%' },
  metricHalf: { flexBasis: '47%' },
  metricWide: { flexBasis: '100%' },
  metricCard: { minHeight: 122 },
  metricLabel: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 10 },
  metricValue: { fontFamily: 'sans-serif-medium', fontSize: 14, marginTop: 3 },
  section: { marginBottom: 28 },
  taskRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  taskText: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 13, lineHeight: 18 },
  taskCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chartTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chartTitle: { fontFamily: 'sans-serif-medium', fontSize: 15 },
  chartMeta: { fontFamily: 'sans-serif', fontSize: 12, marginTop: 2 },
  emptyInsight: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 12 },
  emptyIllustration: { width: 112, height: 112 },
  emptyInsightTitle: { fontFamily: 'sans-serif-medium', fontSize: 15, marginTop: 12, textAlign: 'center' },
  emptyInsightText: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center', maxWidth: 300 },
  chart: { height: 146, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 18 },
  barColumn: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '100%', maxWidth: 24, height: 112, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 12 },
  barLabel: { fontFamily: 'sans-serif-medium', fontSize: 12, textTransform: 'uppercase' },
  assistantTop: { flexDirection: 'row', gap: 13, alignItems: 'flex-start', marginBottom: 18 },
  assistantTitle: { fontFamily: 'sans-serif-medium', fontSize: 16 },
  assistantText: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 18, marginTop: 3 },
  privacyRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 6 },
  privacyText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16 },
});
