import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { RealMapPreview } from '../../src/components/RealMapPreview';
import { ModalScreen, ScreenScroll, useResponsiveLayout } from '../../src/components/layout';
import { IconBubble, PressScale, PrimaryAction, QuantitySelector, StatusPill, SurfaceCard } from '../../src/components/ui';
import { BOX_PLANS, BoxPlanId, formatAmd, localizedText } from '../../src/data/boxCatalog';
import { useBoxStore, useCycleStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { formatHumanDate } from '../../src/utils/date';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import { planBoxDelivery } from '../../src/services/deliveryPlanning';
import { ProductType } from '../../src/domain/models';
import { calculateBoxQuote } from '../../src/services/boxQuote';
import { getServiceMode, services } from '../../src/services';
import type { ServerOrderQuote } from '../../src/services/contracts';
import { structureAllergens } from '../../src/services/allergenSafety';

const WINDOWS = ['10:00–14:00', '14:00–18:00', '18:00–21:00'];
const PLAN_IMAGES = {
  essential: require('../../assets/images/box/box-essential.png'),
  comfort: require('../../assets/images/box/box-comfort.png'),
  ritual: require('../../assets/images/box/box-moon-ritual.png'),
} as const;

const COPY = {
  ru: {
    appBar: 'Настройка LOUSA BOX', steps: ['Тариф', 'Состав', 'Доставка', 'Проверка'],
    titles: ['Выбери уровень заботы', 'Настрой состав под себя', 'Куда и когда доставить', 'Проверь заказ'],
    subtitles: ['Тариф можно изменить или поставить на паузу позже.', 'Количество рассчитывается по истории и твоим предпочтениям.', 'Целевая дата учитывает раннюю границу прогноза и запас на доставку.', 'Проверь цену, адрес и условия подписки перед подтверждением.'],
    popular: 'Популярный', product: 'Основной тип средств', pads: 'Прокладки', tampons: 'Тампоны', mixed: 'Смешанный набор', cup: 'Чаша', disc: 'Диск',
    quantity: 'Средств на один цикл', quantityHelp: 'По умолчанию выбран лимит тарифа. Рекомендация не добавляется автоматически.', periodLength: 'По профилю', included: 'Включено в тариф', selected: 'Выбрано', extra: 'Дополнительно', addOns: 'Платные дополнения', deliveryFee: 'Доставка', totalToday: 'Итого сегодня', recommendation: 'Рекомендуемый объём', applicator: 'Аппликатор для тампонов', withApplicator: 'С аппликатором', withoutApplicator: 'Без аппликатора', noPreference: 'Не важно', reusable: 'Многоразовая чаша/диск · разово', cosmeticAllergies: 'Косметические аллергии', disliked: 'Что не класть в бокс', cosmeticPlaceholder: 'Например: эфирные масла, ретинол', dislikedPlaceholder: 'Например: свеча, сладости', night: 'Ночная защита', fragrance: 'Без ароматизаторов', sensitive: 'Чувствительная кожа', wings: 'С крылышками',
    heat: 'Грелка · разово', tea: 'Травяной чай · каждый бокс', chocolate: 'Тёмный шоколад · каждый бокс', allergies: 'Аллергии и ограничения', allergiesPlaceholder: 'Например: орехи, лактоза',
    address: 'Адрес доставки', addressPlaceholder: 'Город, улица, дом, квартира', chooseMap: 'Выбрать дом на реальной карте', changeMap: 'Изменить точку на карте', mapRequired: 'Сначала выбери дом на карте и проверь зону доставки.', mapVerified: 'Адрес подтверждён по координатам', phone: 'Телефон', phonePlaceholder: '+374…', window: 'Удобное время', note: 'Комментарий курьеру', notePlaceholder: 'Код домофона или ориентир', target: 'Целевая доставка', range: 'Допустимый диапазон', deadline: 'Изменить состав до',
    summary: 'Итог', plan: 'Тариф', products: 'Персонализация', delivery: 'Доставка', monthly: 'в месяц', prototype: 'Цена будет проверена сервером перед оплатой.', continue: 'Продолжить', back: 'Назад', activate: 'Подтвердить заказ', save: 'Сохранить изменения', cancel: 'Отменить подписку', cancelTitle: 'Отменить подписку?', cancelBody: 'Новые заказы больше не будут создаваться. История останется в приложении.', keep: 'Оставить подписку', confirmCancel: 'Отменить', addressError: 'Укажи полный адрес.', phoneError: 'Укажи действующий номер телефона.', insufficient: 'Нужно больше точных дат цикла. Пока выбрана ближайшая безопасная дата.', privacy: 'Курьер получает только имя, телефон, адрес, окно доставки и комментарий.',
    recommendationNotAuto: 'Рекомендация не добавляется автоматически. Ты сама решаешь, что включить.', addRecommended: 'Добавить рекомендованное', keepIncluded: 'Оставить включённое', preferencesSection: 'Предпочтения средств', preferencesHelp: 'Эти настройки помогают подобрать состав внутри тарифа и сами по себе не добавляют цену.', paidExtrasSection: 'Платные дополнения', paidExtrasHelp: 'Добавляются к цене только после твоего выбора.', profileLengthText: (days: number) => `По твоему профилю: обычно ${days} дней.`, todayPayment: 'Сегодня к оплате', nextMonths: 'Следующие месяцы', subscriptionConsent: 'Я понимаю, что это подписка с ежемесячным списанием, и состав можно изменить до сборки.', substitutions: 'Разрешить замену товара', substitutionsHelp: 'Только на товар той же категории. По умолчанию замены запрещены.',
  },
  en: {
    appBar: 'Configure LOUSA BOX', steps: ['Plan', 'Contents', 'Delivery', 'Review'],
    titles: ['Choose your level of care', 'Personalize your box', 'Where and when to deliver', 'Review your order'],
    subtitles: ['You can change or pause the plan later.', 'Quantity is based on confirmed history and preferences.', 'The target date uses the earliest forecast boundary and a delivery buffer.', 'Review price, address and subscription terms before confirming.'],
    popular: 'Popular', product: 'Primary product', pads: 'Pads', tampons: 'Tampons', mixed: 'Mixed set', cup: 'Cup', disc: 'Disc',
    quantity: 'Products for one cycle', quantityHelp: 'The plan allowance is selected by default. Recommendations are not added automatically.', periodLength: 'From profile', included: 'Included in plan', selected: 'Selected', extra: 'Extra', addOns: 'Paid extras', deliveryFee: 'Delivery', totalToday: 'Total today', recommendation: 'Recommended amount', applicator: 'Tampon applicator', withApplicator: 'Applicator', withoutApplicator: 'No applicator', noPreference: 'No preference', reusable: 'Cup/disc · one-time', cosmeticAllergies: 'Cosmetic allergies', disliked: 'Do not include', cosmeticPlaceholder: 'For example: essential oils, retinol', dislikedPlaceholder: 'For example: candle, sweets', night: 'Night protection', fragrance: 'Fragrance-free', sensitive: 'Sensitive skin', wings: 'With wings',
    heat: 'Heat pad · one-time', tea: 'Herbal tea · every box', chocolate: 'Dark chocolate · every box', allergies: 'Allergies and restrictions', allergiesPlaceholder: 'For example: nuts, lactose',
    address: 'Delivery address', addressPlaceholder: 'City, street, building, apartment', chooseMap: 'Choose home on the real map', changeMap: 'Change map location', mapRequired: 'Choose a home on the map and verify the delivery zone first.', mapVerified: 'Address verified by coordinates', phone: 'Phone', phonePlaceholder: '+374…', window: 'Delivery window', note: 'Courier note', notePlaceholder: 'Entry code or landmark', target: 'Target delivery', range: 'Delivery range', deadline: 'Edit contents until',
    summary: 'Summary', plan: 'Plan', products: 'Personalization', delivery: 'Delivery', monthly: 'per month', prototype: 'The price is verified by the server before payment.', continue: 'Continue', back: 'Back', activate: 'Confirm order', save: 'Save changes', cancel: 'Cancel subscription', cancelTitle: 'Cancel subscription?', cancelBody: 'No new orders will be created. Your history will remain in the app.', keep: 'Keep subscription', confirmCancel: 'Cancel', addressError: 'Enter a complete address.', phoneError: 'Enter a valid phone number.', insufficient: 'More exact cycle dates are needed. A safe fallback date is shown.', privacy: 'The courier only receives your name, phone, address, delivery window and note.',
    recommendationNotAuto: 'Recommendations are not added automatically. You decide what to include.', addRecommended: 'Add recommendation', keepIncluded: 'Keep allowance', preferencesSection: 'Product preferences', preferencesHelp: 'These settings help choose items inside the plan and do not add price by themselves.', paidExtrasSection: 'Paid extras', paidExtrasHelp: 'Added to the price only after your choice.', profileLengthText: (days: number) => `From your profile: usually ${days} days.`, todayPayment: 'Due today', nextMonths: 'Next months', subscriptionConsent: 'I understand this is a monthly subscription and I can edit contents before packing.', substitutions: 'Allow product substitutions', substitutionsHelp: 'Only within the same category. Substitutions are disabled by default.',
  },
  hy: {
    appBar: 'LOUSA BOX-ի կարգավորում', steps: ['Փաթեթ', 'Պարունակություն', 'Առաքում', 'Ստուգում'],
    titles: ['Ընտրիր խնամքի մակարդակը', 'Անհատականացրու բոքսը', 'Որտե՞ղ և ե՞րբ առաքել', 'Ստուգիր պատվերը'],
    subtitles: ['Հետագայում կարող ես փոխել կամ դադարեցնել փաթեթը։', 'Քանակը հաշվարկվում է հաստատված պատմությունից և նախասիրություններից։', 'Նպատակային օրը հաշվի է առնում կանխատեսման վաղ սահմանն ու առաքման պահուստը։', 'Ստուգիր գինը, հասցեն և բաժանորդագրության պայմանները հաստատելուց առաջ։'],
    popular: 'Հայտնի', product: 'Հիմնական միջոցը', pads: 'Միջադիրներ', tampons: 'Տամպոններ', mixed: 'Խառը հավաքածու', cup: 'Բաժակ', disc: 'Դիսկ',
    quantity: 'Միջոցներ մեկ ցիկլի համար', quantityHelp: 'Լռելյայն ընտրված է փաթեթի ներառված քանակը։ Առաջարկը ինքնաբերաբար չի ավելացվում։', periodLength: 'Պրոֆիլից', included: 'Ներառված է փաթեթում', selected: 'Ընտրված է', extra: 'Լրացուցիչ', addOns: 'Վճարովի հավելումներ', deliveryFee: 'Առաքում', totalToday: 'Ընդամենը այսօր', recommendation: 'Առաջարկվող քանակ', applicator: 'Տամպոնի ապլիկատոր', withApplicator: 'Ապլիկատորով', withoutApplicator: 'Առանց ապլիկատորի', noPreference: 'Կարևոր չէ', reusable: 'Բաժակ/դիսկ · մեկ անգամ', cosmeticAllergies: 'Կոսմետիկ ալերգիաներ', disliked: 'Ինչ չդնել բոքսում', cosmeticPlaceholder: 'Օրինակ՝ եթերայուղեր, ռետինոլ', dislikedPlaceholder: 'Օրինակ՝ մոմ, քաղցրավենիք', night: 'Գիշերային պաշտպանություն', fragrance: 'Առանց բույրի', sensitive: 'Զգայուն մաշկ', wings: 'Թևիկներով',
    heat: 'Տաքացուցիչ · մեկ անգամ', tea: 'Բուսական թեյ · ամեն բոքսում', chocolate: 'Մուգ շոկոլադ · ամեն բոքսում', allergies: 'Ալերգիաներ և սահմանափակումներ', allergiesPlaceholder: 'Օրինակ՝ ընկույզ, լակտոզ',
    address: 'Առաքման հասցե', addressPlaceholder: 'Քաղաք, փողոց, շենք, բնակարան', chooseMap: 'Ընտրել տունը իրական քարտեզի վրա', changeMap: 'Փոխել կետը քարտեզի վրա', mapRequired: 'Նախ ընտրիր տունը քարտեզի վրա և ստուգիր առաքման գոտին։', mapVerified: 'Հասցեն հաստատված է կոորդինատներով', phone: 'Հեռախոս', phonePlaceholder: '+374…', window: 'Առաքման ժամերը', note: 'Մեկնաբանություն առաքիչին', notePlaceholder: 'Մուտքի կոդ կամ կողմնորոշիչ', target: 'Նպատակային առաքում', range: 'Առաքման միջակայք', deadline: 'Փոխել մինչև',
    summary: 'Ամփոփում', plan: 'Փաթեթ', products: 'Անհատականացում', delivery: 'Առաքում', monthly: 'ամսական', prototype: 'Գինը վճարումից առաջ ստուգվում է սերվերում։', continue: 'Շարունակել', back: 'Հետ', activate: 'Հաստատել պատվերը', save: 'Պահպանել', cancel: 'Չեղարկել բաժանորդագրությունը', cancelTitle: 'Չեղարկե՞լ բաժանորդագրությունը', cancelBody: 'Նոր պատվերներ չեն ստեղծվի, իսկ պատմությունը կմնա հավելվածում։', keep: 'Պահպանել բաժանորդագրությունը', confirmCancel: 'Չեղարկել', addressError: 'Նշիր ամբողջական հասցե։', phoneError: 'Նշիր վավեր հեռախոսահամար։', insufficient: 'Անհրաժեշտ են ավելի շատ ճշգրիտ ամսաթվեր։ Ցուցադրվում է անվտանգ պահեստային օր։', privacy: 'Առաքիչը ստանում է միայն անունը, հեռախոսը, հասցեն, ժամային պատուհանն ու մեկնաբանությունը։',
    recommendationNotAuto: 'Առաջարկը ինքնաբերաբար չի ավելացվում։ Դու ես որոշում կազմը։', addRecommended: 'Ավելացնել առաջարկը', keepIncluded: 'Թողնել ներառվածը', preferencesSection: 'Միջոցների նախասիրություններ', preferencesHelp: 'Այս կարգավորումները օգնում են ընտրել կազմը և ինքնուրույն գին չեն ավելացնում։', paidExtrasSection: 'Վճարովի հավելումներ', paidExtrasHelp: 'Գնին ավելանում են միայն քո ընտրությունից հետո։', profileLengthText: (days: number) => `Քո պրոֆիլում՝ սովորաբար ${days} օր։`, todayPayment: 'Այսօր վճարման ենթակա', nextMonths: 'Հաջորդ ամիսներ', subscriptionConsent: 'Հասկանում եմ, որ սա ամսական բաժանորդագրություն է, և կազմը կարելի է փոխել մինչև հավաքումը։', substitutions: 'Թույլատրել ապրանքի փոխարինումը', substitutionsHelp: 'Միայն նույն կատեգորիայի ապրանքով։ Լռելյայն փոխարինումը արգելված է։',
  },
} as const;

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  return <PressScale onPress={onPress} style={[styles.chip, { backgroundColor: selected ? (isDark ? 'rgba(217,133,165,0.18)' : '#F8E7ED') : (isDark ? 'rgba(255,255,255,0.05)' : '#FFFDFE'), borderColor: selected ? LousaPalette.rose : (isDark ? LousaPalette.lineDark : LousaPalette.line) }]}>{selected ? <MaterialSymbol name="check" size={16} color={LousaPalette.berry} /> : null}<Text style={[styles.chipText, { color: selected ? LousaPalette.berry : colors.onSurfaceVariant }]}>{label}</Text></PressScale>;
}

