import {
  BoxOrder,
  CommunicationStyle,
  CyclePrediction,
  CycleStory,
  CycleStoryHighlight,
  DailyInsight,
  GentleProgress,
  InsightFeedback,
  PeriodRecord,
  ProgressiveProfilePrompt,
  SupportedLanguage,
  TodayPriority,
  WeeklySummary,
} from '../domain/models';
import type { DailyLog } from '../store';
import { addLocalDays, differenceInLocalDays, fromLocalDateString, toLocalDateString } from '../utils/date';

const localeFor = (language: SupportedLanguage) => language === 'en' ? 'en-US' : language === 'hy' ? 'hy-AM' : 'ru-RU';

const text = {
  ru: {
    todayCheck: 'Как вы себя чувствуете?', checkDescription: 'Короткая отметка поможет LOUSA замечать повторяющиеся состояния.', checkAction: 'Отметить',
    review: 'Проверь перенесённые даты', reviewBody: 'Старые записи не влияют на уверенность прогноза, пока вы их не подтвердите.', reviewAction: 'Проверить',
    confirm: 'Менструация могла начаться', confirmBody: 'Подтвердите фактическую дату или оставьте прогноз без изменений.', confirmAction: 'Открыть календарь',
    delivery: 'LOUSA BOX приедет сегодня', deliveryBody: 'Проверь адрес и выбранное окно доставки.', deliveryAction: 'Открыть бокс',
    deadline: 'Состав бокса ещё можно изменить', deadlineBody: 'После дедлайна начнётся подготовка заказа.', deadlineAction: 'Проверить состав',
    feedback: 'Помоги улучшить следующий бокс', feedbackBody: 'Короткий отзыв изменит будущую рекомендацию.', feedbackAction: 'Оставить отзыв',
    profile: 'Добавь ещё одну дату', profileBody: 'Это поможет сделать диапазон прогноза полезнее.', profileAction: 'Добавить дату',
    insightCategory: 'Твой ритм',
    lowEnergyTitle: 'Сегодня можно бережнее распределить силы',
    lowEnergyBody: 'На похожих днях в твоих записях энергия чаще была ниже обычного.',
    calmTitle: 'Сегодняшний ритм выглядит спокойнее',
    calmBody: 'В недавних отметках спокойное состояние встречалось чаще других.',
    symptomsTitle: 'Стоит оставить немного пространства для отдыха',
    symptomsBody: 'В последние дни ты чаще отмечала усталость или дискомфорт.',
    learnTitle: 'LOUSA ещё знакомится с вашим ритмом',
    learnBody: 'Несколько коротких отметок помогут показать личные закономерности без лишних анкет.',
    source: 'Основано только на ваших собственных записях.',
    immediateBrief: 'Записано.', immediateSaved: 'Записано. Эта отметка поможет LOUSA лучше понимать похожие дни.', immediateWarm: 'Спасибо. LOUSA сохранит эту отметку и будет бережнее учитывать похожие дни.',
    immediatePattern: 'Спасибо. На похожих днях ты раньше чаще отмечала {pattern}.',
    weeklyObservation: 'На этой неделе чаще встречалось состояние «{mood}».',
    storyTitle: 'Твой ритм: {month}',
    storySummary: 'Короткое резюме завершённого цикла по подтверждённым данным.',
    cycleLength: 'Длина цикла', periodLength: 'Менструация', commonSymptom: 'Чаще отмечалось', accuracy: 'Отклонение прогноза',
    days: 'дн.', noSymptoms: 'без частых симптомов',
    progressiveDatesTitle: 'Повысить точность прогноза?', progressiveDatesBody: 'Добавьте ещё одну прошлую дату. Это займёт меньше минуты.', progressiveDatesAction: 'Добавить дату',
    progressiveDurationTitle: 'Уточнить длительность?', progressiveDurationBody: 'Это поможет точнее показывать дни менструации и состав бокса.', progressiveDurationAction: 'Уточнить',
  },
  en: {
    todayCheck: 'How are you today?', checkDescription: 'One quick answer gives LOUSA useful context for the day.', checkAction: 'Check in',
    review: 'Review transferred dates', reviewBody: 'Legacy entries do not raise forecast confidence until you confirm them.', reviewAction: 'Review',
    confirm: 'Your period may have started', confirmBody: 'Confirm the actual date or keep the forecast unchanged.', confirmAction: 'Open calendar',
    delivery: 'Your LOUSA BOX arrives today', deliveryBody: 'Check the address and selected delivery window.', deliveryAction: 'Open box',
    deadline: 'You can still edit this box', deadlineBody: 'Preparation begins after the customization deadline.', deadlineAction: 'Review items',
    feedback: 'Help improve the next box', feedbackBody: 'A short review changes your future recommendation.', feedbackAction: 'Leave feedback',
    profile: 'Add one more date', profileBody: 'It can make your forecast range more useful.', profileAction: 'Add date',
    insightCategory: 'Your rhythm',
    lowEnergyTitle: 'A gentler pace may feel useful today', lowEnergyBody: 'On similar days, your logged energy was often lower than usual.',
    calmTitle: 'Today’s rhythm looks calmer', calmBody: 'Calm was the most common state in your recent check-ins.',
    symptomsTitle: 'A little extra rest may feel useful', symptomsBody: 'You have logged fatigue or discomfort more often in recent days.',
    learnTitle: 'LOUSA is still learning your rhythm', learnBody: 'A few short check-ins can reveal personal patterns without a long form.',
    source: 'Based only on your own entries.', immediateBrief: 'Saved.', immediateSaved: 'Saved. This check-in helps LOUSA understand similar days.', immediateWarm: 'Thank you for checking in. LOUSA will keep this context in mind on similar days.',
    immediatePattern: 'Thank you. On similar days you previously logged {pattern} more often.',
    weeklyObservation: 'This week, “{mood}” appeared most often.',
    storyTitle: 'Your {month} rhythm', storySummary: 'A short summary of a completed cycle using confirmed data.',
    cycleLength: 'Cycle length', periodLength: 'Period', commonSymptom: 'Often logged', accuracy: 'Forecast difference', days: 'days', noSymptoms: 'no frequent symptoms',
    progressiveDatesTitle: 'Improve the forecast?', progressiveDatesBody: 'Add one earlier date. It takes less than a minute.', progressiveDatesAction: 'Add date',
    progressiveDurationTitle: 'Add your usual duration?', progressiveDurationBody: 'This improves period-day display and box planning.', progressiveDurationAction: 'Add duration',
  },
  hy: {
    todayCheck: 'Ինչպե՞ս ես այսօր', checkDescription: 'Մեկ կարճ պատասխանն օգնում է LOUSA-ին հասկանալ օրվա համատեքստը։', checkAction: 'Նշել',
    review: 'Ստուգիր տեղափոխված ամսաթվերը', reviewBody: 'Հին գրառումները չեն բարձրացնում կանխատեսման վստահությունը, մինչև չհաստատես։', reviewAction: 'Ստուգել',
    confirm: 'Դաշտանը կարող էր սկսվել', confirmBody: 'Հաստատիր իրական ամսաթիվը կամ պահիր կանխատեսումը։', confirmAction: 'Բացել օրացույցը',
    delivery: 'LOUSA BOX-ը կհասնի այսօր', deliveryBody: 'Ստուգիր հասցեն և առաքման ժամային միջակայքը։', deliveryAction: 'Բացել բոքսը',
    deadline: 'Բոքսի կազմը դեռ կարելի է փոխել', deadlineBody: 'Վերջնաժամկետից հետո կսկսվի պատրաստումը։', deadlineAction: 'Ստուգել կազմը',
    feedback: 'Օգնիր բարելավել հաջորդ բոքսը', feedbackBody: 'Կարճ կարծիքը կփոխի հաջորդ առաջարկը։', feedbackAction: 'Թողնել կարծիք',
    profile: 'Ավելացրու ևս մեկ ամսաթիվ', profileBody: 'Սա կանխատեսման միջակայքը կդարձնի ավելի օգտակար։', profileAction: 'Ավելացնել',
    insightCategory: 'Քո ռիթմը', lowEnergyTitle: 'Այսօր կարող է օգտակար լինել ավելի մեղմ տեմպը', lowEnergyBody: 'Նման օրերին քո նշած էներգիան հաճախ ավելի ցածր է եղել։',
    calmTitle: 'Այսօրվա ռիթմն ավելի հանգիստ է թվում', calmBody: 'Վերջին նշումներում հանգիստ վիճակը հանդիպել է ավելի հաճախ։',
    symptomsTitle: 'Կարելի է մի փոքր ավելի շատ հանգիստ թողնել', symptomsBody: 'Վերջին օրերին ավելի հաճախ նշել ես հոգնածություն կամ անհարմարություն։',
    learnTitle: 'LOUSA-ն դեռ ճանաչում է քո ռիթմը', learnBody: 'Մի քանի կարճ նշում կօգնի տեսնել անձնական օրինաչափությունները։',
    source: 'Հիմնված է միայն քո սեփական գրառումների վրա։', immediateBrief: 'Պահպանվեց։', immediateSaved: 'Պահպանվեց։ Այս նշումը կօգնի հասկանալ նման օրերը։', immediateWarm: 'Շնորհակալություն նշման համար։ LOUSA-ն նրբորեն կհաշվի այն նման օրերին։',
    immediatePattern: 'Շնորհակալություն։ Նման օրերին նախկինում ավելի հաճախ նշել ես՝ {pattern}։',
    weeklyObservation: 'Այս շաբաթ առավել հաճախ հանդիպել է «{mood}» վիճակը։',
    storyTitle: 'Քո {month} ռիթմը', storySummary: 'Ավարտված ցիկլի կարճ ամփոփում՝ հաստատված տվյալներով։',
    cycleLength: 'Ցիկլի տևողություն', periodLength: 'Դաշտան', commonSymptom: 'Հաճախ նշվել է', accuracy: 'Կանխատեսման տարբերություն', days: 'օր', noSymptoms: 'հաճախակի ախտանիշներ չկան',
    progressiveDatesTitle: 'Բարձրացնե՞լ ճշտությունը', progressiveDatesBody: 'Ավելացրու ևս մեկ նախորդ ամսաթիվ։', progressiveDatesAction: 'Ավելացնել',
    progressiveDurationTitle: 'Նշե՞լ սովորական տևողությունը', progressiveDurationBody: 'Սա կօգնի օրերի և բոքսի հաշվարկին։', progressiveDurationAction: 'Նշել',
  },
} as const;

