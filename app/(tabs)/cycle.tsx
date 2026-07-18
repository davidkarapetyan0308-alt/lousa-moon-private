import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ScreenScroll, TabbedScreen, useResponsiveLayout } from '../../src/components/layout';
import {
  IconBubble,
  PressScale,
  PrimaryAction,
  SectionHeader,
  StatusPill,
  SurfaceCard,
} from '../../src/components/ui';
import {
  useCycleStore,
  useUserStore,
  useWellnessStore,
} from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getCalendarMonth, getCycleData } from '../../src/utils/cycleEngine';
import { formatHumanDate, fromLocalDateString, toLocalDateString } from '../../src/utils/date';
import { getMoonPhase } from '../../src/utils/moonPhase';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import { enqueueCycleSync, flushCycleSyncQueue, type CycleSyncOperation } from '../../src/services/cycleSync';
import { buildCycleSyncDiff } from '../../src/services/cycleSyncDiff';
import { getServiceMode } from '../../src/services';
import type { CycleObservationType } from '../../src/domain/models';
import { getDailyTip } from '../../src/utils/tips';
import { MOOD_ITEMS as MOODS, MOOD_LABELS, SYMPTOM_ITEMS as SYMPTOMS, SYMPTOM_LABELS } from '../../src/data/wellnessCatalog';

