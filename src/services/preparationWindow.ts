import type { CyclePrediction, SupportedLanguage } from '../domain/models';
import { addLocalDays, differenceInLocalDays, formatHumanDate, fromLocalDateString, toLocalDateString } from '../utils/date';

export type PreparationWindowState = 'no_data' | 'upcoming' | 'active' | 'urgent' | 'missed';

export interface PreparationWindow {
  state: PreparationWindowState;
  startDate: string | null;
  endDate: string | null;
  targetDate: string | null;
  daysUntilStart: number | null;
  daysUntilTarget: number | null;
}

export interface PreparationWindowCopy {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  secondaryLabel: string;
}

export function calculatePreparationWindow(
  prediction: Pick<CyclePrediction, 'mostLikelyStart' | 'earliestStart' | 'latestStart' | 'confidence' | 'lastConfirmedStart'>,
  today: Date = new Date()
): PreparationWindow {
  if (!prediction.mostLikelyStart || !prediction.lastConfirmedStart || prediction.confidence === 'insufficient') {
    return { state: 'no_data', startDate: null, endDate: null, targetDate: null, daysUntilStart: null, daysUntilTarget: null };
  }

  const targetDate = prediction.earliestStart || prediction.mostLikelyStart;
  const startDate = toLocalDateString(addLocalDays(targetDate, -7));
  const endDate = toLocalDateString(addLocalDays(targetDate, -2));
  const todayLocal = toLocalDateString(today);
  const daysUntilStart = differenceInLocalDays(fromLocalDateString(startDate), fromLocalDateString(todayLocal));
  const daysUntilTarget = differenceInLocalDays(fromLocalDateString(targetDate), fromLocalDateString(todayLocal));

  let state: PreparationWindowState = 'upcoming';
  if (todayLocal >= startDate && todayLocal <= endDate) state = 'active';
  else if (todayLocal > endDate && todayLocal <= (prediction.latestStart || prediction.mostLikelyStart)) state = 'urgent';
  else if (prediction.latestStart && todayLocal > prediction.latestStart) state = 'missed';

  return { state, startDate, endDate, targetDate, daysUntilStart, daysUntilTarget };
}

function formatRange(start: string | null, end: string | null, language: SupportedLanguage) {
  if (!start || !end) return '';
  if (start === end) return formatHumanDate(start, language);
  return `${formatHumanDate(start, language)} — ${formatHumanDate(end, language)}`;
}