function moodLabel(mood: string, language: SupportedLanguage) {
  const labels: Record<SupportedLanguage, Record<string, string>> = {
    ru: { calm: 'спокойствие', happy: 'хорошее настроение', sad: 'грусть', anxious: 'тревогу', irritable: 'раздражение' },
    en: { calm: 'calm', happy: 'a positive mood', sad: 'sadness', anxious: 'anxiety', irritable: 'irritability' },
    hy: { calm: 'հանգստություն', happy: 'լավ տրամադրություն', sad: 'տխրություն', anxious: 'անհանգստություն', irritable: 'գրգռվածություն' },
  };
  return labels[language][mood] || mood;
}

export function selectTodayPriority(input: {
  language: SupportedLanguage;
  today?: string;
  migrationReviewRequired: boolean;
  prediction: CyclePrediction;
  todayLog?: DailyLog | null;
  isOnboarded: boolean;
  confirmedPeriods: number;
  orders: BoxOrder[];
  feedbackOrderIds?: string[];
}): TodayPriority {
  const c = text[input.language];
  const today = input.today || toLocalDateString();
  if (input.migrationReviewRequired) return { type: 'review_legacy_data', priority: 100, title: c.review, description: c.reviewBody, actionLabel: c.reviewAction, route: '/screens/period-review' };

  const activeOrder = input.orders.find((order) => !['delivered', 'cancelled', 'refunded'].includes(order.status));
  if (activeOrder?.plannedDeliveryDate === today && ['ready', 'courier_assigned', 'out_for_delivery'].includes(activeOrder.status)) {
    return { type: 'delivery_today', priority: 90, title: c.delivery, description: c.deliveryBody, actionLabel: c.deliveryAction, route: '/(tabs)/box' };
  }
  if (activeOrder?.customizationDeadline && activeOrder.customizationDeadline >= today) {
    const days = differenceInLocalDays(fromLocalDateString(activeOrder.customizationDeadline), fromLocalDateString(today));
    if (days >= 0 && days <= 2 && ['scheduled', 'customization_open'].includes(activeOrder.status)) {
      return { type: 'box_deadline', priority: 80, title: c.deadline, description: c.deadlineBody, actionLabel: c.deadlineAction, route: '/(tabs)/box' };
    }
  }
  if (input.prediction.earliestStart && input.prediction.latestStart && today >= input.prediction.earliestStart && today <= input.prediction.latestStart) {
    return { type: 'confirm_period', priority: 75, title: c.confirm, description: c.confirmBody, actionLabel: c.confirmAction, route: '/(tabs)/cycle' };
  }
  const feedbackOrderIds = new Set(input.feedbackOrderIds || []);
  const deliveredWithoutFeedback = input.orders.find((order) => order.status === 'delivered' && !feedbackOrderIds.has(order.id));
  if (deliveredWithoutFeedback) return { type: 'feedback_required', priority: 65, title: c.feedback, description: c.feedbackBody, actionLabel: c.feedbackAction, route: '/screens/box-feedback' };
  if (input.confirmedPeriods < 2) return { type: 'complete_profile', priority: 55, title: c.profile, description: c.profileBody, actionLabel: c.profileAction, route: '/(tabs)/cycle' };
  if (!input.todayLog?.mood) return { type: 'quick_check_in', priority: 50, title: c.todayCheck, description: c.checkDescription, actionLabel: c.checkAction };
  return { type: 'none', priority: 0, title: '', description: '' };
}