const LABELS = {
  ru: {
    title: 'Календарь цикла', subtitle: 'Здесь появятся подтверждённые даты и осторожные прогнозы LOUSA.',
    weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    period: 'Подтверждено', predictedPeriod: 'Прогноз', fertile: 'Фертильное окно', ovulation: 'Предполагаемая овуляция', predicted: 'Прогноз', range: 'Ожидаемый диапазон',
    selected: 'День в календаре', cycleDay: 'день цикла', moon: 'Луна', advice: 'Подсказка на день',
    checkIn: 'Самочувствие', mood: 'Настроение', symptoms: 'Симптомы', note: 'Личная заметка', notePlaceholder: 'Что важно запомнить об этом дне?',
    save: 'Сохранить запись', saved: 'Запись сохранена', markPeriod: 'Отметить начало', marked: 'Начало менструации отмечено', endPeriod: 'Закончить менструацию', periodEnded: 'Окончание отмечено', removePeriod: 'Удалить запись периода', removeTitle: 'Удалить период?', removeText: 'Подтверждённая запись и её интенсивность будут удалены.', cancel: 'Отмена', removeConfirm: 'Удалить',
    medical: 'Это календарная оценка, не медицинское подтверждение. Не используйте её как метод контрацепции.', reviewLegacy: 'Проверить перенесённые даты', addPeriod: 'Отметить начало', high: 'Высокая точность', medium: 'Средняя точность', preliminary: 'Предварительный прогноз',
    editDay: 'Изменить запись дня', whatHappened: 'Что произошло в этот день?', periodStart: 'Начались месячные', periodDay: 'Это день месячных', periodEnd: 'Месячные закончились', spotting: 'Небольшие выделения', noBleeding: 'Кровотечения не было', deleteDay: 'Удалить запись', undo: 'Отменить последнее изменение', forecastPassed: 'Прогнозируемое окно прошло', forecastPassedBody: 'Если месячные ещё не начались, ничего подтверждать не нужно. Отметьте это — LOUSA снизит уверенность и пересчитает диапазон.', howRead: 'Как читать календарь', factVsForecast: 'Сплошная розовая метка — ваша подтверждённая запись. Пунктир — только прогноз, он не запускает цикл автоматически.', confirmedByYou: 'Подтверждено вами', forecastOnly: 'Только прогноз', noFact: 'Нет подтверждённой записи', calendarEstimate: 'Фаза рассчитана по календарю и может измениться после новой записи.', syncPending: 'Сохранено на телефоне. Синхронизация с аккаунтом продолжится при доступном сервере.', deleteImpactTitle: 'Проверить удаление', deleteImpactOne: 'Будет удалена запись только за этот день. Прогноз обновится.', deleteImpactPeriod: (days: number) => `Эта дата относится к подтверждённому периоду из ${days} дн. Изменение может повлиять на связанные дни и прогноз.`,
    positionUnknown: 'Фаза этого дня не подтверждена', positionUnknownBody: 'LOUSA не повторяет цикл по кругу без новой даты начала. Отметьте факт или оставьте день без записи.',
    phases: { menstrual: 'Менструальная фаза', follicular: 'Фолликулярное окно', ovulation: 'Овуляция', luteal: 'Лютеиновая фаза' },
  },
  en: {
    title: 'Cycle calendar', subtitle: 'Confirmed dates and cautious LOUSA forecasts will appear here.',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    period: 'Confirmed', predictedPeriod: 'Prediction', fertile: 'Fertile window', ovulation: 'Estimated ovulation', predicted: 'Prediction', range: 'Expected range',
    selected: 'Selected day', cycleDay: 'cycle day', moon: 'Moon', advice: 'Guidance for this day',
    checkIn: 'How you feel', mood: 'Mood', symptoms: 'Symptoms', note: 'Personal note', notePlaceholder: 'What would you like to remember about this day?',
    save: 'Save check-in', saved: 'Check-in saved', markPeriod: 'Mark period start', marked: 'Period start marked', endPeriod: 'Mark period end', periodEnded: 'Period end saved', removePeriod: 'Delete period record', removeTitle: 'Delete this period?', removeText: 'The confirmed record and flow data will be removed.', cancel: 'Cancel', removeConfirm: 'Delete',
    medical: 'This forecast is approximate and is not suitable for diagnosis or contraception.', reviewLegacy: 'Review imported dates', addPeriod: 'Mark start', high: 'High confidence', medium: 'Medium confidence', preliminary: 'Early prediction',
    editDay: 'Edit day record', whatHappened: 'What happened on this day?', periodStart: 'Period started', periodDay: 'This was a period day', periodEnd: 'Period ended', spotting: 'Light spotting', noBleeding: 'No bleeding', deleteDay: 'Delete record', undo: 'Undo last change', forecastPassed: 'The predicted window has passed', forecastPassedBody: 'If your period has not started, you do not need to confirm anything. Record it and LOUSA will lower confidence and recalculate the range.', howRead: 'How to read the calendar', factVsForecast: 'Solid rose marks are your confirmed records. Dashed marks are predictions only and never start a cycle automatically.', confirmedByYou: 'Confirmed by you', forecastOnly: 'Prediction only', noFact: 'No confirmed record', calendarEstimate: 'This phase is a calendar estimate and may change after a new record.', syncPending: 'Saved on this phone. Account sync will continue when the server is available.', deleteImpactTitle: 'Review deletion', deleteImpactOne: 'Only this day record will be removed. The forecast will update.', deleteImpactPeriod: (days: number) => `This date belongs to a confirmed ${days}-day period. The change may affect linked days and the forecast.`,
    positionUnknown: 'The phase for this day is not confirmed', positionUnknownBody: 'LOUSA does not repeat cycles automatically without a new confirmed start. Record what happened or leave the day unmarked.',
    phases: { menstrual: 'Menstrual phase', follicular: 'Follicular phase', ovulation: 'Ovulation', luteal: 'Luteal phase' },
  },
  hy: {
    title: 'Ցիկլի օրացույց', subtitle: 'Այստեղ կհայտնվեն հաստատված ամսաթվերը և զգուշավոր կանխատեսումները։',
    weekdays: ['Երկ', 'Երք', 'Չրք', 'Հնգ', 'Ուրբ', 'Շբթ', 'Կիր'],
    period: 'Հաստատված', predictedPeriod: 'Կանխատեսում', fertile: 'Բեղմնավոր շրջան', ovulation: 'Ենթադրվող օվուլյացիա', predicted: 'Կանխատեսում', range: 'Սպասվող միջակայք',
    selected: 'Ընտրված օրը', cycleDay: 'ցիկլի օր', moon: 'Լուսին', advice: 'Օրվա հուշում',
    checkIn: 'Ինքնազգացողություն', mood: 'Տրամադրություն', symptoms: 'Ախտանիշներ', note: 'Անձնական նշում', notePlaceholder: 'Ի՞նչն է կարևոր հիշել այս օրվա մասին։',
    save: 'Պահպանել գրառումը', saved: 'Գրառումը պահպանվեց', markPeriod: 'Նշել դաշտանի սկիզբը', marked: 'Դաշտանի սկիզբը նշվեց', endPeriod: 'Նշել դաշտանի ավարտը', periodEnded: 'Ավարտը պահպանվեց', removePeriod: 'Ջնջել դաշտանի գրառումը', removeTitle: 'Ջնջե՞լ գրառումը', removeText: 'Հաստատված գրառումն ու ինտենսիվությունը կհեռացվեն։', cancel: 'Չեղարկել', removeConfirm: 'Ջնջել',
    medical: 'Կանխատեսումը մոտավոր է և նախատեսված չէ ախտորոշման կամ հակաբեղմնավորման համար։', reviewLegacy: 'Ստուգել տեղափոխված ամսաթվերը', addPeriod: 'Ավելացնել դաշտան', high: 'Բարձր ճշտություն', medium: 'Միջին ճշտություն', preliminary: 'Նախնական կանխատեսում',
    editDay: 'Փոխել օրվա գրառումը', whatHappened: 'Ի՞նչ է տեղի ունեցել այս օրը։', periodStart: 'Դաշտանը սկսվել է', periodDay: 'Դաշտանի օր է', periodEnd: 'Դաշտանն ավարտվել է', spotting: 'Թեթև արտադրություն', noBleeding: 'Արյունահոսություն չի եղել', deleteDay: 'Ջնջել գրառումը', undo: 'Չեղարկել վերջին փոփոխությունը', forecastPassed: 'Կանխատեսված շրջանն անցել է', forecastPassedBody: 'Եթե դաշտանը դեռ չի սկսվել, հաստատել ոչինչ պետք չէ։ Նշեք դա, և LOUSA-ն կվերահաշվարկի միջակայքը։', howRead: 'Ինչպես կարդալ օրացույցը', factVsForecast: 'Լցված վարդագույն նշումը ձեր հաստատված գրառումն է, կետագիծը՝ միայն կանխատեսում։ Այն ինքնուրույն չի սկսում ցիկլը։', confirmedByYou: 'Հաստատված է քո կողմից', forecastOnly: 'Միայն կանխատեսում', noFact: 'Հաստատված գրառում չկա', calendarEstimate: 'Փուլը օրացուցային գնահատում է և կարող է փոխվել նոր գրառումից հետո։', syncPending: 'Պահպանված է հեռախոսում։ Հաշվի համաժամացումը կշարունակվի սերվերի հասանելիության դեպքում։', deleteImpactTitle: 'Ստուգել ջնջումը', deleteImpactOne: 'Կջնջվի միայն այս օրվա գրառումը։ Կանխատեսումը կթարմացվի։', deleteImpactPeriod: (days: number) => `Այս ամսաթիվը ${days}-օրյա հաստատված շրջանի մաս է։ Փոփոխությունը կարող է ազդել կապված օրերի և կանխատեսման վրա։`,
    positionUnknown: 'Այս օրվա փուլը հաստատված չէ', positionUnknownBody: 'LOUSA-ն առանց նոր հաստատված սկզբի ցիկլը չի կրկնում։ Նշեք փաստը կամ օրը թողեք առանց գրառման։',
    phases: { menstrual: 'Դաշտանային փուլ', follicular: 'Ֆոլիկուլային փուլ', ovulation: 'Օվուլյացիա', luteal: 'Լյուտեինային փուլ' },
  },
} as const;

