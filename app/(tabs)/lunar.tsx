import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ScreenScroll, TabbedScreen } from '../../src/components/layout';
import { RealisticMoon } from '../../src/components/RealisticMoon';
import {
  IconBubble,
  PressScale,
  SectionHeader,
  StatusPill,
  SurfaceCard,
} from '../../src/components/ui';
import { useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getMoonPhase, getMoonPhaseLabel, MoonPhaseName } from '../../src/utils/moonPhase';

const COPY = {
  ru: {
    title: 'Луна сегодня', subtitle: 'Наблюдай фазу, свет и ритм месяца. Лунные подсказки — это инструмент саморефлексии, а не медицинский прогноз.',
    illumination: 'Освещение', age: 'Возраст Луны', nextFull: 'До полнолуния', nextNew: 'До новолуния', days: 'дн.',
    calendar: 'Лунный календарь', selected: 'Выбранный день', reflection: 'Ритуал самонаблюдения',
    prompts: {
      new_moon: 'Запиши одно намерение на новый цикл и один маленький шаг, который можешь сделать сегодня.',
      waxing_crescent: 'Заметь, что начинает набирать силу. Поддержи это небольшим действием.',
      first_quarter: 'Спроси себя: какое решение я откладываю и что поможет принять его спокойнее?',
      waxing_gibbous: 'Посмотри, что уже работает, и убери одну лишнюю деталь.',
      full_moon: 'Подведи мягкий итог: за что ты благодарна и что готова отпустить?',
      waning_gibbous: 'Поделись опытом или поблагодари себя за пройденный путь.',
      last_quarter: 'Освободи место: отмени одно необязательное дело или наведи порядок.',
      waning_crescent: 'Дай себе больше тишины, сна и восстановления перед новым циклом.',
    },
  },
  en: {
    title: 'The Moon today', subtitle: 'Observe the phase, light and monthly rhythm. Lunar guidance is for reflection, not medical prediction.',
    illumination: 'Illumination', age: 'Moon age', nextFull: 'Until full moon', nextNew: 'Until new moon', days: 'days',
    calendar: 'Lunar calendar', selected: 'Selected day', reflection: 'Reflection ritual',
    prompts: {
      new_moon: 'Write one intention for the new cycle and one small step you can take today.',
      waxing_crescent: 'Notice what is beginning to grow and support it with one small action.',
      first_quarter: 'Ask yourself which decision you are postponing and what could make it easier.',
      waxing_gibbous: 'Notice what already works and remove one unnecessary detail.',
      full_moon: 'Reflect gently: what are you grateful for and what are you ready to release?',
      waning_gibbous: 'Share something useful or thank yourself for the path you have completed.',
      last_quarter: 'Create space by cancelling one nonessential task or clearing a small area.',
      waning_crescent: 'Give yourself more quiet, sleep and recovery before the next cycle.',
    },
  },
  hy: {
    title: 'Լուսինն այսօր', subtitle: 'Դիտիր փուլը, լույսն ու ամսվա ռիթմը։ Լուսնային հուշումները ինքնադիտարկման համար են, ոչ բժշկական կանխատեսում։',
    illumination: 'Լուսավորում', age: 'Լուսնի տարիք', nextFull: 'Մինչև լիալուսին', nextNew: 'Մինչև նորալուսին', days: 'օր',
    calendar: 'Լուսնային օրացույց', selected: 'Ընտրված օրը', reflection: 'Ինքնադիտարկման արարողություն',
    prompts: {
      new_moon: 'Գրիր մեկ մտադրություն նոր ցիկլի համար և մեկ փոքր քայլ՝ այսօր կատարելու համար։',
      waxing_crescent: 'Նկատիր, թե ինչն է սկսում աճել, և աջակցիր դրան փոքր գործողությամբ։',
      first_quarter: 'Հարցրու քեզ՝ որ որոշումն ես հետաձգում և ինչը կօգնի այն ընդունել հանգիստ։',
      waxing_gibbous: 'Նկատիր, թե ինչն արդեն աշխատում է, և հեռացրու մեկ ավելորդ մանրուք։',
      full_moon: 'Ամփոփիր մեղմորեն՝ ինչի համար ես շնորհակալ և ինչն ես պատրաստ բաց թողնել։',
      waning_gibbous: 'Կիսվիր փորձով կամ շնորհակալություն հայտնիր ինքդ քեզ անցած ճանապարհի համար։',
      last_quarter: 'Ազատիր տարածք՝ չեղարկելով մեկ ոչ պարտադիր գործ կամ կարգի բերելով փոքր հատված։',
      waning_crescent: 'Տուր քեզ ավելի շատ լռություն, քուն և վերականգնում նոր ցիկլից առաջ։',
    },
  },
} as const;