export function buildDailyInsight(input: {
  language: SupportedLanguage;
  logs: Record<string, DailyLog>;
  today?: string;
  feedback?: InsightFeedback[];
}): DailyInsight {
  const c = text[input.language];
  const today = input.today || toLocalDateString();
  const recent = Object.values(input.logs)
    .filter((log) => !log.deletedAt && log.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);
  const feedback = input.feedback || [];
  const avoid = new Set(feedback.filter((item) => item.response === 'not_relevant').map((item) => item.insightId));
  const lowEnergyCount = recent.filter((log) => log.energy <= 2).length;
  const symptomCount = recent.filter((log) => log.symptoms.includes('fatigue') || (log.painLevel ?? 0) >= 5).length;
  const calmCount = recent.filter((log) => log.mood === 'calm').length;

  const candidates: DailyInsight[] = [
    { id: 'energy-gentle-pace', category: c.insightCategory, title: c.lowEnergyTitle, body: c.lowEnergyBody, sourceNote: c.source },
    { id: 'symptoms-rest-space', category: c.insightCategory, title: c.symptomsTitle, body: c.symptomsBody, sourceNote: c.source },
    { id: 'calm-recent-rhythm', category: c.insightCategory, title: c.calmTitle, body: c.calmBody, sourceNote: c.source },
    { id: 'learning-your-rhythm', category: c.insightCategory, title: c.learnTitle, body: c.learnBody, sourceNote: c.source },
  ];
  const order = lowEnergyCount >= 3 ? ['energy-gentle-pace', 'symptoms-rest-space', 'calm-recent-rhythm', 'learning-your-rhythm']
    : symptomCount >= 3 ? ['symptoms-rest-space', 'energy-gentle-pace', 'calm-recent-rhythm', 'learning-your-rhythm']
      : calmCount >= 3 ? ['calm-recent-rhythm', 'learning-your-rhythm', 'energy-gentle-pace', 'symptoms-rest-space']
        : ['learning-your-rhythm', 'calm-recent-rhythm', 'energy-gentle-pace', 'symptoms-rest-space'];
  return order.map((id) => candidates.find((candidate) => candidate.id === id)!).find((candidate) => !avoid.has(candidate.id)) || candidates[3];
}