function ToggleRow({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return <PressScale onPress={onPress} style={styles.toggleRow}><Text style={[styles.toggleTitle, { color: colors.onBackground }]}>{label}</Text><View style={[styles.switchTrack, value && styles.switchOn]}><View style={[styles.switchThumb, value && styles.switchThumbOn]} /></View></PressScale>;
}

function SummaryRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  const { colors } = useTheme();
  return <View style={styles.summaryRow}><IconBubble icon={icon} tone="rose" size={38} /><Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>{label}</Text><Text style={[styles.summaryValue, { color: colors.onBackground }]}>{value}</Text></View>;
}

export default function SubscriptionScreen() {
  const { colors, isDark } = useTheme();
  const { compactWidth } = useResponsiveLayout();
  const language = useUserStore((s) => s.language);
  const copy = COPY[language] || COPY.ru;
  const box = useBoxStore();
  const cycle = useCycleStore();
  const setPremium = useUserStore((s) => s.setPremium);
  const [step, setStep] = useState(0);
  const [planId, setPlanId] = useState<BoxPlanId>(box.planId || 'comfort');
  const [productType, setProductType] = useState<ProductType>((box.preferences.primaryProduct === 'cup' || box.preferences.primaryProduct === 'disc') ? 'mixed' : (box.preferences.primaryProduct || box.productType || 'pads'));
  const periodLength = Math.max(3, Math.min(8, box.preferences.periodLengthEstimate || cycle.avgPeriodLength || 5));
  const initialPlan = BOX_PLANS.find((item) => item.id === (box.planId || 'comfort')) || BOX_PLANS[1];
  const [cycleUnits, setCycleUnits] = useState(initialPlan.includedUnits);
  const [nightProtection, setNightProtection] = useState(box.preferences.nightProtection);
  const [fragranceFree, setFragranceFree] = useState(box.preferences.fragranceFree);
  const [skinSensitivity, setSkinSensitivity] = useState(box.preferences.skinSensitivity);
  const [wingPreference, setWingPreference] = useState(box.preferences.wingPreference === 'wings');
  const [applicatorPreference, setApplicatorPreference] = useState(box.preferences.applicatorPreference);
  const [reusableProducts, setReusableProducts] = useState(false);
  const [heatPad, setHeatPad] = useState(false);
  const [tea, setTea] = useState(false);
  const [chocolate, setChocolate] = useState(false);
  const [subscriptionConsent, setSubscriptionConsent] = useState(false);
  const [allowSubstitutions, setAllowSubstitutions] = useState(box.preferences.allowSubstitutions === true);
  const [allergies, setAllergies] = useState(box.preferences.foodAllergies.join(', '));
  const [cosmeticAllergies, setCosmeticAllergies] = useState(box.preferences.cosmeticAllergies.join(', '));
  const [dislikedItems, setDislikedItems] = useState(box.preferences.dislikedItems.join(', '));
  const [address, setAddress] = useState(box.address || '');
  const [phone, setPhone] = useState(box.phone || '');
  const [deliveryWindow, setDeliveryWindow] = useState(box.deliveryWindow || WINDOWS[0]);
  const [note, setNote] = useState(box.deliveryNote || '');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [serverQuote, setServerQuote] = useState<ServerOrderQuote | null>(null);

  useEffect(() => {
    if (!box.deliveryAddress) return;
    setAddress(box.deliveryAddress.formattedAddress);
    setPhone((current) => box.deliveryAddress?.phone || current);
    setNote(box.deliveryAddress.instructions || '');
    setDeliveryWindow((current) => box.deliveryAddress?.validationStatus === 'verified' ? current : WINDOWS[0]);
  }, [box.deliveryAddress]);

  const prediction = useMemo(() => calculateCyclePrediction(cycle.periodRecords, { fallbackCycleLength: cycle.avgCycleLength, fallbackPeriodLength: cycle.avgPeriodLength, cycleContext: cycle.onboardingProfile.cycleContext, factors: cycle.onboardingProfile.factors }), [cycle.periodRecords, cycle.avgCycleLength, cycle.avgPeriodLength, cycle.onboardingProfile]);
  const deliveryPlan = useMemo(() => planBoxDelivery({ prediction, paused: box.paused, skipNext: box.subscription?.skipNextBox }), [prediction, box.paused, box.subscription?.skipNextBox]);
  const selectedPlan = BOX_PLANS.find((item) => item.id === planId) || BOX_PLANS[1];
  const recommendedUnits = Math.max(selectedPlan.includedUnits, periodLength * 4);
  const hasRecommendationDelta = recommendedUnits > selectedPlan.includedUnits;
  useEffect(() => {
    setCycleUnits((current) => Math.max(selectedPlan.includedUnits, Math.min(current, 60)));
  }, [selectedPlan.includedUnits]);
  const quote = calculateBoxQuote({
    plan: selectedPlan,
    selectedUnits: cycleUnits,
    addOns: { heatPad, reusable: reusableProducts, tea, chocolate },
  });
  const extraUnits = quote.extraUnits;
  const sanitaryAddOn = quote.sanitaryAddOnAmd;
  const addOnTotal = quote.addOnTotalAmd;
  const orderTotal = step === 3 && serverQuote ? Math.round(serverQuote.totalMinor / 100) : quote.totalAmd;
  const productLabels: Record<ProductType, string> = { pads: copy.pads, tampons: copy.tampons, mixed: copy.mixed, cup: copy.cup, disc: copy.disc };


  useEffect(() => {
    setServerQuote(null);
  }, [planId, productType, cycleUnits, nightProtection, applicatorPreference, reusableProducts, heatPad, tea, chocolate, box.deliveryAddress?.id]);
  const buildSelectedItems = () => {
    const nightUnits = nightProtection ? Math.min(Math.max(2, Math.round(cycleUnits * 0.25)), cycleUnits) : 0;
    const dayUnits = Math.max(0, cycleUnits - nightUnits);
    const items: Array<{ sku: string; quantity: number }> = [];
    if (productType === 'pads') {
      if (dayUnits) items.push({ sku: 'pad-day', quantity: dayUnits });
      if (nightUnits) items.push({ sku: 'pad-night', quantity: nightUnits });
    } else if (productType === 'tampons') {
      items.push({ sku: applicatorPreference === 'non_applicator' ? 'tampon-non-applicator' : 'tampon-regular', quantity: cycleUnits });
    } else if (productType === 'mixed') {
      const tamponUnits = Math.floor(cycleUnits / 2);
      const padUnits = cycleUnits - tamponUnits;
      const mixedNight = nightProtection ? Math.min(Math.max(2, Math.round(padUnits * 0.3)), padUnits) : 0;
      if (padUnits - mixedNight) items.push({ sku: 'pad-day', quantity: padUnits - mixedNight });
      if (mixedNight) items.push({ sku: 'pad-night', quantity: mixedNight });
      if (tamponUnits) items.push({ sku: applicatorPreference === 'non_applicator' ? 'tampon-non-applicator' : 'tampon-regular', quantity: tamponUnits });
    } else {
      items.push({ sku: productType === 'cup' ? 'menstrual-cup' : 'menstrual-disc', quantity: 1 });
      items.push({ sku: 'pad-day', quantity: Math.min(4, cycleUnits) });
    }
    if (heatPad) items.push({ sku: 'heat-pad', quantity: 1 });
    if (tea) items.push({ sku: 'tea', quantity: 1 });
    if (chocolate) items.push({ sku: 'chocolate', quantity: 1 });
    return items;
  };

  const requestServerQuote = async () => {
    if (getServiceMode() !== 'api') throw new Error('Для оформления нужен подключённый backend LOUSA. Demo не создаёт реальные заказы.');
    if (!box.deliveryAddress?.id || box.deliveryAddress.validationStatus !== 'verified') throw new Error(copy.mapRequired);
    const result = await services.checkout.createQuote({
      planId,
      deliveryAddressId: box.deliveryAddress.id,
      selectedItems: buildSelectedItems(),
      preferences: {
        ...box.preferences,
        primaryProduct: productType,
        menstrualProducts: productType === 'mixed' ? ['pads', 'tampons'] : [productType],
        dailyQuantityEstimate: Math.max(1, Math.ceil(cycleUnits / Math.max(1, periodLength))),
        periodLengthEstimate: periodLength,
        nightProtection,
        fragranceFree,
        skinSensitivity,
        wingPreference: wingPreference ? 'wings' : 'no_preference',
        applicatorPreference,
        reusableProducts,
        heatPadPreference: heatPad ? 'include' : 'exclude',
        teaPreference: tea ? 'herbal' : 'none',
        chocolatePreference: chocolate ? 'dark' : 'none',
        foodAllergies: allergies.split(',').map((value) => value.trim()).filter(Boolean),
        cosmeticAllergies: cosmeticAllergies.split(',').map((value) => value.trim()).filter(Boolean),
        dislikedItems: dislikedItems.split(',').map((value) => value.trim()).filter(Boolean),
        structuredAllergens: structureAllergens([
          ...allergies.split(','),
          ...cosmeticAllergies.split(','),
        ]),
        allowSubstitutions,
        substitutionPolicy: allowSubstitutions ? 'same_category' as const : 'none' as const,
      },
    });
    if (!result.ok) throw new Error(result.error.message);
    if (result.data.deliveryFeeMinor !== 0) throw new Error('Сервер вернул недопустимую стоимость доставки. Оформление остановлено.');
    if (result.data.validationErrors.length) throw new Error(`Нельзя оформить заказ: ${result.data.validationErrors.join(', ')}`);
    setServerQuote(result.data);
    return result.data;
  };

  const next = async () => {
    setError('');
    if (step === 2) {
      if (!box.deliveryAddress || box.deliveryAddress.validationStatus !== 'verified') return setError(copy.mapRequired);
      if (address.trim().length < 6) return setError(copy.addressError);
      if (phone.replace(/\D/g, '').length < 8) return setError(copy.phoneError);
    }
    if (step === 2) {
      setProcessing(true);
      try {
        await requestServerQuote();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'QUOTE_ERROR');
        setProcessing(false);
        return;
      }
      setProcessing(false);
    }
    setStep((value) => Math.min(3, value + 1));
  };

  const activate = async () => {
    if (processing) return;
    setProcessing(true);
    setError('');
    try {
      if (!subscriptionConsent) throw new Error(copy.subscriptionConsent);
      const quote = serverQuote && new Date(serverQuote.expiresAt).getTime() > Date.now()
        ? serverQuote
        : await requestServerQuote();
      if (quote.deliveryFeeMinor !== 0 || quote.validationErrors.length) throw new Error('Серверная цена не прошла проверку. Обнови расчёт.');

      const preferences = {
        ...box.preferences,
        primaryProduct: productType,
        menstrualProducts: productType === 'mixed' ? ['pads', 'tampons'] as ProductType[] : [productType],
        dailyQuantityEstimate: Math.max(1, Math.ceil(cycleUnits / Math.max(1, periodLength))),
        periodLengthEstimate: periodLength,
        nightProtection,
        fragranceFree,
        skinSensitivity,
        wingPreference: wingPreference ? 'wings' as const : 'no_preference' as const,
        applicatorPreference,
        reusableProducts,
        heatPadPreference: heatPad ? 'include' as const : 'exclude' as const,
        teaPreference: tea ? 'herbal' as const : 'none' as const,
        chocolatePreference: chocolate ? 'dark' as const : 'none' as const,
        foodAllergies: allergies.split(',').map((value) => value.trim()).filter(Boolean),
        cosmeticAllergies: cosmeticAllergies.split(',').map((value) => value.trim()).filter(Boolean),
        dislikedItems: dislikedItems.split(',').map((value) => value.trim()).filter(Boolean),
        structuredAllergens: structureAllergens([
          ...allergies.split(','),
          ...cosmeticAllergies.split(','),
        ]),
        allowSubstitutions,
        substitutionPolicy: allowSubstitutions ? 'same_category' as const : 'none' as const,
      };
      const preferenceResult = await services.boxPreferences.savePreferences(preferences);
      if (!preferenceResult.ok) throw new Error(preferenceResult.error.message);

      const idempotencyKey = `checkout-${quote.quoteId}`;
      const orderResult = await services.checkout.createOrder({
        quoteId: quote.quoteId,
        idempotencyKey,
        recipient: { name: box.deliveryAddress?.recipientName || undefined },
        handoff: {
          type: box.deliveryAddress?.handoffType || 'hand_to_recipient',
          exactPlace: box.deliveryAddress?.leaveAtDoorLocation || undefined,
          note: note.trim() || undefined,
        },
      });
      if (!orderResult.ok) throw new Error(orderResult.error.message);

      const methodsResult = await services.payments.listPaymentMethods();
      if (!methodsResult.ok || !methodsResult.data.length) throw new Error(methodsResult.ok ? 'Способ оплаты пока не настроен.' : methodsResult.error.message);
      const paymentResult = await services.payments.createPayment({ orderId: orderResult.data.id, amountMinor: quote.totalMinor, idempotencyKey: `payment-${quote.quoteId}` });
      if (!paymentResult.ok) throw new Error(paymentResult.error.message);
      const confirmedPayment = await services.payments.confirmPayment(paymentResult.data.id, methodsResult.data[0].id);
      if (!confirmedPayment.ok || confirmedPayment.data.status !== 'succeeded') throw new Error(confirmedPayment.ok ? 'Платёж не подтверждён.' : confirmedPayment.error.message);

      const now = new Date().toISOString();
      const subscription = {
        id: box.subscription?.id || `subscription-${orderResult.data.id}`,
        plan: planId,
        status: 'active' as const,
        pauseUntil: null,
        skipNextBox: false,
        deliveryAddressId: box.deliveryAddress!.id,
        deliveryWindow,
        nextBillingDate: null,
        nextPreparationDate: deliveryPlan.preparationDeadline,
        nextDeliveryDate: deliveryPlan.targetDate,
        createdAt: box.subscription?.createdAt || now,
        updatedAt: now,
        orderId: orderResult.data.id,
      };
      const subscriptionResult = await services.subscription.saveSubscription(subscription);
      if (!subscriptionResult.ok) throw new Error(subscriptionResult.error.message);

      useBoxStore.setState((state) => ({
        isSubscribed: true,
        planId,
        address: box.deliveryAddress?.formattedAddress || address.trim(),
        phone: box.deliveryAddress?.phone || phone.trim(),
        deliveryNote: note.trim(),
        deliveryWindow,
        nextDeliveryDate: deliveryPlan.targetDate || state.nextDeliveryDate,
        paused: false,
        preferences,
        subscription: subscriptionResult.data,
        orders: [{ ...orderResult.data, paymentStatus: 'paid', status: 'paid', demo: Boolean(confirmedPayment.data.demo) }, ...state.orders.filter((item) => item.id !== orderResult.data.id)],
      }));
      setPremium(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)/box');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ORDER_CONFIRMATION_ERROR');
    } finally {
      setProcessing(false);
    }
  };


  const cancelSubscription = async () => {
    if (processing) return;
    setProcessing(true);
    setError('');
    const result = await services.subscription.updateSubscription({ action: 'cancel', reason: 'customer_request' });
    if (!result.ok) {
      setError(result.error.message);
      setProcessing(false);
      return;
    }
    useBoxStore.getState().applyServerSubscription(null);
    setPremium(false);
    setProcessing(false);
    router.replace('/(tabs)/box');
  };

  const contents = [
    <View key="plan" style={styles.stepBody}>{BOX_PLANS.map((plan) => { const selected = plan.id === planId; return <PressScale key={plan.id} onPress={() => setPlanId(plan.id)} style={styles.planPress}><SurfaceCard padding={0} tone={selected ? 'accent' : 'default'} style={[styles.planCard, selected && styles.planSelected]}><Image source={PLAN_IMAGES[plan.id]} style={styles.planImage} resizeMode="contain" /><View style={styles.planContent}><View style={styles.planHead}><View style={{ flex: 1 }}><View style={styles.planNameRow}><Text style={[styles.planName, { color: colors.onBackground }]}>{plan.name}</Text>{plan.id === 'comfort' ? <StatusPill label={copy.popular} tone="rose" /> : null}</View><Text style={[styles.planDescription, { color: colors.onSurfaceVariant }]}>{localizedText(plan.description, language)}</Text><Text style={styles.planPrice}>{formatAmd(plan.monthlyPriceAmd, language)} / {copy.monthly}</Text></View><View style={[styles.radio, { borderColor: selected ? LousaPalette.berry : colors.outlineVariant }]}>{selected ? <View style={styles.radioInner} /> : null}</View></View></View></SurfaceCard></PressScale>; })}</View>,
    <View key="contents" style={styles.stepBody}><SurfaceCard padding={20}>
      <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>{copy.product}</Text><View style={styles.chips}>{(['pads','tampons','mixed'] as ProductType[]).map((item) => <ChoiceChip key={item} label={productLabels[item]} selected={productType === item} onPress={() => setProductType(item)} />)}</View>
      {(productType === 'tampons' || productType === 'mixed') ? <><Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.applicator}</Text><View style={styles.chips}><ChoiceChip label={copy.withApplicator} selected={applicatorPreference === 'applicator'} onPress={() => setApplicatorPreference('applicator')} /><ChoiceChip label={copy.withoutApplicator} selected={applicatorPreference === 'non_applicator'} onPress={() => setApplicatorPreference('non_applicator')} /><ChoiceChip label={copy.noPreference} selected={applicatorPreference === 'no_preference'} onPress={() => setApplicatorPreference('no_preference')} /></View></> : null}
      <SurfaceCard padding={14} tone="accent" style={styles.allowanceCard}>
        <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.onSurfaceVariant }]}>{copy.included}</Text><Text style={[styles.allowanceValue, { color: colors.onBackground }]}>{selectedPlan.includedUnits}</Text></View>
        <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.onSurfaceVariant }]}>{copy.recommendation}</Text><Text style={[styles.allowanceValue, { color: colors.onBackground }]}>{recommendedUnits}</Text></View>
        <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.onSurfaceVariant }]}>{copy.selected}</Text><Text style={[styles.allowanceValue, { color: colors.onBackground }]}>{cycleUnits}</Text></View>
        <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.onSurfaceVariant }]}>{copy.extra}</Text><Text style={[styles.allowanceValue, { color: extraUnits > 0 ? LousaPalette.berry : LousaPalette.success }]}>{extraUnits > 0 ? `${extraUnits} · ${formatAmd(sanitaryAddOn, language)}` : formatAmd(0, language)}</Text></View>
        <Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{copy.recommendationNotAuto}</Text>
        {hasRecommendationDelta ? <View style={styles.recommendActions}><PressScale onPress={() => setCycleUnits(selectedPlan.includedUnits)} style={[styles.smallAction, cycleUnits === selectedPlan.includedUnits && styles.smallActionActive]}><Text style={[styles.smallActionText, cycleUnits === selectedPlan.includedUnits && styles.smallActionTextActive]}>{copy.keepIncluded}</Text></PressScale><PressScale onPress={() => setCycleUnits(recommendedUnits)} style={[styles.smallAction, cycleUnits >= recommendedUnits && styles.smallActionActive]}><Text style={[styles.smallActionText, cycleUnits >= recommendedUnits && styles.smallActionTextActive]}>{copy.addRecommended}</Text></PressScale></View> : null}
      </SurfaceCard>
      <View style={styles.fieldGap}><QuantitySelector value={cycleUnits} min={selectedPlan.includedUnits} max={60} step={1} onChange={setCycleUnits} label={copy.quantity} helper={copy.quantityHelp} /></View>
      <Text style={[styles.profileLength, { color: colors.onSurfaceVariant }]}>{copy.profileLengthText(periodLength)}</Text>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.preferencesSection}</Text><Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{copy.preferencesHelp}</Text>
      <View style={styles.toggleGroup}><ToggleRow label={copy.night} value={nightProtection} onPress={() => setNightProtection((value) => !value)} /><ToggleRow label={copy.fragrance} value={fragranceFree} onPress={() => setFragranceFree((value) => !value)} /><ToggleRow label={copy.sensitive} value={skinSensitivity} onPress={() => setSkinSensitivity((value) => !value)} /><ToggleRow label={copy.wings} value={wingPreference} onPress={() => setWingPreference((value) => !value)} /></View>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.paidExtrasSection}</Text><Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{copy.paidExtrasHelp}</Text>
      <View style={styles.toggleGroup}><ToggleRow label={copy.reusable} value={reusableProducts} onPress={() => setReusableProducts((value) => !value)} /><ToggleRow label={copy.heat} value={heatPad} onPress={() => setHeatPad((value) => !value)} /><ToggleRow label={copy.tea} value={tea} onPress={() => setTea((value) => !value)} /><ToggleRow label={copy.chocolate} value={chocolate} onPress={() => setChocolate((value) => !value)} /></View>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.allergies}</Text><TextInput value={allergies} onChangeText={setAllergies} placeholder={copy.allergiesPlaceholder} placeholderTextColor={colors.outline} multiline style={[styles.input, styles.textArea, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]} />
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.cosmeticAllergies}</Text><TextInput value={cosmeticAllergies} onChangeText={setCosmeticAllergies} placeholder={copy.cosmeticPlaceholder} placeholderTextColor={colors.outline} multiline style={[styles.input, styles.textArea, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]} />
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.disliked}</Text><TextInput value={dislikedItems} onChangeText={setDislikedItems} placeholder={copy.dislikedPlaceholder} placeholderTextColor={colors.outline} multiline style={[styles.input, styles.textArea, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]} />
    </SurfaceCard></View>,
    <View key="delivery" style={styles.stepBody}><SurfaceCard padding={20}>
      <View style={styles.deliveryTarget}><IconBubble icon="event_available" tone="rose" /><View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>{copy.target}</Text><Text style={[styles.deliveryDate, { color: colors.onBackground }]}>{deliveryPlan.targetDate ? formatHumanDate(deliveryPlan.targetDate, language) : '—'}</Text>{deliveryPlan.earliestDate && deliveryPlan.latestDate ? <Text style={[styles.deliveryRange, { color: colors.onSurfaceVariant }]}>{copy.range}: {formatHumanDate(deliveryPlan.earliestDate, language)}–{formatHumanDate(deliveryPlan.latestDate, language)}</Text> : <Text style={[styles.deliveryRange, { color: LousaPalette.warning }]}>{copy.insufficient}</Text>}{deliveryPlan.customizationDeadline ? <Text style={[styles.deliveryRange, { color: colors.onSurfaceVariant }]}>{copy.deadline}: {formatHumanDate(deliveryPlan.customizationDeadline, language)}</Text> : null}</View></View>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.address}</Text>
      <PressScale onPress={() => router.push('/screens/address-map')} style={[styles.mapAddressCard, { borderColor: box.deliveryAddress?.validationStatus === 'verified' ? LousaPalette.rose : colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}>
        <View style={styles.mapAddressIcon}><MaterialSymbol name="map" size={23} color={LousaPalette.berry} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mapAddressTitle, { color: colors.onBackground }]}>{box.deliveryAddress ? copy.changeMap : copy.chooseMap}</Text>
          <Text style={[styles.mapAddressText, { color: colors.onSurfaceVariant }]} numberOfLines={3}>{box.deliveryAddress?.formattedAddress || copy.addressPlaceholder}</Text>
          {box.deliveryAddress?.validationStatus === 'verified' ? <Text style={styles.mapVerifiedText}>{copy.mapVerified} · {box.deliveryAddress.latitude.toFixed(5)}, {box.deliveryAddress.longitude.toFixed(5)}</Text> : null}
        </View>
        <MaterialSymbol name="chevron_right" size={22} color={colors.onSurfaceVariant} />
      </PressScale>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.phone}</Text><TextInput value={phone} onChangeText={setPhone} placeholder={copy.phonePlaceholder} keyboardType="phone-pad" placeholderTextColor={colors.outline} style={[styles.input, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]} />
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.window}</Text><View style={styles.chips}>{WINDOWS.map((item) => <ChoiceChip key={item} label={item} selected={deliveryWindow === item} onPress={() => setDeliveryWindow(item)} />)}</View>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.note}</Text><TextInput value={note} onChangeText={setNote} placeholder={copy.notePlaceholder} placeholderTextColor={colors.outline} multiline style={[styles.input, styles.textArea, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]} />
      <View style={styles.privacyRow}><MaterialSymbol name="privacy_tip" size={18} color={LousaPalette.berry} /><Text style={[styles.privacyText, { color: colors.onSurfaceVariant }]}>{copy.privacy}</Text></View>
    </SurfaceCard></View>,
    <View key="review" style={styles.stepBody}><Image source={PLAN_IMAGES[selectedPlan.id]} style={styles.reviewImage} resizeMode="contain" />{box.deliveryAddress ? <RealMapPreview latitude={box.deliveryAddress.latitude} longitude={box.deliveryAddress.longitude} label={box.deliveryAddress.formattedAddress} /> : null}<SurfaceCard padding={4}><SummaryRow label={copy.plan} value={`${selectedPlan.name} · ${formatAmd(selectedPlan.monthlyPriceAmd, language)}`} icon="inventory_2" /><View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} /><SummaryRow label={copy.products} value={`${productLabels[productType]} · ${cycleUnits} ${language === 'en' ? 'units' : language === 'hy' ? 'միավոր' : 'единиц'}`} icon="favorite" /><View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} /><SummaryRow label={copy.delivery} value={`${box.deliveryAddress?.formattedAddress || address || '—'} · ${deliveryWindow} · ${copy.included}`} icon="local_shipping" /></SurfaceCard><SurfaceCard padding={14}><PressScale onPress={() => setAllowSubstitutions((value) => !value)} style={styles.consentRow} accessibilityRole="checkbox" accessibilityState={{ checked: allowSubstitutions }}><View style={[styles.checkbox, allowSubstitutions && styles.checkboxChecked]}>{allowSubstitutions ? <MaterialSymbol name="check" size={16} color="#fff" /> : null}</View><View style={{ flex: 1 }}><Text style={[styles.consentText, { color: colors.onBackground }]}>{copy.substitutions}</Text><Text style={[styles.explainText, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{copy.substitutionsHelp}</Text></View></PressScale></SurfaceCard><SurfaceCard padding={14}><PressScale onPress={() => setSubscriptionConsent((value) => !value)} style={styles.consentRow} accessibilityRole="checkbox" accessibilityState={{ checked: subscriptionConsent }}><View style={[styles.checkbox, subscriptionConsent && styles.checkboxChecked]}>{subscriptionConsent ? <MaterialSymbol name="check" size={16} color="#fff" /> : null}</View><Text style={[styles.consentText, { color: colors.onSurfaceVariant }]}>{copy.subscriptionConsent}</Text></PressScale></SurfaceCard><SurfaceCard padding={16} tone="accent"><View style={[styles.priceRow, compactWidth && styles.priceColumn]}><View><Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>{copy.summary}</Text><Text style={[styles.total, { color: colors.onBackground }]}>{formatAmd(orderTotal, language)}</Text></View><StatusPill label={copy.prototype} tone="neutral" /></View></SurfaceCard></View>,
  ][step];

  return <ModalScreen title={copy.appBar} closeIcon="close" keyboard><ScreenScroll keyboardShouldPersistTaps="handled"><View style={styles.progressHeader}><View style={styles.stepLabels}>{copy.steps.map((label, index) => <Text key={label} style={[styles.stepLabel, { color: index === step ? LousaPalette.berry : colors.onSurfaceVariant }]} numberOfLines={1}>{label}</Text>)}</View><View style={styles.progressRail}>{copy.steps.map((_, index) => <View key={index} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]} />)}</View></View><View style={styles.intro}><Text style={[styles.title, { color: colors.onBackground }]}>{copy.titles[step]}</Text><Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{copy.subtitles[step]}</Text></View>{contents}{error ? <Text style={styles.error}>{error}</Text> : null}<SurfaceCard padding={15} tone="accent" style={styles.stickyPriceCard}><View style={styles.stickyPriceRows}><View style={styles.stickyPriceLine}><Text style={[styles.stickyPriceLabel, { color: colors.onSurfaceVariant }]}>{copy.plan}</Text><Text style={[styles.stickyPriceValue, { color: colors.onBackground }]}>{formatAmd(selectedPlan.monthlyPriceAmd, language)}</Text></View><View style={styles.stickyPriceLine}><Text style={[styles.stickyPriceLabel, { color: colors.onSurfaceVariant }]}>{copy.addOns}</Text><Text style={[styles.stickyPriceValue, { color: addOnTotal > 0 ? LousaPalette.berry : colors.onBackground }]}>{formatAmd(addOnTotal, language)}</Text></View><View style={styles.stickyPriceLine}><Text style={[styles.stickyPriceLabel, { color: colors.onSurfaceVariant }]}>{copy.deliveryFee}</Text><Text style={[styles.stickyPriceValue, { color: colors.onBackground }]}>{copy.included}</Text></View></View><View style={[styles.stickyTotalLine, { borderTopColor: colors.outlineVariant }]}><Text style={[styles.stickyTotalLabel, { color: colors.onBackground }]}>{copy.todayPayment}</Text><Text style={[styles.stickyTotalValue, { color: LousaPalette.berry }]}>{formatAmd(orderTotal, language)}</Text></View></SurfaceCard><View style={[styles.actions, compactWidth && styles.actionsColumn]}>{step > 0 ? <PressScale onPress={() => { setError(''); setStep((value) => value - 1); }} style={[styles.backButton, { borderColor: colors.outlineVariant }]}><MaterialSymbol name="arrow_back" size={18} color={colors.onBackground} /><Text style={[styles.backText, { color: colors.onBackground }]}>{copy.back}</Text></PressScale> : null}<View style={{ flex: 1, width: compactWidth ? '100%' : undefined }}><PrimaryAction label={processing ? `${step === 3 ? (box.isSubscribed ? copy.save : copy.activate) : copy.continue}…` : `${step === 3 ? (box.isSubscribed ? copy.save : copy.activate) : copy.continue} · ${formatAmd(orderTotal, language)}`} icon={step === 3 ? 'check' : 'arrow_forward'} onPress={step === 3 ? activate : next} /></View></View>{box.isSubscribed && step === 3 ? <PressScale disabled={processing} accessibilityState={{ disabled: processing, busy: processing }} onPress={() => Alert.alert(copy.cancelTitle, copy.cancelBody, [{ text: copy.keep, style: 'cancel' }, { text: copy.confirmCancel, style: 'destructive', onPress: () => void cancelSubscription() }])} style={styles.cancelButton}><Text style={styles.cancelText}>{copy.cancel}</Text></PressScale> : null}</ScreenScroll></ModalScreen>;
}

