import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AmbientBackground } from '../../src/components/AmbientBackground';
import { DateCalendarPicker } from '../../src/components/DateCalendarPicker';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { PressScale, PrimaryAction, SurfaceCard } from '../../src/components/ui';
import { useResponsiveLayout } from '../../src/components/layout';
import { useCycleStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette, LousaShadow } from '../../src/theme/designSystem';
import { addLocalDays, differenceInLocalDays, fromLocalDateString, toLocalDateString } from '../../src/utils/date';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import { getServiceMode, services } from '../../src/services';
import { enqueueCycleSettingsSync, flushCycleSettingsSync } from '../../src/services/cycleSettingsSync';
import { trackProductEvent } from '../../src/services/productAnalytics';
import { validatePeriodRecordSet } from '../../src/domain/cycleValidation';
import { encryptedJsonStore } from '../../src/security/encryptedStateStorage';
import {
  CommunicationStyle,
  CycleContext,
  CycleFactor,
  CycleGoal,
  PeriodRecord,
  OnboardingProfile,
} from '../../src/domain/models';

const DRAFT_KEY = 'lousa-onboarding-draft-v8';
const QUESTIONNAIRE_SCHEMA_VERSION = 3;
const QUESTIONNAIRE_SCHEMA_ID = 'cycle-profile-v3';

type Step = 1 | 2 | 3 | 4;

type Draft = {
  step: Step;
  goals: CycleGoal[];
  cycleContext: CycleContext;
  factors: CycleFactor[];
  selectedDate: string | null;
  periodStarts: string[];
  periodLength: number | null;
  consentAccepted: boolean;
  communicationStyle: CommunicationStyle;
};

const defaultDraft = (): Draft => ({
  step: 1,
  goals: ['track'],
  cycleContext: 'prefer_not_to_say',
  factors: ['prefer_not_to_say'],
  selectedDate: null,
  periodStarts: [],
  periodLength: null,
  consentAccepted: false,
  communicationStyle: 'neutral',
});

const CONTEXTS: CycleContext[] = [
  'natural',
  'pill',
  'hormonal_iud',
  'copper_iud',
  'implant',
  'injection',
  'pregnant',
  'postpartum',
  'breastfeeding',
  'perimenopause',
  'amenorrhea',
  'prefer_not_to_say',
];

const FACTORS: CycleFactor[] = [
  'pcos',
  'endometriosis',
  'thyroid',
  'recent_contraception_change',
  'recent_pregnancy',
  'intense_training',
  'weight_change',
  'none',
  'prefer_not_to_say',
];