export function buildImmediateCheckInResponse(input: {
  language: SupportedLanguage;
  mood: string;
  logs: Record<string, DailyLog>;
  today?: string;
  communicationStyle?: CommunicationStyle;
}): string {
  const c = text[input.language];
  const today = input.today || toLocalDateString();
  const sameMoodCount = Object.values(input.logs).filter((log) => log.date < today && log.mood === input.mood).length;
  if (input.communicationStyle === 'brief') return c.immediateBrief;
  if (sameMoodCount >= 2) return c.immediatePattern.replace('{pattern}', moodLabel(input.mood, input.language));
  if (input.communicationStyle === 'warm') return c.immediateWarm;
  return c.immediateSaved;
}

export function calculateGentleProgress(input: {
  logs: Record<string, DailyLog>;
  periods: PeriodRecord[];
  feedback: InsightFeedback[];
  weeklySummariesOpened?: number;
  today?: string;
}): GentleProgress {
  const today = input.today || toLocalDateString();
  const month = today.slice(0, 7);
  const careDaysThisMonth = new Set(Object.values(input.logs).filter((log) => !log.deletedAt && log.date.startsWith(month) && Boolean(log.mood || log.symptoms.length || log.notes)).map((log) => log.date)).size;
  const confirmedCycles = input.periods.filter((period) => period.confirmed && !period.needsReview && !period.deletedAt).length;
  const insightsRated = input.feedback.filter((item) => item.response !== 'dismissed').length;
  let lastMilestone: string | undefined;
  if (confirmedCycles >= 6) lastMilestone = 'confirmed_cycles_6';
  else if (careDaysThisMonth >= 7) lastMilestone = 'care_days_7';
  else if (careDaysThisMonth >= 3) lastMilestone = 'care_days_3';
  return { careDaysThisMonth, confirmedCycles, completedWeeklyReviews: input.weeklySummariesOpened || 0, insightsRated, lastMilestone };
}