function MiniMoonPhase({ illumination, phase }: { illumination: number; phase: MoonPhaseName; isDark: boolean }) {
  return <RealisticMoon size={16} illumination={illumination} phase={phase} showGlow={false} showBorder={false} />;
}

export default function LunarScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((s) => s.language);
  const copy = COPY[language] || COPY.ru;
  const locale = language === 'en' ? 'en-US' : language === 'hy' ? 'hy-AM' : 'ru-RU';

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12));
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const moon = useMemo(() => getMoonPhase(selectedDate), [selectedDate]);

  const calendar = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    return {
      year,
      month,
      offset: mondayOffset,
      entries: Array.from({ length: days }, (_, index) => {
        const date = new Date(year, month, index + 1, 12);
        return { date, moon: getMoonPhase(date) };
      }),
    };
  }, [monthCursor]);

  const weekdayLabels = language === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : language === 'hy' ? ['Երկ', 'Երք', 'Չրք', 'Հնգ', 'Ուրբ', 'Շբթ', 'Կիր'] : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const changeMonth = (delta: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  };

  const selectedKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  return (
    <TabbedScreen backgroundVariant={isDark ? 'cosmic' : 'minimal'}>
      <ScreenScroll tabbed contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={styles.header}>
          <Text style={[styles.title, { color: colors.onBackground }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{copy.subtitle}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(280).delay(30).reduceMotion(ReduceMotion.System)} style={styles.heroNight}>
          <View style={styles.starsA} />
          <View style={styles.starsB} />
          <RealisticMoon size={158} illumination={moon.illumination} phase={moon.phase} glowColor="rgba(207,188,235,0.18)" />
          <Text style={styles.phaseTitle}>{getMoonPhaseLabel(moon.phase, language)}</Text>
          <Text style={styles.dateLabel}>{selectedDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          <Text style={styles.moonMeta}>{copy.illumination}: {Math.round(moon.illumination * 100)}% · {copy.age}: {moon.age.toFixed(1)} {copy.days}</Text>
          <StatusPill tone="night" icon="brightness_2" label={`${Math.round(moon.illumination * 100)}%`} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(60).reduceMotion(ReduceMotion.System)} style={styles.statsGrid}>
          {[
            [copy.nextFull, `${moon.daysUntilFull.toFixed(1)} ${copy.days}`, 'brightness_7'],
            [copy.nextNew, `${moon.daysUntilNew.toFixed(1)} ${copy.days}`, 'dark_mode'],
          ].map(([label, value, icon]) => (
            <SurfaceCard key={label} padding={15} style={styles.statCard}>
              <IconBubble icon={icon} tone="lavender" size={38} />
              <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
              <Text style={[styles.statValue, { color: colors.onBackground }]}>{value}</Text>
            </SurfaceCard>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(90).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <SectionHeader title={copy.calendar} />
          <SurfaceCard padding={18}>
            <View style={styles.calendarHeader}>
              <PressScale onPress={() => changeMonth(-1)} style={styles.monthArrow}>
                <MaterialSymbol name="chevron_left" size={23} color={colors.onSurfaceVariant} />
              </PressScale>
              <Text style={[styles.monthTitle, { color: colors.onBackground }]}>{monthCursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</Text>
              <PressScale onPress={() => changeMonth(1)} style={styles.monthArrow}>
                <MaterialSymbol name="chevron_right" size={23} color={colors.onSurfaceVariant} />
              </PressScale>
            </View>

            <View style={styles.weekRow}>
              {weekdayLabels.map((day) => <Text key={day} style={[styles.weekday, { color: colors.outline }]}>{day}</Text>)}
            </View>

            <View style={styles.calendarGrid}>
              {Array.from({ length: calendar.offset }).map((_, index) => <View key={`empty-${index}`} style={styles.dayCell} />)}
              {calendar.entries.map(({ date, moon: dayMoon }) => {
                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                const selected = key === selectedKey;
                const isToday = key === todayKey;
                return (
                  <PressScale key={key} onPress={() => setSelectedDate(date)} style={styles.dayCell} haptic={false}>
                    <View style={[
                      styles.dayInner,
                      selected && { backgroundColor: isDark ? 'rgba(217,133,165,0.22)' : '#F8E7ED' },
                      isToday && !selected && { borderColor: isDark ? '#9F8592' : LousaPalette.rose, borderWidth: 1 },
                    ]}>
                      <Text style={[styles.dayNumber, { color: selected ? (isDark ? '#F4DDE6' : LousaPalette.berry) : colors.onBackground }]}>{date.getDate()}</Text>
                      <MiniMoonPhase illumination={dayMoon.illumination} phase={dayMoon.phase} isDark={isDark} />
                    </View>
                  </PressScale>
                );
              })}
            </View>
          </SurfaceCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(115).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <SectionHeader title={copy.reflection} eyebrow={copy.selected} />
          <SurfaceCard padding={20} tone="accent">
            <View style={styles.ritualTop}>
              <IconBubble icon="edit_note" tone="rose" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ritualPhase, { color: colors.onBackground }]}>{getMoonPhaseLabel(moon.phase, language)}</Text>
                <Text style={[styles.ritualMeta, { color: colors.onSurfaceVariant }]}>{Math.round(moon.illumination * 100)}% · {moon.age.toFixed(1)} {copy.days}</Text>
              </View>
            </View>
            <Text style={[styles.ritualText, { color: colors.onBackground }]}>{copy.prompts[moon.phase]}</Text>
            <View style={[styles.noteRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : LousaPalette.line }]}>
              <MaterialSymbol name="info" size={16} color={colors.onSurfaceVariant} />
              <Text style={[styles.noteText, { color: colors.onSurfaceVariant }]}>{copy.subtitle}</Text>
            </View>
          </SurfaceCard>
        </Animated.View>

      </ScreenScroll>
    </TabbedScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  header: { marginTop: 4, marginBottom: 18 },
  title: { fontFamily: 'serif', fontSize: 32, lineHeight: 37 },
  subtitle: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 20, marginTop: 7 },
  heroNight: { minHeight: 286, borderRadius: 30, backgroundColor: '#17131D', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 14, paddingVertical: 28, shadowColor: '#17111E', shadowOpacity: 0.26, shadowRadius: 32, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  starsA: { position: 'absolute', left: 38, top: 54, width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.72)', shadowColor: '#fff', shadowOpacity: 0.8, shadowRadius: 4 },
  starsB: { position: 'absolute', right: 48, top: 82, width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.55)', shadowColor: '#fff', shadowOpacity: 0.8, shadowRadius: 4 },
  phaseTitle: { color: '#FFFDFE', fontFamily: 'serif', fontSize: 25, lineHeight: 30, marginTop: -2 },
  dateLabel: { color: 'rgba(255,255,255,0.72)', fontFamily: 'sans-serif', fontSize: 12, marginTop: 3 },
  moonMeta: { color: 'rgba(255,255,255,0.58)', fontFamily: 'sans-serif', fontSize: 12, marginTop: 4, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  statCard: { width: '48.5%', minHeight: 116 },
  statLabel: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 10 },
  statValue: { fontFamily: 'sans-serif-medium', fontSize: 15, marginTop: 3 },
  section: { marginBottom: 28 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthArrow: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: 'serif', fontSize: 21, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 7 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 0.98, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 40, height: 44, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNumber: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  miniMoon: { width: 14, height: 14, borderRadius: 7, overflow: 'hidden' },
  miniMoonShadow: { position: 'absolute', top: 0, bottom: 0 },
  ritualTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  ritualPhase: { fontFamily: 'sans-serif-medium', fontSize: 15 },
  ritualMeta: { fontFamily: 'sans-serif', fontSize: 12, marginTop: 2 },
  ritualText: { fontFamily: 'sans-serif-medium', fontSize: 16, lineHeight: 24, marginTop: 18 },
  noteRow: { borderTopWidth: 1, marginTop: 18, paddingTop: 14, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  noteText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16 },
});