const COPY = {
  ru: {
    step: 'Шаг', of: 'из', back: 'Назад', next: 'Продолжить', finish: 'Открыть LOUSA', skipDate: 'Добавлю дату позже',
    goalTitle: 'Что для вас важно', goalBody: 'Выберите задачи LOUSA. Всё можно изменить позже.',
    goals: { track: 'Отслеживать цикл', symptoms: 'Замечать самочувствие', pregnancy: 'Планировать беременность', box: 'Готовить LOUSA BOX', reminders: 'Получать напоминания' },
    contextTitle: 'Уточним контекст', contextBody: 'Это помогает не показывать неподходящий календарный прогноз. LOUSA не ставит диагнозов.',
    contextLabel: 'Текущая ситуация', factorLabel: 'Что ещё может влиять на цикл',
    contexts: {
      natural: 'Без гормональной контрацепции', pill: 'Гормональные таблетки', hormonal_iud: 'Гормональная ВМС', copper_iud: 'Медная ВМС', implant: 'Имплант', injection: 'Инъекции', pregnant: 'Беременность', postpartum: 'Послеродовой период', breastfeeding: 'Грудное вскармливание', perimenopause: 'Перименопауза', amenorrhea: 'Менструаций сейчас нет', prefer_not_to_say: 'Не хочу отвечать',
    },
    factors: { pcos: 'СПКЯ', endometriosis: 'Эндометриоз', thyroid: 'Щитовидная железа', recent_contraception_change: 'Недавняя смена контрацепции', recent_pregnancy: 'Недавняя беременность', intense_training: 'Интенсивные тренировки', weight_change: 'Изменение веса', none: 'Ничего из перечисленного', prefer_not_to_say: 'Не хочу отвечать' },
    datesTitle: 'Добавьте подтверждённую дату', datesBody: 'Выберите первый день последней полноценной менструации. Этот шаг можно пропустить: LOUSA не будет придумывать дату.',
    dateHint: 'Лёгкие выделения до менструации не считаются первым днём.', addDate: 'Добавить выбранную дату', remove: 'Удалить', duration: 'Обычная продолжительность', unknown: 'Не знаю',
    resultTitle: 'Проверьте настройки', resultBody: 'Факт и прогноз хранятся отдельно. Любую запись можно изменить или удалить.',
    likely: 'Вероятное начало', range: 'Диапазон', confidence: 'Уверенность', confidenceValues: { insufficient: 'данных недостаточно', low: 'низкая', medium: 'средняя', high: 'высокая' },
    noPrediction: 'Пока нет подтверждённых дат. Прогноз появится после вашей первой записи.', noDateStatus: 'Дата цикла не добавлена — это нормально.',
    tone: 'Стиль общения', tones: { brief: 'Кратко', neutral: 'Нейтрально', warm: 'Тепло' },
    consent: 'Я понимаю, что прогноз приблизительный, не является диагнозом или методом контрацепции, а записи можно изменить.', consentError: 'Подтвердите условия, чтобы продолжить.',
    privacy: 'Данные цикла не передаются курьеру или логистике.',
  },
  en: {
    step: 'Step', of: 'of', back: 'Back', next: 'Continue', finish: 'Open LOUSA', skipDate: 'I’ll add a date later',
    goalTitle: 'What matters to you', goalBody: 'Choose what LOUSA should help with. You can edit this later.',
    goals: { track: 'Track my cycle', symptoms: 'Notice wellbeing', pregnancy: 'Plan pregnancy', box: 'Prepare LOUSA BOX', reminders: 'Receive reminders' },
    contextTitle: 'Add context', contextBody: 'This prevents unsuitable calendar estimates. LOUSA does not diagnose conditions.', contextLabel: 'Current situation', factorLabel: 'Other factors that may affect the cycle',
    contexts: { natural: 'No hormonal contraception', pill: 'Hormonal pill', hormonal_iud: 'Hormonal IUD', copper_iud: 'Copper IUD', implant: 'Implant', injection: 'Injection', pregnant: 'Pregnancy', postpartum: 'Postpartum', breastfeeding: 'Breastfeeding', perimenopause: 'Perimenopause', amenorrhea: 'No periods currently', prefer_not_to_say: 'Prefer not to say' },
    factors: { pcos: 'PCOS', endometriosis: 'Endometriosis', thyroid: 'Thyroid condition', recent_contraception_change: 'Recent contraception change', recent_pregnancy: 'Recent pregnancy', intense_training: 'Intense training', weight_change: 'Weight change', none: 'None of these', prefer_not_to_say: 'Prefer not to say' },
    datesTitle: 'Add a confirmed date', datesBody: 'Choose day one of your latest full period. You can skip this step: LOUSA will not invent a date.', dateHint: 'Light spotting before a period is not day one.', addDate: 'Add selected date', remove: 'Remove', duration: 'Usual duration', unknown: 'I do not know',
    resultTitle: 'Review your setup', resultBody: 'Confirmed records and forecasts stay separate. You can edit or delete any record.', likely: 'Likely start', range: 'Range', confidence: 'Confidence', confidenceValues: { insufficient: 'not enough data', low: 'low', medium: 'medium', high: 'high' }, noPrediction: 'There are no confirmed dates yet. A forecast will appear after your first record.', noDateStatus: 'No cycle date was added — that is okay.',
    tone: 'Communication style', tones: { brief: 'Brief', neutral: 'Neutral', warm: 'Warm' }, consent: 'I understand forecasts are approximate, not a diagnosis or contraception, and records can be edited.', consentError: 'Confirm these conditions to continue.', privacy: 'Cycle data is not shared with couriers or logistics.',
  },
  hy: {
    step: 'Քայլ', of: 'ից', back: 'Հետ', next: 'Շարունակել', finish: 'Բացել LOUSA-ն', skipDate: 'Ամսաթիվը կավելացնեմ հետո',
    goalTitle: 'Ի՞նչն է կարևոր ձեզ համար', goalBody: 'Ընտրեք LOUSA-ի հիմնական խնդիրները։ Դրանք կարելի է փոխել հետո։', goals: { track: 'Հետևել ցիկլին', symptoms: 'Նշել ինքնազգացողությունը', pregnancy: 'Պլանավորել հղիություն', box: 'Պատրաստել LOUSA BOX', reminders: 'Ստանալ հիշեցումներ' },
    contextTitle: 'Հստակեցնենք համատեքստը', contextBody: 'Սա օգնում է չցուցադրել ոչ համապատասխան օրացուցային կանխատեսում։ LOUSA-ն ախտորոշում չի անում։', contextLabel: 'Ընթացիկ իրավիճակ', factorLabel: 'Այլ գործոններ',
    contexts: { natural: 'Առանց հորմոնալ հակաբեղմնավորման', pill: 'Հորմոնալ հաբեր', hormonal_iud: 'Հորմոնալ պարույր', copper_iud: 'Պղնձե պարույր', implant: 'Իմպլանտ', injection: 'Ներարկում', pregnant: 'Հղիություն', postpartum: 'Հետծննդյան շրջան', breastfeeding: 'Կրծքով կերակրում', perimenopause: 'Պերիմենոպաուզա', amenorrhea: 'Դաշտան այժմ չկա', prefer_not_to_say: 'Չեմ ցանկանում պատասխանել' },
    factors: { pcos: 'ՊԿՁՀ', endometriosis: 'Էնդոմետրիոզ', thyroid: 'Վահանաձև գեղձ', recent_contraception_change: 'Հակաբեղմնավորման փոփոխություն', recent_pregnancy: 'Վերջին հղիություն', intense_training: 'Ինտենսիվ մարզումներ', weight_change: 'Քաշի փոփոխություն', none: 'Ոչ մեկը', prefer_not_to_say: 'Չեմ ցանկանում պատասխանել' },
    datesTitle: 'Ավելացրեք հաստատված ամսաթիվ', datesBody: 'Ընտրեք վերջին լիարժեք դաշտանի առաջին օրը։ Քայլը կարելի է բաց թողնել․ LOUSA-ն ամսաթիվ չի հորինի։', dateHint: 'Թեթև spotting-ը չի համարվում առաջին օր։', addDate: 'Ավելացնել ընտրված ամսաթիվը', remove: 'Հեռացնել', duration: 'Սովորական տևողություն', unknown: 'Չգիտեմ',
    resultTitle: 'Ստուգեք կարգավորումները', resultBody: 'Փաստերը և կանխատեսումները պահվում են առանձին։ Գրառումը կարելի է փոխել կամ ջնջել։', likely: 'Հավանական սկիզբ', range: 'Միջակայք', confidence: 'Վստահություն', confidenceValues: { insufficient: 'տվյալները քիչ են', low: 'ցածր', medium: 'միջին', high: 'բարձր' }, noPrediction: 'Հաստատված ամսաթիվ դեռ չկա։ Կանխատեսումը կհայտնվի առաջին գրառումից հետո։', noDateStatus: 'Ցիկլի ամսաթիվ չի ավելացվել․ դա նորմալ է։',
    tone: 'Հաղորդակցության ոճ', tones: { brief: 'Կարճ', neutral: 'Չեզոք', warm: 'Ջերմ' }, consent: 'Ես հասկանում եմ, որ կանխատեսումը մոտավոր է, ախտորոշում կամ հակաբեղմնավորում չէ, իսկ գրառումները կարելի է փոխել։', consentError: 'Շարունակելու համար հաստատեք պայմանները։', privacy: 'Ցիկլի տվյալները չեն փոխանցվում առաքիչին կամ լոգիստիկային։',
  },
} as const;