export function buildWeeklySummary(input: {
  language: SupportedLanguage;
  logs: Record<string, DailyLog>;
  today?: string;
}): WeeklySummary | null {
  const today = input.today || toLocalDateString();
  const start = toLocalDateString(addLocalDays(today, -6));
  const logs = Object.values(input.logs).filter((log) => !log.deletedAt && log.date >= start && log.date <= today && Boolean(log.mood || log.symptoms.length || log.notes));
  if (logs.length < 2) return null;
  const energies = logs.map((log) => log.energy).filter((value) => Number.isFinite(value));
  const sleeps = logs.map((log) => log.sleep).filter((value) => Number.isFinite(value));
  const moods = logs.map((log) => log.mood).filter(Boolean) as string[];
  const moodCounts = moods.reduce<Record<string, number>>((acc, mood) => ({ ...acc, [mood]: (acc[mood] || 0) + 1 }), {});
  const commonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const symptomCounts = logs.flatMap((log) => log.symptoms).reduce<Record<string, number>>((acc, symptom) => ({ ...acc, [symptom]: (acc[symptom] || 0) + 1 }), {});
  const commonSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([symptom]) => symptom);
  const c = text[input.language];
  return {
    id: `weekly-${start}-${today}`,
    rangeStart: start,
    rangeEnd: today,
    loggedDays: logs.length,
    averageEnergy: energies.length ? Number((energies.reduce((sum, value) => sum + value, 0) / energies.length).toFixed(1)) : null,
    averageSleep: sleeps.length ? Number((sleeps.reduce((sum, value) => sum + value, 0) / sleeps.length).toFixed(1)) : null,
    commonMood,
    commonSymptoms,
    observation: commonMood ? c.weeklyObservation.replace('{mood}', moodLabel(commonMood, input.language)) : null,
    generatedAt: new Date().toISOString(),
  };
}