const styles = StyleSheet.create({
  progressHeader: { marginTop: 8 }, stepLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 }, stepLabel: { flex: 1, textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 12 }, progressRail: { flexDirection: 'row', gap: 6, marginTop: 10 }, progressSegment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E9E0E5' }, progressSegmentActive: { backgroundColor: LousaPalette.berry },
  intro: { marginTop: 24, marginBottom: 20 }, title: { fontFamily: 'sans-serif-medium', fontSize: 29, lineHeight: 35, letterSpacing: -0.3 }, subtitle: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 20, marginTop: 7 }, stepBody: { gap: 12 },
  planPress: { marginBottom: 12 }, planCard: { overflow: 'hidden' }, planSelected: { borderColor: LousaPalette.rose, borderWidth: 1.5 }, planImage: { width: '100%', height: 170, backgroundColor: '#F8EFF2' }, planContent: { padding: 17 }, planHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, planNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, planName: { fontFamily: 'serif', fontSize: 24 }, planDescription: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18, marginTop: 3 }, planPrice: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 14, marginTop: 12 }, radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: LousaPalette.berry },
  fieldLabel: { fontFamily: 'sans-serif-medium', fontSize: 14 }, fieldGap: { marginTop: 20 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 }, chip: { minHeight: 48, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 }, chipText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  toggleGroup: { marginTop: 18, gap: 1 }, toggleRow: { minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LousaPalette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, toggleTitle: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 13 }, switchTrack: { width: 48, height: 29, borderRadius: 15, backgroundColor: '#DDD3D8', padding: 3 }, switchOn: { backgroundColor: LousaPalette.berry }, switchThumb: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#fff' }, switchThumbOn: { alignSelf: 'flex-end' },
  mapAddressCard: { minHeight: 92, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 14, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapAddressIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8E7ED' },
  mapAddressTitle: { fontFamily: 'sans-serif-medium', fontSize: 13.5 },
  mapAddressText: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 3 },
  mapVerifiedText: { color: LousaPalette.success, fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 16, marginTop: 5 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, fontFamily: 'sans-serif', fontSize: 14, marginTop: 9 }, textArea: { minHeight: 90, paddingTop: 14, textAlignVertical: 'top' },
  deliveryTarget: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 }, eyebrow: { fontFamily: 'sans-serif-medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1 }, deliveryDate: { fontFamily: 'sans-serif-medium', fontSize: 21, marginTop: 2 }, deliveryRange: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 3 }, privacyRow: { marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LousaPalette.line, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, privacyText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17 },
  reviewImage: { width: '100%', height: 240, borderRadius: 28, backgroundColor: '#F8EFF2' }, summaryRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 9 }, summaryLabel: { width: 78, fontFamily: 'sans-serif-medium', fontSize: 12 }, summaryValue: { flex: 1, textAlign: 'right', fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 17 }, divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14, opacity: 0.55 }, priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, priceColumn: { flexDirection: 'column', alignItems: 'flex-start' }, total: { fontFamily: 'serif', fontSize: 31, marginTop: 3 },
  profileLength: { fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 18, marginTop: 10 }, explainText: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18, marginTop: 8 }, recommendActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, smallAction: { minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: LousaPalette.line, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDFE' }, smallActionActive: { borderColor: LousaPalette.rose, backgroundColor: '#F8E7ED' }, smallActionText: { fontFamily: 'sans-serif-medium', fontSize: 12.5, color: LousaPalette.inkSoft }, smallActionTextActive: { color: LousaPalette.berry }, consentRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12 }, checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: LousaPalette.line, alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { backgroundColor: LousaPalette.berry, borderColor: LousaPalette.berry }, consentText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18 }, allowanceCard: { marginTop: 12 }, allowanceRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, allowanceLabel: { fontFamily: 'sans-serif', fontSize: 12 }, allowanceValue: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  stickyPriceCard: { marginTop: 18 }, stickyPriceRows: { gap: 8 }, stickyPriceLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, stickyPriceLabel: { fontFamily: 'sans-serif', fontSize: 12 }, stickyPriceValue: { fontFamily: 'sans-serif-medium', fontSize: 13 }, stickyTotalLine: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, stickyTotalLabel: { fontFamily: 'sans-serif-medium', fontSize: 15 }, stickyTotalValue: { fontFamily: 'serif', fontSize: 25 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 }, actionsColumn: { flexDirection: 'column' }, backButton: { minWidth: 104, minHeight: 54, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 15 }, backText: { fontFamily: 'sans-serif-medium', fontSize: 13 }, error: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 12.5, textAlign: 'center', marginTop: 14 }, cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, cancelText: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 13 },
});