export default function CycleScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((s) => s.language);
  const labels = LABELS[language] || LABELS.ru;
  const moodLabels = MOOD_LABELS[language];
  const symptomLabels = SYMPTOM_LABELS[language];
  const locale = language === 'en' ? 'en-US' : language === 'hy' ? 'hy-AM' : 'ru-RU';
  const { width } = useWindowDimensions();
  const { horizontalPadding } = useResponsiveLayout();
  const daySize = Math.max(32, Math.min(42, Math.floor((Math.min(width, 620) - horizontalPadding * 2 - 54) / 7)));

  const cycleStore = useCycleStore();
  const wellness = useWellnessStore();
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [selectedDate, setSelectedDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12));
  const selectedDateString = toLocalDateString(selectedDate);
  const confirmedPeriods = useMemo(() => cycleStore.periodRecords.filter((record) => record.confirmed && !record.deletedAt && !record.needsReview), [cycleStore.periodRecords]);
  const hasCycleData = confirmedPeriods.length > 0;
  const currentLog = wellness.getLog(selectedDateString);
  const [notes, setNotes] = useState(currentLog.notes);
  const [toast, setToast] = useState('');
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const lastUndo = cycleStore.cycleEditHistory.some((snapshot) => Date.now() - new Date(snapshot.at).getTime() <= 24 * 60 * 60 * 1000);
  const notesDirty = notes !== currentLog.notes;

  useEffect(() => {
    setNotes(wellness.getLog(selectedDateString).notes);
  }, [selectedDateString, wellness]);

  const calendar = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    return {
      year,
      month,
      offset,
      days: getCalendarMonth(year, month, cycleStore.lastPeriodStart ? fromLocalDateString(cycleStore.lastPeriodStart) : null, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, cycleStore.periodRecords, { cycleContext: cycleStore.onboardingProfile.cycleContext, factors: cycleStore.onboardingProfile.factors }),
    };
  }, [monthCursor, cycleStore.lastPeriodStart, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, cycleStore.periodRecords, cycleStore.onboardingProfile.cycleContext, cycleStore.onboardingProfile.factors]);

  const cycleData = useMemo(
    () => getCycleData(
      cycleStore.lastPeriodStart ? fromLocalDateString(cycleStore.lastPeriodStart) : null,
      cycleStore.avgCycleLength,
      cycleStore.avgPeriodLength,
      selectedDate,
      cycleStore.periodHistory.length,
      cycleStore.periodRecords,
      { cycleContext: cycleStore.onboardingProfile.cycleContext, factors: cycleStore.onboardingProfile.factors }
    ),
    [cycleStore.lastPeriodStart, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, cycleStore.periodHistory.length, cycleStore.periodRecords, cycleStore.onboardingProfile.cycleContext, cycleStore.onboardingProfile.factors, selectedDate]
  );
  const moon = useMemo(() => getMoonPhase(selectedDate), [selectedDate]);
  const tip = useMemo(() => hasCycleData && cycleData.isCyclePositionKnown ? getDailyTip(cycleData.phase, cycleData.currentDay, language) : hasCycleData ? labels.positionUnknownBody : (language === 'en' ? 'Your first cycle note will unlock gentle calendar guidance.' : language === 'hy' ? 'Առաջին գրառումից հետո կհայտնվեն մեղմ օրացուցային հուշումներ։' : 'После первой записи здесь появятся мягкие календарные подсказки.'), [hasCycleData, cycleData.isCyclePositionKnown, cycleData.phase, cycleData.currentDay, language, labels.positionUnknownBody]);
  const selectedRecord = useMemo(() => cycleStore.periodRecords.find((record) => {
    const start = fromLocalDateString(record.startDate);
    const end = fromLocalDateString(record.endDate || record.startDate);
    return selectedDate >= start && selectedDate <= end || Boolean(record.flowByDay[selectedDateString]);
  }) || null, [cycleStore.periodRecords, selectedDate, selectedDateString]);
  const selectedObservation = useMemo(() => cycleStore.cycleObservations.find((item) => item.date === selectedDateString && !item.deletedAt) || null, [cycleStore.cycleObservations, selectedDateString]);
  const selectedCalendarDay = useMemo(() => calendar.days.find((day) => day.date === selectedDateString) || null, [calendar.days, selectedDateString]);
  const selectedTrustLabel = selectedObservation || selectedCalendarDay?.isConfirmedPeriod
    ? labels.confirmedByYou
    : (selectedCalendarDay?.isPredictedPeriod || selectedCalendarDay?.isFertile || selectedCalendarDay?.isOvulation)
      ? labels.forecastOnly
      : labels.noFact;

  const prediction = useMemo(() => calculateCyclePrediction(cycleStore.periodRecords, {
    fallbackCycleLength: cycleStore.avgCycleLength,
    fallbackPeriodLength: cycleStore.avgPeriodLength,
    cycleContext: cycleStore.onboardingProfile.cycleContext,
    factors: cycleStore.onboardingProfile.factors,
    negativeBleedingDates: cycleStore.cycleObservations.filter((item) => item.type === 'no_bleeding' && !item.deletedAt).map((item) => item.date),
  }), [cycleStore.periodRecords, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, cycleStore.onboardingProfile.cycleContext, cycleStore.onboardingProfile.factors, cycleStore.cycleObservations]);

  const selectDate = (dateString: string) => {
    const date = fromLocalDateString(dateString);
    setSelectedDate(date);
    setActionSheetOpen(true);
    Haptics.selectionAsync().catch(() => {});
  };

  const changeMonth = (delta: number) => {
    const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1, 12);
    setMonthCursor(next);
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    const clamped = Math.min(selectedDate.getDate(), maxDay);
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), clamped, 12));
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  };

  const save = () => {
    wellness.setNotes(selectedDateString, notes.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showToast(labels.saved);
  };

  const syncCycleOperations = (operations: CycleSyncOperation[]) => {
    if (getServiceMode() !== 'api' || !operations.length) return;
    void enqueueCycleSync(operations)
      .then(() => flushCycleSyncQueue())
      .then((result) => { if (result.failed) showToast(labels.syncPending); })
      .catch(() => showToast(labels.syncPending));
  };

  useEffect(() => {
    if (getServiceMode() !== 'api') return;
    void flushCycleSyncQueue().catch(() => null);
  }, []);

  const snapshotCycleState = () => {
    const state = useCycleStore.getState();
    return {
      periodRecords: state.periodRecords.map((item) => ({
        ...item,
        flowByDay: { ...item.flowByDay },
        painByDay: item.painByDay ? { ...item.painByDay } : undefined,
        productsUsedByDay: item.productsUsedByDay ? { ...item.productsUsedByDay } : undefined,
        nightLeakageByDay: item.nightLeakageByDay ? { ...item.nightLeakageByDay } : undefined,
        symptomsByDay: item.symptomsByDay ? { ...item.symptomsByDay } : undefined,
        notesByDay: item.notesByDay ? { ...item.notesByDay } : undefined,
      })),
      cycleObservations: state.cycleObservations.map((item) => ({ ...item })),
    };
  };

  const applyCycleObservation = (type: CycleObservationType) => {
    const before = snapshotCycleState();
    cycleStore.applyCycleDayObservation(selectedDateString, type, currentLog.flow || 'medium');
    const after = snapshotCycleState();
    syncCycleOperations(buildCycleSyncDiff(before, after));
    setActionSheetOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showToast(type === 'no_bleeding' ? labels.noBleeding : labels.saved);
  };

  const confirmRemoveSelectedCycleEntry = () => {
    const recordDays = selectedRecord
      ? Math.max(1, Math.round((fromLocalDateString(selectedRecord.endDate || selectedRecord.startDate).getTime() - fromLocalDateString(selectedRecord.startDate).getTime()) / 86_400_000) + 1)
      : 1;
    Alert.alert(
      labels.deleteImpactTitle,
      selectedRecord ? labels.deleteImpactPeriod(recordDays) : labels.deleteImpactOne,
      [
        { text: labels.cancel, style: 'cancel' },
        {
          text: labels.removeConfirm,
          style: 'destructive',
          onPress: () => {
            const before = snapshotCycleState();
            cycleStore.removeCycleDayEntry(selectedDateString);
            const after = snapshotCycleState();
            syncCycleOperations(buildCycleSyncDiff(before, after));
                    setActionSheetOpen(false);
            showToast(labels.saved);
          },
        },
      ],
    );
  };

  const undoLastChange = () => {
    const before = useCycleStore.getState();
    const beforeSnapshot = {
      periodRecords: before.periodRecords.map((item) => ({ ...item, flowByDay: { ...item.flowByDay } })),
      cycleObservations: before.cycleObservations.map((item) => ({ ...item })),
    };
    cycleStore.undoLastCycleEdit();
    const after = useCycleStore.getState();
    const operations = buildCycleSyncDiff(beforeSnapshot, {
      periodRecords: after.periodRecords,
      cycleObservations: after.cycleObservations,
    });
    syncCycleOperations(operations);
    showToast(labels.saved);
  };

  const todayString = toLocalDateString(today);

  return (
    <TabbedScreen backgroundVariant={isDark ? 'cosmic' : 'minimal'}>
      <ScreenScroll tabbed contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)} style={styles.header}>
          <Text style={[styles.title, { color: colors.onBackground }]}>{labels.title}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{labels.subtitle}</Text>
        </Animated.View>

        <View style={styles.quickActions}>
          <PressScale
            onPress={() => router.push({ pathname: '/screens/period-editor', params: { date: selectedDateString } })}
            style={[styles.quickAction, { backgroundColor: isDark ? 'rgba(166,77,114,0.18)' : '#F8E7ED', borderColor: isDark ? 'rgba(217,133,165,0.30)' : LousaPalette.rose }]}
          >
            <MaterialSymbol name="add" size={19} color={isDark ? '#F1B7CD' : LousaPalette.berry} />
            <Text style={[styles.quickActionText, { color: isDark ? '#F1B7CD' : LousaPalette.berry }]}>{labels.addPeriod}</Text>
          </PressScale>
          {cycleStore.migrationReviewRequired ? (
            <PressScale
              onPress={() => router.push('/screens/period-review')}
              style={[styles.quickAction, { backgroundColor: isDark ? 'rgba(184,135,71,0.16)' : LousaPalette.warningSoft, borderColor: isDark ? 'rgba(224,183,127,0.30)' : '#D9B88B' }]}
            >
              <MaterialSymbol name="priority_high" size={18} color={LousaPalette.warning} />
              <Text style={[styles.quickActionText, { color: LousaPalette.warning }]}>{labels.reviewLegacy}</Text>
            </PressScale>
          ) : null}
        </View>

        <Animated.View entering={FadeInDown.duration(240).delay(30).reduceMotion(ReduceMotion.System)} style={styles.section}>
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
              {labels.weekdays.map((day) => <Text key={day} style={[styles.weekday, { color: colors.outline }]}>{day}</Text>)}
            </View>

            <View style={styles.calendarGrid}>
              {Array.from({ length: calendar.offset }).map((_, index) => <View key={`empty-${index}`} style={styles.dayCell} />)}
              {calendar.days.map((day) => {
                const selected = day.date === selectedDateString;
                const todayCell = day.date === todayString;
                const hasLog = Boolean(wellness.dailyLogs[day.date]);
                const observation = cycleStore.cycleObservations.find((item) => item.date === day.date && !item.deletedAt);
                const confirmedByUser = Boolean(observation && ['period_start', 'period_day', 'period_end'].includes(observation.type));
                const tone = day.isConfirmedPeriod ? 'period' : day.isPredictedPeriod ? 'predicted' : day.isOvulation ? 'ovulation' : day.isFertile ? 'fertile' : 'plain';
                const bg = selected
                  ? (isDark ? 'rgba(217,133,165,0.24)' : '#F8E7ED')
                  : (tone === 'period' || confirmedByUser)
                    ? (isDark ? 'rgba(185,79,98,0.20)' : '#FBE8EC')
                    : tone === 'predicted'
                      ? (isDark ? 'rgba(185,79,98,0.07)' : 'rgba(251,232,236,0.48)')
                    : tone === 'ovulation'
                      ? (isDark ? 'rgba(184,166,217,0.18)' : '#F0ECF8')
                      : tone === 'fertile'
                        ? (isDark ? 'rgba(184,166,217,0.10)' : '#F7F4FB')
                        : 'transparent';

                return (
                  <PressScale key={day.date} onPress={() => selectDate(day.date)} style={styles.dayCell} haptic={false}>
                    <View style={[
                      styles.dayInner,
                      { backgroundColor: bg, width: daySize, height: daySize + 4, borderRadius: Math.max(13, Math.round(daySize * 0.4)) },
                      day.isPredictedPeriod && !selected && { borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? '#B67A8F' : LousaPalette.danger },
                      todayCell && !selected && { borderWidth: 1, borderColor: isDark ? '#A48693' : LousaPalette.rose },
                    ]}>
                      <Text style={[styles.dayNumber, { color: selected ? (isDark ? '#F5D9E4' : LousaPalette.berry) : colors.onBackground }]}>{fromLocalDateString(day.date).getDate()}</Text>
                      <View style={styles.dayMarks}>
                        {day.isConfirmedPeriod ? <View style={[styles.periodMark, { backgroundColor: isDark ? '#D889A1' : LousaPalette.danger }]} /> : null}
                        {day.isPredictedPeriod ? <View style={[styles.predictedMark, { borderColor: isDark ? '#D889A1' : LousaPalette.danger }]} /> : null}
                        {day.isOvulation ? <View style={[styles.ovulationMark, { borderColor: isDark ? '#D2C4E8' : '#8A70B5' }]} /> : null}
                        {observation?.type === 'no_bleeding' ? <MaterialSymbol name="remove" size={9} color={colors.outline} /> : null}
                        {observation?.type === 'spotting' ? <View style={[styles.logMark, { backgroundColor: LousaPalette.warning }]} /> : null}
                        {hasLog ? <View style={[styles.logMark, { backgroundColor: isDark ? '#D9B4C3' : LousaPalette.berry }]} /> : null}
                      </View>
                    </View>
                  </PressScale>
                );
              })}
            </View>

            <View style={[styles.legend, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : LousaPalette.line }]}>
              {hasCycleData ? (
                <>
                  <View style={styles.legendItem}><View style={[styles.legendPeriod, { backgroundColor: isDark ? '#D889A1' : LousaPalette.danger }]} /><Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>{labels.period}</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendPredicted, { borderColor: isDark ? '#D889A1' : LousaPalette.danger }]} /><Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>{labels.predictedPeriod}</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendOvulation, { borderColor: isDark ? '#D2C4E8' : '#8A70B5' }]} /><Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>{labels.ovulation}</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendFertile, { backgroundColor: isDark ? 'rgba(184,166,217,0.22)' : '#EEE8F7' }]} /><Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>{labels.fertile}</Text></View>
                </>
              ) : (
                <Text style={[styles.legendText, { color: colors.onSurfaceVariant }]}>
                  {language === 'en' ? 'The legend will appear after your first entry.' : language === 'hy' ? 'Լեգենդը կհայտնվի առաջին գրառումից հետո։' : 'Легенда появится после первой записи.'}
                </Text>
              )}
            </View>
          </SurfaceCard>
        </Animated.View>

        <SurfaceCard padding={17} tone="flat" style={styles.explainerCard}>
          <View style={styles.explainerRow}>
            <MaterialSymbol name="verified_user" size={20} color={LousaPalette.berry} />
            <View style={styles.flexOne}>
              <Text style={[styles.explainerTitle, { color: colors.onBackground }]}>{labels.howRead}</Text>
              <Text style={[styles.explainerBody, { color: colors.onSurfaceVariant }]}>{labels.factVsForecast}</Text>
            </View>
          </View>
        </SurfaceCard>

        {prediction.expectedWindowPassed ? (
          <SurfaceCard padding={18} tone="accent" style={styles.windowPassedCard}>
            <Text style={[styles.explainerTitle, { color: colors.onBackground }]}>{labels.forecastPassed}</Text>
            <Text style={[styles.explainerBody, { color: colors.onSurfaceVariant }]}>{labels.forecastPassedBody}</Text>
            <View style={styles.windowActions}>
              <PressScale onPress={() => applyCycleObservation('period_start')} style={styles.windowPrimary}><Text style={styles.windowPrimaryText}>{labels.periodStart}</Text></PressScale>
              <PressScale onPress={() => applyCycleObservation('no_bleeding')} style={[styles.windowSecondary, { borderColor: colors.outlineVariant }]}><Text style={[styles.windowSecondaryText, { color: colors.onBackground }]}>{labels.noBleeding}</Text></PressScale>
            </View>
          </SurfaceCard>
        ) : null}

        <Animated.View entering={FadeInDown.duration(220).delay(60).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <SectionHeader title={labels.selected} eyebrow={selectedDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })} />
          <SurfaceCard padding={20} tone="accent">
            {hasCycleData && cycleData.isCyclePositionKnown ? (
              <View style={styles.selectedTop}>
                <View style={styles.selectedDayBlock}>
                  <Text style={[styles.selectedDayNumber, { color: colors.onBackground }]}>{cycleData.currentDay}</Text>
                  <Text style={[styles.selectedDayCaption, { color: colors.onSurfaceVariant }]}>{labels.cycleDay}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <StatusPill tone={selectedObservation || selectedCalendarDay?.isConfirmedPeriod ? 'success' : 'neutral'} icon={selectedObservation || selectedCalendarDay?.isConfirmedPeriod ? 'check_circle' : 'auto_awesome'} label={selectedTrustLabel} />
                  <Text style={[styles.phaseTitle, styles.phaseTitleGap, { color: colors.onBackground }]}>{labels.phases[cycleData.phase]}</Text>
                  <Text style={[styles.phaseExplanation, { color: colors.onSurfaceVariant }]}>{labels.calendarEstimate}</Text>
                  <View style={styles.metaPills}>
                    <StatusPill tone="rose" icon="brightness_2" label={`${labels.moon} · ${Math.round(moon.illumination * 100)}%`} />
                    <StatusPill tone={cycleData.predictionConfidence === 'high' ? 'success' : 'neutral'} label={cycleData.predictionConfidence === 'high' ? labels.high : cycleData.predictionConfidence === 'medium' ? labels.medium : labels.preliminary} />
                  </View>
                  {cycleData.prediction.earliestStart && cycleData.prediction.latestStart ? (
                    <Text style={[styles.rangeText, { color: colors.onSurfaceVariant }]}>
                      {labels.range}: {formatHumanDate(cycleData.prediction.earliestStart, language)}–{formatHumanDate(cycleData.prediction.latestStart, language)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : hasCycleData ? (
              <View style={styles.emptyCycleBlock}>
                <IconBubble icon="help_center" tone="rose" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.phaseTitle, { color: colors.onBackground }]}>{labels.positionUnknown}</Text>
                  <Text style={[styles.rangeText, { color: colors.onSurfaceVariant }]}>{labels.positionUnknownBody}</Text>
                  <PressScale onPress={() => setActionSheetOpen(true)} style={styles.emptyCycleAction}>
                    <Text style={styles.emptyCycleActionText}>{labels.editDay}</Text>
                    <MaterialSymbol name="arrow_forward" size={16} color={LousaPalette.berry} />
                  </PressScale>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCycleBlock}>
                <IconBubble icon="calendar_month" tone="rose" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.phaseTitle, { color: colors.onBackground }]}>
                    {language === 'en' ? 'No cycle data yet' : language === 'hy' ? 'Ցիկլի տվյալներ դեռ չկան' : 'Пока нет данных цикла'}
                  </Text>
                  <Text style={[styles.rangeText, { color: colors.onSurfaceVariant }]}>
                    {language === 'en'
                      ? 'Mark the start date of your last period so LOUSA can build the first cautious forecast.'
                      : language === 'hy'
                        ? 'Նշեք վերջին դաշտանի սկիզբը, որպեսզի LOUSA-ն կազմի առաջին զգուշավոր կանխատեսումը։'
                        : 'Отметьте дату начала последней менструации, чтобы LOUSA смогла построить первый осторожный прогноз.'}
                  </Text>
                  <PressScale onPress={() => router.push({ pathname: '/screens/period-editor', params: { date: selectedDateString } })} style={styles.emptyCycleAction}>
                    <Text style={styles.emptyCycleActionText}>{labels.addPeriod}</Text>
                    <MaterialSymbol name="arrow_forward" size={16} color={LousaPalette.berry} />
                  </PressScale>
                </View>
              </View>
            )}
            <View style={[styles.medicalRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : LousaPalette.line }]}>
              <MaterialSymbol name="info" size={16} color={colors.onSurfaceVariant} />
              <Text style={[styles.medicalText, { color: colors.onSurfaceVariant }]}>{labels.medical}</Text>
            </View>
          </SurfaceCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(90).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <SectionHeader title={labels.advice} />
          <SurfaceCard padding={20}>
            <View style={styles.adviceRow}>
              <IconBubble icon="spa" tone="rose" />
              <Text style={[styles.adviceText, { color: colors.onBackground }]}>{tip}</Text>
            </View>
          </SurfaceCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(110).reduceMotion(ReduceMotion.System)} style={styles.section}>
          <SectionHeader title={labels.checkIn} />
          <SurfaceCard padding={20}>
            <Text style={[styles.fieldTitle, { color: colors.onBackground }]}>{labels.mood}</Text>
            <View style={styles.moodGrid}>
              {MOODS.map((mood) => {
                const selected = currentLog.mood === mood.id;
                return (
                  <PressScale
                    key={mood.id}
                    onPress={() => wellness.setMood(selectedDateString, mood.id)}
                    style={[
                      styles.moodCard,
                      {
                        backgroundColor: selected ? (isDark ? 'rgba(217,133,165,0.20)' : '#F8E7ED') : (isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA'),
                        borderColor: selected ? (isDark ? '#E5A9C0' : LousaPalette.rose) : (isDark ? 'rgba(255,255,255,0.08)' : LousaPalette.line),
                      },
                    ]}
                  >
                    <MaterialSymbol name={mood.icon} size={22} color={selected ? (isDark ? '#F1B7CD' : LousaPalette.berry) : colors.onSurfaceVariant} />
                    <Text numberOfLines={2} style={[styles.moodText, { color: selected ? (isDark ? '#F1D9E2' : LousaPalette.berry) : colors.onSurfaceVariant }]}>{moodLabels[mood.id]}</Text>
                  </PressScale>
                );
              })}
            </View>

            <Text style={[styles.fieldTitle, styles.fieldGap, { color: colors.onBackground }]}>{labels.symptoms}</Text>
            <View style={styles.symptomsWrap}>
              {SYMPTOMS.map((symptom) => {
                const selected = currentLog.symptoms.includes(symptom.id);
                return (
                  <PressScale
                    key={symptom.id}
                    onPress={() => wellness.toggleSymptom(selectedDateString, symptom.id)}
                    style={[
                      styles.symptomChip,
                      {
                        backgroundColor: selected ? (isDark ? 'rgba(184,166,217,0.17)' : '#F0ECF8') : 'transparent',
                        borderColor: selected ? (isDark ? '#C9B8E3' : '#A993C8') : (isDark ? 'rgba(255,255,255,0.09)' : LousaPalette.line),
                      },
                    ]}
                  >
                    <MaterialSymbol name={symptom.icon} size={17} color={selected ? (isDark ? '#D7C9EB' : '#7A62A5') : colors.onSurfaceVariant} />
                    <Text style={[styles.symptomText, { color: selected ? (isDark ? '#E7DFF3' : '#6F5898') : colors.onSurfaceVariant }]}>{symptomLabels[symptom.id]}</Text>
                  </PressScale>
                );
              })}
            </View>

            <Text style={[styles.fieldTitle, styles.fieldGap, { color: colors.onBackground }]}>{labels.note}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={labels.notePlaceholder}
              placeholderTextColor={colors.outline}
              multiline
              style={[
                styles.notesInput,
                {
                  color: colors.onSurface,
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : LousaPalette.line,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA',
                },
              ]}
            />
          </SurfaceCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(220).delay(120).reduceMotion(ReduceMotion.System)} style={styles.actionsSection}>
          <PressScale onPress={() => setActionSheetOpen(true)} style={[styles.periodButton, { borderColor: isDark ? 'rgba(255,255,255,0.11)' : LousaPalette.line }]}>
            <MaterialSymbol name="edit_calendar" size={18} color={isDark ? '#F0B0C3' : LousaPalette.berry} />
            <Text style={[styles.periodButtonText, { color: colors.onBackground }]}>{labels.editDay}</Text>
          </PressScale>
          {lastUndo ? (
            <PressScale onPress={undoLastChange} style={[styles.periodButton, { borderColor: colors.outlineVariant }]}>
              <MaterialSymbol name="undo" size={18} color={colors.onSurfaceVariant} />
              <Text style={[styles.periodButtonText, { color: colors.onSurfaceVariant }]}>{labels.undo}</Text>
            </PressScale>
          ) : null}
        </Animated.View>

        {toast ? (
          <Animated.View entering={FadeInDown.duration(180).reduceMotion(ReduceMotion.System)} style={[styles.toast, { backgroundColor: isDark ? '#25212C' : '#FFFDFE', borderColor: isDark ? 'rgba(255,255,255,0.10)' : LousaPalette.line }]}>
            <MaterialSymbol name="check_circle" size={19} color={isDark ? '#91CBAA' : LousaPalette.success} />
            <Text style={[styles.toastText, { color: colors.onBackground }]}>{toast}</Text>
          </Animated.View>
        ) : null}

        {notesDirty ? (
          <View style={[styles.savePanel, { backgroundColor: isDark ? 'rgba(23,19,29,0.96)' : 'rgba(251,248,247,0.96)', borderColor: isDark ? LousaPalette.lineDark : LousaPalette.line }]}>
            <PrimaryAction label={labels.save} icon="check" onPress={save} />
          </View>
        ) : null}

      </ScreenScroll>

      <Modal visible={actionSheetOpen} transparent animationType="slide" onRequestClose={() => setActionSheetOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActionSheetOpen(false)} />
          <View style={[styles.actionSheet, { backgroundColor: colors.surface, paddingBottom: 22 }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetDate, { color: LousaPalette.berry }]}>{selectedDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            <Text style={[styles.sheetTitle, { color: colors.onBackground }]}>{labels.whatHappened}</Text>
            {([
              ['period_start', 'water_drop', labels.periodStart],
              ['period_day', 'calendar_today', labels.periodDay],
              ['period_end', 'event_available', labels.periodEnd],
              ['spotting', 'grain', labels.spotting],
              ['no_bleeding', 'remove_circle_outline', labels.noBleeding],
            ] as Array<[CycleObservationType, string, string]>).map(([type, icon, label]) => (
              <PressScale key={type} onPress={() => applyCycleObservation(type)} style={[styles.sheetAction, { borderBottomColor: colors.outlineVariant }]}>
                <MaterialSymbol name={icon} size={21} color={type === 'no_bleeding' ? colors.onSurfaceVariant : LousaPalette.berry} />
                <Text style={[styles.sheetActionText, { color: colors.onBackground }]}>{label}</Text>
                {selectedObservation?.type === type ? <MaterialSymbol name="check_circle" size={19} color={LousaPalette.success} /> : null}
              </PressScale>
            ))}
            {(selectedObservation || selectedRecord) ? (
              <PressScale onPress={confirmRemoveSelectedCycleEntry} style={styles.sheetDelete}>
                <MaterialSymbol name="delete" size={20} color={LousaPalette.danger} />
                <Text style={styles.sheetDeleteText}>{labels.deleteDay}</Text>
              </PressScale>
            ) : null}
            <PressScale onPress={() => setActionSheetOpen(false)} style={[styles.sheetCancel, { borderColor: colors.outlineVariant }]}>
              <Text style={[styles.sheetCancelText, { color: colors.onBackground }]}>{labels.cancel}</Text>
            </PressScale>
          </View>
        </View>
      </Modal>
    </TabbedScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6, marginBottom: 4 },
  quickAction: { minHeight: 48, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickActionText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  header: { marginTop: 4, marginBottom: 18 },
  title: { fontFamily: 'sans-serif-medium', fontSize: 29, lineHeight: 35, letterSpacing: -0.3 },
  subtitle: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 20, marginTop: 7 },
  section: { marginBottom: 28 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthArrow: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: 'sans-serif-medium', fontSize: 20, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 0.98, alignItems: 'center', justifyContent: 'center' },
  dayInner: { alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  dayMarks: { height: 8, marginTop: 3, flexDirection: 'row', gap: 2, alignItems: 'center' },
  periodMark: { width: 9, height: 3, borderRadius: 2 },
  ovulationMark: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5 },
  predictedMark: { width: 9, height: 4, borderRadius: 2, borderWidth: 1 },
  logMark: { width: 4, height: 4, borderRadius: 2 },
  legend: { borderTopWidth: 1, marginTop: 13, paddingTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendPeriod: { width: 11, height: 4, borderRadius: 2 },
  legendOvulation: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.5 },
  legendPredicted: { width: 13, height: 8, borderRadius: 4, borderWidth: 1, borderStyle: 'dashed' },
  legendFertile: { width: 11, height: 11, borderRadius: 4 },
  legendText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  selectedTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  selectedDayBlock: { width: 74, height: 74, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.48)', alignItems: 'center', justifyContent: 'center' },
  selectedDayNumber: { fontFamily: 'sans-serif-medium', fontSize: 26, lineHeight: 30 },
  selectedDayCaption: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 1 },
  phaseTitle: { fontFamily: 'sans-serif-medium', fontSize: 17, lineHeight: 22 },
  phaseTitleGap: { marginTop: 9 },
  phaseExplanation: { fontFamily: 'sans-serif', fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  metaPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  rangeText: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 17, marginTop: 8 },
  medicalRow: { borderTopWidth: 1, paddingTop: 14, marginTop: 16, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  medicalText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16 },
  emptyCycleBlock: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  emptyCycleAction: { marginTop: 12, minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: '#E7DADF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: '#FFFDFE' },
  emptyCycleActionText: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 13 },
  adviceRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  adviceText: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 15, lineHeight: 23 },
  fieldTitle: { fontFamily: 'sans-serif-medium', fontSize: 14 },
  fieldGap: { marginTop: 22 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 11 },
  moodCard: { width: '48%', minHeight: 76, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 9 },
  moodText: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 6, textAlign: 'center' },
  symptomsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  symptomChip: { minHeight: 48, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12 },
  symptomText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  notesInput: { minHeight: 102, borderWidth: 1, borderRadius: 19, padding: 14, fontFamily: 'sans-serif', fontSize: 14, lineHeight: 20, marginTop: 10, textAlignVertical: 'top' },
  actionsSection: { gap: 10, marginBottom: 14 },
  periodActions: { flexDirection: 'row', gap: 10 },
  periodActionHalf: { flex: 1, paddingHorizontal: 10 },
  periodButton: { minHeight: 52, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  periodButtonText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  toast: { minHeight: 52, marginTop: 4, marginBottom: 8, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  toastText: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  savePanel: { borderRadius: 24, borderWidth: 1, padding: 8, marginTop: 4, marginBottom: 8 },
  flexOne: { flex: 1 },
  explainerCard: { marginBottom: 18 },
  explainerRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  explainerTitle: { fontFamily: 'sans-serif-medium', fontSize: 15, lineHeight: 20 },
  explainerBody: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 19, marginTop: 4 },
  windowPassedCard: { marginBottom: 20 },
  windowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  windowPrimary: { minHeight: 48, borderRadius: 23, backgroundColor: LousaPalette.berry, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  windowPrimaryText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 13 },
  windowSecondary: { minHeight: 48, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  windowSecondaryText: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(33,26,36,0.38)' },
  actionSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10, maxHeight: '86%' },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D8CDD2', alignSelf: 'center', marginBottom: 15 },
  sheetDate: { fontFamily: 'sans-serif-medium', fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' },
  sheetTitle: { fontFamily: 'sans-serif-medium', fontSize: 22, lineHeight: 28, marginTop: 5, marginBottom: 10 },
  sheetAction: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetActionText: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 14 },
  sheetDelete: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  sheetDeleteText: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 14 },
  sheetCancel: { minHeight: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  sheetCancelText: { fontFamily: 'sans-serif-medium', fontSize: 14 },
});