export default function CalmOnboardingScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((state) => state.language);
  const copy = COPY[language];
  const { horizontalPadding, compactWidth } = useResponsiveLayout();
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { trackProductEvent('onboarding_started', { language, source: 'truth_v8' }).catch(() => {}); }, [language]);
  useEffect(() => {
    encryptedJsonStore.get<Partial<Draft>>(DRAFT_KEY).then((saved) => {
      if (saved) setDraft({ ...defaultDraft(), ...saved });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);
  useEffect(() => { if (loaded) encryptedJsonStore.set(DRAFT_KEY, draft).catch(() => {}); }, [draft, loaded]);

  const dates = useMemo(() => Array.from(new Set(draft.periodStarts)).sort(), [draft.periodStarts]);
  const previewRecords = useMemo<PeriodRecord[]>(() => validatePeriodRecordSet(dates.map((startDate, index) => ({
    id: `preview-${index}-${startDate}`,
    startDate,
    endDate: draft.periodLength ? toLocalDateString(addLocalDays(startDate, draft.periodLength - 1)) : null,
    confirmed: true,
    source: 'user',
    flowByDay: draft.periodLength ? Object.fromEntries(Array.from({ length: draft.periodLength }, (_, day) => [toLocalDateString(addLocalDays(startDate, day)), day < 2 ? 'medium' : 'light'])) : {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))), [dates, draft.periodLength]);
  const preview = useMemo(() => calculateCyclePrediction(previewRecords, {
    fallbackPeriodLength: draft.periodLength || 5,
    cycleContext: draft.cycleContext,
    factors: draft.factors,
  }), [previewRecords, draft.periodLength, draft.cycleContext, draft.factors]);

  const addSelectedDate = () => {
    if (!draft.selectedDate) return;
    setDraft((state) => ({ ...state, periodStarts: Array.from(new Set([...state.periodStarts, state.selectedDate!])).sort().slice(-12) }));
  };
  const toggleGoal = (goal: CycleGoal) => setDraft((state) => ({ ...state, goals: state.goals.includes(goal) ? state.goals.filter((item) => item !== goal) : [...state.goals, goal] }));
  const toggleFactor = (factor: CycleFactor) => setDraft((state) => {
    if (factor === 'none' || factor === 'prefer_not_to_say') return { ...state, factors: [factor] };
    const base = state.factors.filter((item) => item !== 'none' && item !== 'prefer_not_to_say');
    return { ...state, factors: base.includes(factor) ? base.filter((item) => item !== factor) : [...base, factor] };
  });

  const next = () => {
    setError('');
    if (draft.step === 1 && draft.goals.length === 0) setDraft((state) => ({ ...state, goals: ['track'], step: 2 }));
    else setDraft((state) => ({ ...state, step: Math.min(4, state.step + 1) as Step }));
  };
  const back = () => { if (draft.step === 1) router.back(); else setDraft((state) => ({ ...state, step: (state.step - 1) as Step })); };

  const finish = async () => {
    if (!draft.consentAccepted) { setError(copy.consentError); return; }
    const now = new Date().toISOString();
    const records = validatePeriodRecordSet(previewRecords);
    const prediction = calculateCyclePrediction(records, {
      fallbackPeriodLength: draft.periodLength || 5,
      cycleContext: draft.cycleContext,
      factors: draft.factors,
    });
    const starts = records.map((record) => record.startDate);
    const intervals = starts.slice(1).map((date, index) => differenceInLocalDays(fromLocalDateString(date), fromLocalDateString(starts[index]))).filter((value) => value > 0);
    const cycleStore = useCycleStore.getState();
    cycleStore.replacePeriodRecords(records);
    if (prediction.weightedCycleLength || prediction.medianCycleLength) cycleStore.setCycleLength(Math.round(prediction.weightedCycleLength || prediction.medianCycleLength || 28));
    if (draft.periodLength != null) cycleStore.setPeriodLength(draft.periodLength);
    const onboardingProfile: OnboardingProfile = {
      goals: draft.goals,
      cycleContext: draft.cycleContext,
      factors: draft.factors.length ? draft.factors : ['prefer_not_to_say'],
      regularity: intervals.length ? (Math.max(...intervals) - Math.min(...intervals) <= 3 ? 'regular' : 'somewhat_variable') : 'unknown',
      shortestCycle: intervals.length ? Math.min(...intervals) : null,
      longestCycle: intervals.length ? Math.max(...intervals) : null,
      periodLengthKnown: draft.periodLength != null,
      completedAt: now,
      consentVersion: 'local-sensitive-data-v3',
      sensitiveDataConsentAt: now,
      onboardingStep: 4,
      onboardingCompleted: true,
      questionnaireStatus: records.length ? 'completed' : 'skipped_cycle_date',
      questionnaireSchemaVersion: QUESTIONNAIRE_SCHEMA_ID,
    };
    cycleStore.setOnboardingProfile(onboardingProfile);
    if (getServiceMode() === 'api') {
      const settingsPayload = {
        averageCycleLength: Math.round(prediction.weightedCycleLength || prediction.medianCycleLength || cycleStore.avgCycleLength),
        averagePeriodLength: draft.periodLength || cycleStore.avgPeriodLength,
        onboardingProfile,
        schemaVersion: QUESTIONNAIRE_SCHEMA_VERSION,
      };
      await enqueueCycleSettingsSync(settingsPayload);
      await Promise.allSettled([
        flushCycleSettingsSync(),
        ...records.map((record) => services.cycle.savePeriod(record)),
      ]);
    }
    useUserStore.setState({ isOnboarded: true, isDemoMode: false, communicationStyle: draft.communicationStyle });
    await encryptedJsonStore.remove(DRAFT_KEY).catch(() => {});
    await trackProductEvent('onboarding_completed', { language, source: 'truth_v8', style: draft.communicationStyle, confirmed_dates: records.length, has_prediction: Boolean(prediction.mostLikelyStart), completed: true }).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/(tabs)');
  };

  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  const title = draft.step === 1 ? copy.goalTitle : draft.step === 2 ? copy.contextTitle : draft.step === 3 ? copy.datesTitle : copy.resultTitle;
  const body = draft.step === 1 ? copy.goalBody : draft.step === 2 ? copy.contextBody : draft.step === 3 ? copy.datesBody : copy.resultBody;
  const locale = language === 'en' ? 'en-US' : language === 'hy' ? 'hy-AM' : 'ru-RU';

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <AmbientBackground variant={isDark ? 'cosmic' : 'minimal'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
          <PressScale accessibilityLabel={copy.back} onPress={back} style={[styles.headerButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFDFE' }]}><MaterialSymbol name="arrow_back" size={21} color={colors.onBackground} /></PressScale>
          <Text style={[styles.stepText, { color: colors.onSurfaceVariant }]}>{copy.step} {draft.step} {copy.of} 4</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={[styles.progressTrack, { marginHorizontal: horizontalPadding, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEE5EA' }]}><View style={[styles.progressFill, { width: `${draft.step / 4 * 100}%` }]} /></View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}>
          <Text style={[styles.title, compactWidth && styles.titleCompact, { color: colors.onBackground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{body}</Text>

          {draft.step === 1 ? <View style={styles.goalList}>{(Object.keys(copy.goals) as CycleGoal[]).map((goal) => {
            const selected = draft.goals.includes(goal);
            return <PressScale key={goal} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleGoal(goal)} style={[styles.goalRow, { borderColor: selected ? LousaPalette.berry : colors.outlineVariant, backgroundColor: selected ? (isDark ? 'rgba(217,133,165,0.15)' : '#F8E7ED') : (isDark ? 'rgba(255,255,255,0.04)' : '#FFFDFE') }]}>
              <View style={[styles.goalIcon, { backgroundColor: selected ? LousaPalette.berry : '#F8E7ED' }]}><MaterialSymbol name={goal === 'track' ? 'calendar_month' : goal === 'symptoms' ? 'mood' : goal === 'pregnancy' ? 'favorite' : goal === 'box' ? 'redeem' : 'notifications'} size={20} color={selected ? '#FFF' : LousaPalette.berry} /></View>
              <Text style={[styles.goalText, { color: colors.onBackground }]}>{copy.goals[goal]}</Text><MaterialSymbol name={selected ? 'check_circle' : 'chevron_right'} size={19} color={selected ? LousaPalette.berry : colors.outline} />
            </PressScale>;
          })}</View> : null}

          {draft.step === 2 ? <View>
            <Text style={[styles.subheading, { color: colors.onBackground }]}>{copy.contextLabel}</Text>
            <View style={styles.chips}>{CONTEXTS.map((context) => <PressScale key={context} accessibilityRole="radio" accessibilityState={{ selected: draft.cycleContext === context }} onPress={() => setDraft((state) => ({ ...state, cycleContext: context }))} style={[styles.chip, { borderColor: draft.cycleContext === context ? LousaPalette.berry : colors.outlineVariant, backgroundColor: draft.cycleContext === context ? '#F8E7ED' : 'transparent' }]}><Text style={[styles.chipText, { color: draft.cycleContext === context ? LousaPalette.berry : colors.onSurfaceVariant }]}>{copy.contexts[context]}</Text></PressScale>)}</View>
            <Text style={[styles.subheading, { color: colors.onBackground }]}>{copy.factorLabel}</Text>
            <View style={styles.chips}>{FACTORS.map((factor) => { const selected = draft.factors.includes(factor); return <PressScale key={factor} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleFactor(factor)} style={[styles.chip, { borderColor: selected ? LousaPalette.berry : colors.outlineVariant, backgroundColor: selected ? '#F8E7ED' : 'transparent' }]}><Text style={[styles.chipText, { color: selected ? LousaPalette.berry : colors.onSurfaceVariant }]}>{copy.factors[factor]}</Text></PressScale>; })}</View>
          </View> : null}

          {draft.step === 3 ? <View>
            <DateCalendarPicker value={draft.selectedDate || toLocalDateString()} onChange={(selectedDate) => setDraft((state) => ({ ...state, selectedDate }))} language={language} maximumDate={toLocalDateString()} minimumDate={toLocalDateString(addLocalDays(new Date(), -3650))} />
            <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>{copy.dateHint}</Text>
            <PrimaryAction label={copy.addDate} icon="calendar_month" onPress={addSelectedDate} disabled={!draft.selectedDate} />
            {dates.length ? <View style={styles.dateList}>{dates.map((date) => <View key={date} style={[styles.dateRow, { borderBottomColor: colors.outlineVariant }]}><Text style={[styles.dateText, { color: colors.onBackground }]}>{fromLocalDateString(date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</Text><PressScale accessibilityLabel={`${copy.remove} ${date}`} onPress={() => setDraft((state) => ({ ...state, periodStarts: state.periodStarts.filter((item) => item !== date) }))} style={styles.removeButton}><MaterialSymbol name="close" size={19} color={colors.outline} /></PressScale></View>)}</View> : null}
            <Text style={[styles.subheading, { color: colors.onBackground }]}>{copy.duration}</Text>
            <View style={styles.durationRow}>{[3, 4, 5, 6, 7].map((value) => <PressScale key={value} onPress={() => setDraft((state) => ({ ...state, periodLength: value }))} style={[styles.durationButton, { borderColor: draft.periodLength === value ? LousaPalette.berry : colors.outlineVariant, backgroundColor: draft.periodLength === value ? '#F8E7ED' : 'transparent' }]}><Text style={[styles.durationValue, { color: draft.periodLength === value ? LousaPalette.berry : colors.onSurfaceVariant }]}>{value}</Text></PressScale>)}</View>
            <PressScale onPress={() => setDraft((state) => ({ ...state, periodLength: null }))} style={styles.unknownButton}><Text style={[styles.unknownText, { color: draft.periodLength == null ? LousaPalette.berry : colors.onSurfaceVariant }]}>{copy.unknown}</Text></PressScale>
          </View> : null}

          {draft.step === 4 ? <View>
            <SurfaceCard padding={19} tone={preview.mostLikelyStart ? 'accent' : 'default'}>{preview.mostLikelyStart ? <>
              <ResultRow label={copy.likely} value={fromLocalDateString(preview.mostLikelyStart).toLocaleDateString(locale, { day: 'numeric', month: 'long' })} />
              <ResultRow label={copy.range} value={preview.earliestStart && preview.latestStart ? `${fromLocalDateString(preview.earliestStart).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} — ${fromLocalDateString(preview.latestStart).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}` : '—'} />
              <ResultRow label={copy.confidence} value={copy.confidenceValues[preview.confidence]} last />
            </> : <><Text style={[styles.noPrediction, { color: colors.onSurfaceVariant }]}>{copy.noPrediction}</Text><Text style={[styles.noDateStatus, { color: LousaPalette.success }]}>{copy.noDateStatus}</Text></>}</SurfaceCard>
            <Text style={[styles.subheading, { color: colors.onBackground }]}>{copy.tone}</Text>
            <View style={styles.toneRow}>{(['brief', 'neutral', 'warm'] as CommunicationStyle[]).map((tone) => <PressScale key={tone} onPress={() => setDraft((state) => ({ ...state, communicationStyle: tone }))} style={[styles.toneButton, { borderColor: draft.communicationStyle === tone ? LousaPalette.berry : colors.outlineVariant, backgroundColor: draft.communicationStyle === tone ? '#F8E7ED' : 'transparent' }]}><Text style={[styles.toneText, { color: draft.communicationStyle === tone ? LousaPalette.berry : colors.onSurfaceVariant }]}>{copy.tones[tone]}</Text></PressScale>)}</View>
            <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: draft.consentAccepted }} onPress={() => { setDraft((state) => ({ ...state, consentAccepted: !state.consentAccepted })); setError(''); }} style={[styles.consentRow, { borderColor: draft.consentAccepted ? LousaPalette.berry : colors.outlineVariant }]}><View style={[styles.consentBox, draft.consentAccepted && styles.consentChecked]}>{draft.consentAccepted ? <MaterialSymbol name="check" size={15} color="#FFFFFF" /> : null}</View><Text style={[styles.consentText, { color: colors.onSurfaceVariant }]}>{copy.consent}</Text></PressScale>
            <Text style={[styles.privacy, { color: colors.outline }]}>{copy.privacy}</Text>{error ? <Text style={styles.error}>{error}</Text> : null}
          </View> : null}
        </ScrollView>

        <View style={[styles.footer, compactWidth && styles.footerCompact, { paddingHorizontal: horizontalPadding, backgroundColor: isDark ? 'rgba(23,19,29,0.96)' : 'rgba(251,248,247,0.96)' }]}>
          {draft.step === 3 ? <PressScale onPress={() => setDraft((state) => ({ ...state, selectedDate: null, periodStarts: [], step: 4 }))} style={styles.skipButton}><Text style={[styles.skipText, { color: colors.onSurfaceVariant }]}>{copy.skipDate}</Text></PressScale> : <View />}
          <View style={styles.footerAction}><PrimaryAction label={draft.step === 4 ? copy.finish : copy.next} icon={draft.step === 4 ? 'check' : 'arrow_forward'} onPress={() => draft.step === 4 ? finish().catch(() => {}) : next()} /></View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ResultRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return <View style={[styles.resultRow, !last && { borderBottomColor: colors.outlineVariant, borderBottomWidth: StyleSheet.hairlineWidth }]}><Text style={[styles.resultLabel, { color: colors.onSurfaceVariant }]}>{label}</Text><Text style={[styles.resultValue, { color: colors.onBackground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, safe: { flex: 1 }, scrollView: { flex: 1 },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', ...LousaShadow.soft }, headerPlaceholder: { width: 48 },
  stepText: { fontFamily: 'sans-serif-medium', fontSize: 12 }, progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3, backgroundColor: LousaPalette.berry },
  scroll: { flexGrow: 1, paddingTop: 22, paddingBottom: 28 }, title: { fontFamily: 'serif', fontSize: 28, lineHeight: 34, textAlign: 'center' }, titleCompact: { fontSize: 25, lineHeight: 31 }, subtitle: { fontFamily: 'sans-serif', fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  goalList: { gap: 10 }, goalRow: { minHeight: 64, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, goalIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, goalText: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 13.5, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' }, chipText: { fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 17 },
  hint: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginVertical: 12 }, dateList: { marginTop: 12 }, dateRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth }, dateText: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 13 }, removeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  subheading: { fontFamily: 'sans-serif-medium', fontSize: 17, lineHeight: 23, marginTop: 24, marginBottom: 11 }, durationRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, durationButton: { width: 52, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, durationValue: { fontFamily: 'sans-serif-medium', fontSize: 14 }, unknownButton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }, unknownText: { fontFamily: 'sans-serif-medium', fontSize: 12.5, textDecorationLine: 'underline' },
  resultRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 }, resultLabel: { flex: 1, fontFamily: 'sans-serif', fontSize: 12 }, resultValue: { flex: 1.2, fontFamily: 'sans-serif-medium', fontSize: 13, textAlign: 'right' }, noPrediction: { fontFamily: 'sans-serif', fontSize: 13, lineHeight: 20 }, noDateStatus: { fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  toneRow: { flexDirection: 'row', gap: 8 }, toneButton: { flex: 1, minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, toneText: { fontFamily: 'sans-serif-medium', fontSize: 12, textAlign: 'center' },
  consentRow: { minHeight: 72, borderRadius: 18, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginTop: 23 }, consentBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: LousaPalette.line, alignItems: 'center', justifyContent: 'center' }, consentChecked: { backgroundColor: LousaPalette.berry, borderColor: LousaPalette.berry }, consentText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 18 }, privacy: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16, marginTop: 9 }, error: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 8 },
  footer: { minHeight: 82, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(91,54,95,0.12)' }, footerCompact: { flexDirection: 'column', alignItems: 'stretch' }, footerAction: { flex: 1, width: '100%', maxWidth: 350, marginLeft: 'auto' }, skipButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }, skipText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
});