export function buildLatestCycleStory(input: {
  language: SupportedLanguage;
  periods: PeriodRecord[];
  logs: Record<string, DailyLog>;
  predictionErrorDays?: number | null;
}): CycleStory | null {
  const periods = input.periods.filter((period) => period.confirmed && !period.needsReview && !period.deletedAt).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (periods.length < 2) return null;
  const current = periods[periods.length - 2];
  const next = periods[periods.length - 1];
  const cycleLength = differenceInLocalDays(fromLocalDateString(next.startDate), fromLocalDateString(current.startDate));
  if (cycleLength < 15 || cycleLength > 90) return null;
  const periodLength = current.endDate ? differenceInLocalDays(fromLocalDateString(current.endDate), fromLocalDateString(current.startDate)) + 1 : Object.keys(current.flowByDay).length;
  const cycleLogs = Object.values(input.logs).filter((log) => log.date >= current.startDate && log.date < next.startDate && !log.deletedAt);
  const symptomCounts = cycleLogs.flatMap((log) => log.symptoms).reduce<Record<string, number>>((acc, symptom) => ({ ...acc, [symptom]: (acc[symptom] || 0) + 1 }), {});
  const commonSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const month = fromLocalDateString(current.startDate).toLocaleDateString(localeFor(input.language), { month: 'long' });
  const c = text[input.language];
  const highlights: CycleStoryHighlight[] = [
    { key: 'cycle', label: c.cycleLength, value: `${cycleLength} ${c.days}` },
    { key: 'period', label: c.periodLength, value: periodLength ? `${periodLength} ${c.days}` : '—' },
    { key: 'symptom', label: c.commonSymptom, value: commonSymptom || c.noSymptoms },
  ];
  if (input.predictionErrorDays != null) highlights.push({ key: 'accuracy', label: c.accuracy, value: `${input.predictionErrorDays} ${c.days}` });
  return {
    id: `story-${current.id}`,
    cycleId: current.id,
    title: c.storyTitle.replace('{month}', month),
    dateRange: `${fromLocalDateString(current.startDate).toLocaleDateString(localeFor(input.language), { day: 'numeric', month: 'short' })} — ${addLocalDays(next.startDate, -1).toLocaleDateString(localeFor(input.language), { day: 'numeric', month: 'short' })}`,
    summary: c.storySummary,
    highlights,
    predictionAccuracy: input.predictionErrorDays ?? undefined,
    moonVisualKey: current.startDate,
    generatedAt: new Date().toISOString(),
  };
}

export function selectProgressiveProfilePrompt(input: {
  language: SupportedLanguage;
  periods: PeriodRecord[];
  periodLengthKnown: boolean;
  lastPromptAt?: string | null;
  today?: string;
}): ProgressiveProfilePrompt | null {
  const today = input.today || toLocalDateString();
  if (input.lastPromptAt && differenceInLocalDays(fromLocalDateString(today), fromLocalDateString(input.lastPromptAt.slice(0, 10))) < 7) return null;
  const confirmed = input.periods.filter((period) => period.confirmed && !period.needsReview && !period.deletedAt).length;
  const c = text[input.language];
  if (confirmed < 3) return { id: 'add-period-history', title: c.progressiveDatesTitle, description: c.progressiveDatesBody, actionLabel: c.progressiveDatesAction, route: '/(tabs)/cycle' };
  if (!input.periodLengthKnown) return { id: 'add-period-duration', title: c.progressiveDurationTitle, description: c.progressiveDurationBody, actionLabel: c.progressiveDurationAction, route: '/screens/profile' };
  return null;
}

export function shouldShowContextualBox(input: { order?: BoxOrder | null; hasFeedback: boolean; today?: string }): boolean {
  const order = input.order;
  if (!order) return false;
  const today = input.today || toLocalDateString();
  if (order.status === 'delivered') return !input.hasFeedback;
  if (order.plannedDeliveryDate === today) return true;
  if (order.customizationDeadline) {
    const distance = differenceInLocalDays(fromLocalDateString(order.customizationDeadline), fromLocalDateString(today));
    if (distance >= 0 && distance <= 2) return true;
  }
  return ['packing', 'ready', 'courier_assigned', 'out_for_delivery', 'delayed'].includes(order.status);
}
