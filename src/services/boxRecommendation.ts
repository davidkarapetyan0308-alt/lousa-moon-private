import {
  BoxFeedback,
  BoxItem,
  BoxPlan,
  BoxPreferences,
  PeriodRecord,
  SupportedLanguage,
} from '../domain/models';

export interface BoxRecommendationInput {
  plan: BoxPlan;
  preferences: BoxPreferences;
  periods: PeriodRecord[];
  feedback: BoxFeedback[];
  language?: SupportedLanguage;
}

export interface ExcludedBoxItem {
  id: string;
  reason: 'allergy' | 'disliked' | 'feedback' | 'plan_limit' | 'preference';
  detail?: string;
}

export interface BoxRecommendation {
  items: BoxItem[];
  warnings: string[];
  rationale: string[];
  excludedItems: ExcludedBoxItem[];
  estimatedCoverageDays: number;
  confidence: 'low' | 'medium' | 'high';
}

const TEXT = {
  ru: {
    products: { pads: 'Прокладки', tampons: 'Тампоны', mixed: 'Смешанный набор', cup: 'Менструальная чаша', disc: 'Менструальный диск' },
    menstrualFallback: 'Средства менструальной гигиены', calculated: (days: number) => `Рассчитано примерно на ${days} дней по подтверждённой истории и предпочтениям`,
    night: 'Ночная защита', nightReason: 'Добавлено с учётом ночной защиты и прошлых записей', heat: 'Многоразовая грелка', heatReason: 'Для мягкого тепла и комфорта',
    decaf: 'Напиток без кофеина', tea: 'Травяной чай', preference: 'Согласно выбранным предпочтениям', milk: 'Молочный шоколад', dark: 'Тёмный шоколад',
    sleepMask: 'Маска для сна', journal: 'Дневник LOUSA', included: 'Входит в выбранный тариф', candle: 'Свеча в сливовом стекле', ritual: 'Премиальный ритуал', moon: 'Серебряный аксессуар-полумесяц', gift: 'Специальный подарок тарифа',
  },
  en: {
    products: { pads: 'Pads', tampons: 'Tampons', mixed: 'Mixed set', cup: 'Menstrual cup', disc: 'Menstrual disc' },
    menstrualFallback: 'Menstrual-care products', calculated: (days: number) => `Estimated for about ${days} days using confirmed history and preferences`,
    night: 'Night protection', nightReason: 'Included using night-protection preferences and prior records', heat: 'Reusable heat pad', heatReason: 'For gentle warmth and comfort',
    decaf: 'Decaffeinated drink', tea: 'Herbal tea', preference: 'Based on your preferences', milk: 'Milk chocolate', dark: 'Dark chocolate',
    sleepMask: 'Sleep mask', journal: 'LOUSA journal', included: 'Included in the selected plan', candle: 'Muted-plum glass candle', ritual: 'Premium ritual item', moon: 'Moon-silver crescent accessory', gift: 'Special plan gift',
  },
  hy: {
    products: { pads: 'Միջադիրներ', tampons: 'Տամպոններ', mixed: 'Խառը հավաքածու', cup: 'Դաշտանային բաժակ', disc: 'Դաշտանային դիսկ' },
    menstrualFallback: 'Դաշտանային խնամքի միջոցներ', calculated: (days: number) => `Մոտավոր հաշվարկված է ${days} օրվա համար՝ հաստատված պատմության և նախասիրությունների հիման վրա`,
    night: 'Գիշերային պաշտպանություն', nightReason: 'Ավելացվել է գիշերային պաշտպանության և նախորդ գրառումների հիման վրա', heat: 'Բազմակի օգտագործման տաքացուցիչ', heatReason: 'Մեղմ ջերմության և հարմարավետության համար',
    decaf: 'Առանց կոֆեինի ըմպելիք', tea: 'Բուսական թեյ', preference: 'Ըստ քո նախասիրությունների', milk: 'Կաթնային շոկոլադ', dark: 'Մուգ շոկոլադ',
    sleepMask: 'Քնի դիմակ', journal: 'LOUSA օրագիր', included: 'Ներառված է ընտրված փաթեթում', candle: 'Սալորագույն ապակե մոմ', ritual: 'Պրեմիում արարողության տարր', moon: 'Արծաթագույն մահիկ աքսեսուար', gift: 'Փաթեթի հատուկ նվեր',
  },
} as const;