export function buildPreparationWindowCopy(window: PreparationWindow, language: SupportedLanguage): PreparationWindowCopy {
  const range = formatRange(window.startDate, window.endDate, language);
  if (language === 'en') {
    if (window.state === 'no_data') return {
      eyebrow: 'LOUSA preparation window',
      title: 'Preparation starts after the first date',
      body: 'LOUSA will not guess your cycle. Add a confirmed start date, then we will show when to prepare your box.',
      actionLabel: 'Add date',
      secondaryLabel: 'Set care profile',
    };
    if (window.state === 'active') return {
      eyebrow: 'LOUSA preparation window',
      title: 'This is a good time to prepare',
      body: `Your preparation window is open${range ? `: ${range}` : ''}. Check the box contents, address and reminders before packing starts.`,
      actionLabel: 'Prepare LOUSA BOX',
      secondaryLabel: 'Care profile',
    };
    if (window.state === 'urgent') return {
      eyebrow: 'LOUSA preparation window',
      title: 'Cycle may start soon',
      body: 'Check that essentials, delivery address and quiet notifications are ready. You still control every item.',
      actionLabel: 'Check box',
      secondaryLabel: 'Address',
    };
    return {
      eyebrow: 'LOUSA preparation window',
      title: window.daysUntilStart != null ? `Preparation opens in ${Math.max(0, window.daysUntilStart)} days` : 'Preparation window is planned',
      body: `LOUSA will remind you during ${range}. This is when we suggest checking the box, not an automatic purchase.`,
      actionLabel: 'View LOUSA BOX',
      secondaryLabel: 'Care profile',
    };
  }

  if (language === 'hy') {
    if (window.state === 'no_data') return {
      eyebrow: 'LOUSA-ի նախապատրաստման պատուհան',
      title: 'Նախապատրաստումը կսկսվի առաջին ամսաթվից հետո',
      body: 'LOUSA-ն չի գուշակի ձեր ցիկլը։ Նշեք հաստատված սկիզբը, և մենք ցույց կտանք, թե երբ պատրաստել բոքսը։',
      actionLabel: 'Նշել ամսաթիվը',
      secondaryLabel: 'Խնամքի պրոֆիլ',
    };
    if (window.state === 'active') return {
      eyebrow: 'LOUSA-ի նախապատրաստման պատուհան',
      title: 'Հարմար ժամանակ է պատրաստվելու համար',
      body: `Նախապատրաստման պատուհանը բաց է${range ? `՝ ${range}` : ''}։ Ստուգեք բոքսի կազմը, հասցեն և հիշեցումները։`,
      actionLabel: 'Պատրաստել LOUSA BOX',
      secondaryLabel: 'Խնամքի պրոֆիլ',
    };
    if (window.state === 'urgent') return {
      eyebrow: 'LOUSA-ի նախապատրաստման պատուհան',
      title: 'Ցիկլը կարող է շուտով սկսվել',
      body: 'Ստուգեք հիմնական միջոցները, հասցեն և հանգիստ հիշեցումները։ Ամեն բան ավելացվում է միայն ձեր ընտրությամբ։',
      actionLabel: 'Ստուգել բոքսը',
      secondaryLabel: 'Հասցե',
    };
    return {
      eyebrow: 'LOUSA-ի նախապատրաստման պատուհան',
      title: window.daysUntilStart != null ? `Նախապատրաստումը կսկսվի ${Math.max(0, window.daysUntilStart)} օրից` : 'Նախապատրաստման պատուհանը պլանավորված է',
      body: `LOUSA-ն կհիշեցնի ${range}։ Սա առաջարկ է ստուգելու բոքսը, ոչ ավտոմատ գնում։`,
      actionLabel: 'Բացել LOUSA BOX',
      secondaryLabel: 'Խնամքի պրոֆիլ',
    };
  }

  if (window.state === 'no_data') return {
    eyebrow: 'Окно подготовки LOUSA',
    title: 'Подготовка начнётся после первой даты',
    body: 'LOUSA не будет угадывать цикл. Отметьте подтверждённую дату начала — и мы покажем, когда лучше подготовить бокс.',
    actionLabel: 'Отметить дату',
    secondaryLabel: 'Профиль заботы',
  };
  if (window.state === 'active') return {
    eyebrow: 'Окно подготовки LOUSA',
    title: 'Сейчас хорошее время подготовиться',
    body: `Окно подготовки открыто${range ? `: ${range}` : ''}. Проверьте состав бокса, адрес и напоминания до начала сборки.`,
    actionLabel: 'Подготовить LOUSA BOX',
    secondaryLabel: 'Профиль заботы',
  };
  if (window.state === 'urgent') return {
    eyebrow: 'Окно подготовки LOUSA',
    title: 'Цикл может начаться скоро',
    body: 'Проверьте базовые средства, адрес доставки и тихие уведомления. LOUSA ничего не добавляет без вашего выбора.',
    actionLabel: 'Проверить бокс',
    secondaryLabel: 'Адрес',
  };
  return {
    eyebrow: 'Окно подготовки LOUSA',
    title: window.daysUntilStart != null ? `Подготовка откроется через ${Math.max(0, window.daysUntilStart)} дн.` : 'Окно подготовки запланировано',
    body: `LOUSA напомнит в период ${range}. Это предложение проверить бокс, а не автоматическая покупка.`,
    actionLabel: 'Открыть LOUSA BOX',
    secondaryLabel: 'Профиль заботы',
  };
}