const FLOW_SCORE: Record<string, number> = { spotting: 0.2, light: 0.65, medium: 1, heavy: 1.45, very_heavy: 1.9 };

function confirmedRecords(records: PeriodRecord[]) {
  return records.filter((record) => record.confirmed && !record.needsReview && !record.deletedAt);
}

function averageFlowMultiplier(records: PeriodRecord[]): number {
  const values = confirmedRecords(records).flatMap((record) => Object.values(record.flowByDay || {}));
  if (!values.length) return 1;
  return values.reduce((sum, value) => sum + (FLOW_SCORE[value] ?? 1), 0) / values.length;
}

function averageProductsUsed(records: PeriodRecord[]): number | null {
  const values = confirmedRecords(records)
    .flatMap((record) => Object.values(record.productsUsedByDay || {}))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nightLeakRate(records: PeriodRecord[]): number {
  const values = confirmedRecords(records).flatMap((record) => Object.values(record.nightLeakageByDay || {}));
  if (!values.length) return 0;
  return values.filter(Boolean).length / values.length;
}

function normalizeTerms(values: string[]) {
  return values.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function itemContainsAny(item: BoxItem, terms: string[]) {
  const haystack = [item.name, ...(item.allergenTags || [])].join(' ').toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function planItemLimit(plan: BoxPlan) {
  if (plan === 'essential') return 6;
  if (plan === 'comfort') return 9;
  return 12;
}

export function recommendBox(input: BoxRecommendationInput): BoxRecommendation {
  const { plan, preferences, periods, feedback } = input;
  const language = input.language || 'ru';
  const copy = TEXT[language];
  const warnings: string[] = [];
  const rationale: string[] = [];
  const excludedItems: ExcludedBoxItem[] = [];

  const confirmed = confirmedRecords(periods);
  const flowMultiplier = averageFlowMultiplier(confirmed);
  const actualDailyUse = averageProductsUsed(confirmed);
  const baseDays = Math.max(2, Math.min(10, preferences.periodLengthEstimate || 5));
  const configuredDaily = Math.max(1, Math.min(12, preferences.dailyQuantityEstimate || 5));
  const effectiveDaily = actualDailyUse == null ? configuredDaily : configuredDaily * 0.35 + actualDailyUse * 0.65;
  const nightRate = nightLeakRate(confirmed);

  const feedbackAdjustment = feedback.reduce((adjustment, item) => {
    if (item.enoughItems === false || item.tooFewCategories.includes('menstrual')) return adjustment + 0.15;
    if (item.enoughItems === true && item.tooManyCategories.includes('menstrual')) return adjustment - 0.08;
    return adjustment;
  }, 0);

  let quantity = Math.ceil(baseDays * effectiveDaily * flowMultiplier * (1 + feedbackAdjustment));
  quantity = Math.max(8, quantity);
  if (preferences.minimumMenstrualItems != null) quantity = Math.max(quantity, preferences.minimumMenstrualItems);
  if (preferences.maximumMenstrualItems != null) quantity = Math.min(quantity, preferences.maximumMenstrualItems);

  const items: BoxItem[] = [];
  items.push({
    id: 'menstrual-primary',
    sku: `menstrual-${preferences.primaryProduct}`,
    name: copy.products[preferences.primaryProduct] || copy.menstrualFallback,
    category: 'menstrual',
    quantity,
    reason: copy.calculated(baseDays),
    replaceable: true,
    allergenTags: preferences.avoidedMaterials || [],
  });
  rationale.push(actualDailyUse == null ? 'quantity_based_on_preferences' : 'quantity_uses_actual_consumption');
  rationale.push(`flow_multiplier:${Math.round(flowMultiplier * 100) / 100}`);

  const needsNightProtection = preferences.nightProtection || nightRate >= 0.2;
  if (needsNightProtection) {
    items.push({
      id: 'night-protection',
      sku: 'menstrual-night',
      name: copy.night,
      category: 'menstrual',
      quantity: Math.max(3, Math.ceil(baseDays * Math.max(1, preferences.nightQuantityEstimate || 1))),
      reason: copy.nightReason,
      replaceable: true,
    });
    rationale.push(nightRate >= 0.2 ? 'night_protection_added_from_history' : 'night_protection_added_from_preference');
  }

  if (preferences.heatPadPreference === 'include' || plan !== 'essential') {
    items.push({ id: 'heat-pad', sku: 'wellness-heat-pad', name: copy.heat, category: 'wellness', quantity: 1, reason: copy.heatReason, replaceable: true });
  }
  if (preferences.teaPreference !== 'none') {
    items.push({
      id: 'tea',
      sku: `food-tea-${preferences.teaPreference}`,
      name: preferences.teaPreference === 'decaf' ? copy.decaf : copy.tea,
      category: 'food',
      quantity: 1,
      reason: copy.preference,
      replaceable: true,
      allergenTags: ['herbs'],
    });
  }
  if (preferences.chocolatePreference !== 'none' && plan !== 'essential') {
    items.push({
      id: 'chocolate',
      sku: `food-chocolate-${preferences.chocolatePreference}`,
      name: preferences.chocolatePreference === 'milk' ? copy.milk : copy.dark,
      category: 'food',
      quantity: 1,
      reason: copy.preference,
      replaceable: true,
      allergenTags: preferences.chocolatePreference === 'milk' ? ['milk'] : [],
    });
  }
  if (plan === 'comfort' || plan === 'ritual') {
    items.push({ id: 'sleep-mask', sku: 'wellness-sleep-mask', name: copy.sleepMask, category: 'wellness', quantity: 1, reason: copy.included, replaceable: true });
    items.push({ id: 'journal', sku: 'wellness-journal', name: copy.journal, category: 'wellness', quantity: 1, reason: copy.included, replaceable: true });
  }
  if (plan === 'ritual') {
    items.push({ id: 'candle', sku: 'wellness-candle-plum', name: copy.candle, category: 'wellness', quantity: 1, reason: copy.ritual, replaceable: true, allergenTags: ['fragrance'] });
    items.push({ id: 'moon-accessory', sku: 'gift-moon-accessory', name: copy.moon, category: 'gift', quantity: 1, reason: copy.gift, replaceable: false });
  }

  const allergyTerms = normalizeTerms([
    ...preferences.foodAllergies,
    ...preferences.cosmeticAllergies,
    ...(preferences.foodIntolerances || []),
  ]);
  const removeTerms = normalizeTerms([
    ...preferences.dislikedItems,
    ...feedback.flatMap((item) => item.removeItems),
  ]);

  const safelyFiltered = items.filter((item) => {
    if (allergyTerms.length && itemContainsAny(item, allergyTerms)) {
      excludedItems.push({ id: item.id, reason: 'allergy', detail: 'Matched a saved allergy or intolerance.' });
      return false;
    }
    if (removeTerms.length && itemContainsAny(item, removeTerms)) {
      excludedItems.push({ id: item.id, reason: 'disliked' });
      return false;
    }
    if (preferences.fragranceFree && (item.allergenTags || []).includes('fragrance')) {
      excludedItems.push({ id: item.id, reason: 'preference', detail: 'Fragrance-free preference.' });
      return false;
    }
    return true;
  });

  const limit = planItemLimit(plan);
  const limited = safelyFiltered.slice(0, limit);
  safelyFiltered.slice(limit).forEach((item) => excludedItems.push({ id: item.id, reason: 'plan_limit' }));

  if (allergyTerms.length) warnings.push('allergy_review_required');
  if (feedback.some((item) => item.allergyReaction || item.irritationReaction)) warnings.push('previous_reaction_requires_manual_review');
  if (preferences.skinSensitivity || preferences.fragranceFree) rationale.push('fragrance_free_packaging');
  if (confirmed.length < 2) warnings.push('limited_history_for_personalization');

  const confidence: BoxRecommendation['confidence'] = confirmed.length >= 4 && actualDailyUse != null
    ? 'high'
    : confirmed.length >= 2 || actualDailyUse != null
      ? 'medium'
      : 'low';

  return {
    items: limited,
    warnings,
    rationale,
    excludedItems,
    estimatedCoverageDays: baseDays,
    confidence,
  };
}
