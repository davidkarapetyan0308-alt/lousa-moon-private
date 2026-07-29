import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { RealMapPreview } from '../../src/components/RealMapPreview';
import { ModalScreen, ScreenScroll, useResponsiveLayout } from '../../src/components/layout';
import { CheckboxRow, ChoiceChip as UiChoiceChip, DestructiveButton, IconBubble, InlineMessage, PressScale, PrimaryButton, ProgressHeader, QuantitySelector, SectionSurface, StatusPill, StickyBottomAction, SurfaceCard, SwitchRow } from '../../src/components/ui';
import { BOX_PLANS, BoxPlanId, formatAmd, localizedText } from '../../src/data/boxCatalog';
import { useBoxStore, useCycleStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { formatHumanDate } from '../../src/utils/date';
import { calculateCyclePrediction } from '../../src/services/cyclePrediction';
import { planBoxDelivery } from '../../src/services/deliveryPlanning';
import { ProductType } from '../../src/domain/models';
import { calculateBoxQuote } from '../../src/services/boxQuote';
import { BoxFlowChoice, estimateBoxNeed, flowChoiceFromProfile } from '../../src/services/boxNeedEstimator';
import { getServiceMode, services } from '../../src/services';
import type { ServerOrderQuote } from '../../src/services/contracts';
import type { PaymentMethod } from '../../src/services/payment';
import { structureAllergens } from '../../src/services/allergenSafety';
import { QuoteValidationError } from '../../src/services/quoteValidation';
import { GuestAccountGate } from '../../src/features/auth/components/GuestAccountGate';
const WINDOWS = ['10:00–14:00', '14:00–18:00', '18:00–21:00'];
const PLAN_IMAGES = {
    essential: require('../../assets/images/box/box-essential-v2.png'),
    comfort: require('../../assets/images/box/box-comfort-v2.png'),
    ritual: require('../../assets/images/box/box-moon-ritual-v2.png'),
} as const;
const COPY = {
    ru: {
        appBar: 'Настройка LOUSA BOX', steps: ['Потребность', 'Состав', 'Доставка', 'Оплата'],
        titles: ['Соберём ровно столько, сколько нужно', 'Настрой состав под себя', 'Куда и когда доставить', 'Проверь и создай заказ'],
        subtitles: ['Сначала выбери ориентир. Затем можно вручную изменить каждую деталь.', 'Количество не заполняется до лимита автоматически: в коробке будут только выбранные средства.', 'Целевая дата учитывает раннюю границу прогноза и запас на доставку.', 'Цена прозрачна. Тестовый заказ не списывает деньги и появится в истории.'],
        popular: 'Популярный', product: 'Основной тип средств', pads: 'Прокладки', tampons: 'Тампоны', mixed: 'Смешанный набор', cup: 'Чаша', disc: 'Диск',
        quantity: 'Средств на один цикл', quantityHelp: 'По умолчанию выбран лимит тарифа. Рекомендация не добавляется автоматически.', periodLength: 'По профилю', included: 'Включено в тариф', selected: 'Выбрано', extra: 'Дополнительно', addOns: 'Платные дополнения', deliveryFee: 'Доставка', totalToday: 'Итого сегодня', recommendation: 'Рекомендуемый объём', applicator: 'Аппликатор для тампонов', withApplicator: 'С аппликатором', withoutApplicator: 'Без аппликатора', noPreference: 'Не важно', reusable: 'Многоразовая чаша/диск · разово', cosmeticAllergies: 'Косметические аллергии', disliked: 'Что не класть в бокс', cosmeticPlaceholder: 'Например: эфирные масла, ретинол', dislikedPlaceholder: 'Например: свеча, сладости', night: 'Ночная защита', fragrance: 'Без ароматизаторов', sensitive: 'Чувствительная кожа', wings: 'С крылышками',
        heat: 'Грелка · разово', tea: 'Травяной чай · каждый бокс', chocolate: 'Тёмный шоколад · каждый бокс', allergies: 'Аллергии и ограничения', allergiesPlaceholder: 'Например: орехи, лактоза',
        address: 'Адрес доставки', addressPlaceholder: 'Город, улица, дом, квартира', chooseMap: 'Выбрать дом на реальной карте', changeMap: 'Изменить точку на карте', mapRequired: 'Сначала выбери дом на карте и проверь зону доставки.', mapVerified: 'Адрес подтверждён по координатам', phone: 'Телефон', phonePlaceholder: '+374…', window: 'Удобное время', note: 'Комментарий курьеру', notePlaceholder: 'Код домофона или ориентир', target: 'Целевая доставка', range: 'Допустимый диапазон', deadline: 'Изменить состав до',
        summary: 'Итог', plan: 'Тариф', products: 'Персонализация', delivery: 'Доставка', monthly: 'в месяц', prototype: 'Цена будет проверена сервером перед оплатой.', continue: 'Продолжить', back: 'Назад', activate: 'Подтвердить заказ', save: 'Сохранить изменения', cancel: 'Отменить подписку', cancelTitle: 'Отменить подписку?', cancelBody: 'Новые заказы больше не будут создаваться. История останется в приложении.', keep: 'Оставить подписку', confirmCancel: 'Отменить', addressError: 'Укажи полный адрес.', phoneError: 'Укажи действующий номер телефона.', insufficient: 'Нужно больше точных дат цикла. Пока выбрана ближайшая безопасная дата.', privacy: 'Курьер получает только имя, телефон, адрес, окно доставки и комментарий.',
        recommendationNotAuto: 'Рекомендация не добавляется автоматически. Ты сама решаешь, что включить.', addRecommended: 'Добавить рекомендованное', keepIncluded: 'Оставить включённое', preferencesSection: 'Предпочтения средств', preferencesHelp: 'Эти настройки помогают подобрать состав внутри тарифа и сами по себе не добавляют цену.', paidExtrasSection: 'Платные дополнения', paidExtrasHelp: 'Добавляются к цене только после твоего выбора.', profileLengthText: (days: number) => `По твоему профилю: обычно ${days} дней.`, todayPayment: 'Сегодня к оплате', nextMonths: 'Следующие месяцы', subscriptionConsent: 'Я понимаю, что это подписка с ежемесячным списанием, и состав можно изменить до сборки.', substitutions: 'Разрешить замену товара', substitutionsHelp: 'Только на товар той же категории. По умолчанию замены запрещены.',
    },
    en: {
        appBar: 'Configure LOUSA BOX', steps: ['Need', 'Contents', 'Delivery', 'Payment'],
        titles: ['Pack exactly what you need', 'Personalize your box', 'Where and when to deliver', 'Review and create order'],
        subtitles: ['Choose a starting point, then adjust every detail yourself.', 'We never fill the plan allowance automatically: only selected products go in your box.', 'The target date uses the earliest forecast boundary and a delivery buffer.', 'The total is transparent. A test order never charges money and appears in order history.'],
        popular: 'Popular', product: 'Primary product', pads: 'Pads', tampons: 'Tampons', mixed: 'Mixed set', cup: 'Cup', disc: 'Disc',
        quantity: 'Products for one cycle', quantityHelp: 'The plan allowance is selected by default. Recommendations are not added automatically.', periodLength: 'From profile', included: 'Included in plan', selected: 'Selected', extra: 'Extra', addOns: 'Paid extras', deliveryFee: 'Delivery', totalToday: 'Total today', recommendation: 'Recommended amount', applicator: 'Tampon applicator', withApplicator: 'Applicator', withoutApplicator: 'No applicator', noPreference: 'No preference', reusable: 'Cup/disc · one-time', cosmeticAllergies: 'Cosmetic allergies', disliked: 'Do not include', cosmeticPlaceholder: 'For example: essential oils, retinol', dislikedPlaceholder: 'For example: candle, sweets', night: 'Night protection', fragrance: 'Fragrance-free', sensitive: 'Sensitive skin', wings: 'With wings',
        heat: 'Heat pad · one-time', tea: 'Herbal tea · every box', chocolate: 'Dark chocolate · every box', allergies: 'Allergies and restrictions', allergiesPlaceholder: 'For example: nuts, lactose',
        address: 'Delivery address', addressPlaceholder: 'City, street, building, apartment', chooseMap: 'Choose home on the real map', changeMap: 'Change map location', mapRequired: 'Choose a home on the map and verify the delivery zone first.', mapVerified: 'Address verified by coordinates', phone: 'Phone', phonePlaceholder: '+374…', window: 'Delivery window', note: 'Courier note', notePlaceholder: 'Entry code or landmark', target: 'Target delivery', range: 'Delivery range', deadline: 'Edit contents until',
        summary: 'Summary', plan: 'Plan', products: 'Personalization', delivery: 'Delivery', monthly: 'per month', prototype: 'The price is verified by the server before payment.', continue: 'Continue', back: 'Back', activate: 'Confirm order', save: 'Save changes', cancel: 'Cancel subscription', cancelTitle: 'Cancel subscription?', cancelBody: 'No new orders will be created. Your history will remain in the app.', keep: 'Keep subscription', confirmCancel: 'Cancel', addressError: 'Enter a complete address.', phoneError: 'Enter a valid phone number.', insufficient: 'More exact cycle dates are needed. A safe fallback date is shown.', privacy: 'The courier only receives your name, phone, address, delivery window and note.',
        recommendationNotAuto: 'Recommendations are not added automatically. You decide what to include.', addRecommended: 'Add recommendation', keepIncluded: 'Keep allowance', preferencesSection: 'Product preferences', preferencesHelp: 'These settings help choose items inside the plan and do not add price by themselves.', paidExtrasSection: 'Paid extras', paidExtrasHelp: 'Added to the price only after your choice.', profileLengthText: (days: number) => `From your profile: usually ${days} days.`, todayPayment: 'Due today', nextMonths: 'Next months', subscriptionConsent: 'I understand this is a monthly subscription and I can edit contents before packing.', substitutions: 'Allow product substitutions', substitutionsHelp: 'Only within the same category. Substitutions are disabled by default.',
    },
    hy: {
        appBar: 'LOUSA BOX-ի կարգավորում', steps: ['Կարիք', 'Պարունակություն', 'Առաքում', 'Վճարում'],
        titles: ['Կհավաքենք հենց անհրաժեշտ քանակը', 'Անհատականացրու բոքսը', 'Որտե՞ղ և ե՞րբ առաքել', 'Ստուգիր և ստեղծիր պատվերը'],
        subtitles: ['Ընտրիր մեկնարկային տարբերակը, հետո փոխիր ցանկացած մանրուք։', 'Փաթեթի սահմանաչափը ինքնաբերաբար չի լրացվում․ բոքսում կլինեն միայն ընտրված միջոցները։', 'Նպատակային օրը հաշվի է առնում կանխատեսման վաղ սահմանն ու առաքման պահուստը։', 'Գինը թափանցիկ է։ Փորձնական պատվերը գումար չի գանձում և կհայտնվի պատմության մեջ։'],
        popular: 'Հայտնի', product: 'Հիմնական միջոցը', pads: 'Միջադիրներ', tampons: 'Տամպոններ', mixed: 'Խառը հավաքածու', cup: 'Բաժակ', disc: 'Դիսկ',
        quantity: 'Միջոցներ մեկ ցիկլի համար', quantityHelp: 'Լռելյայն ընտրված է փաթեթի ներառված քանակը։ Առաջարկը ինքնաբերաբար չի ավելացվում։', periodLength: 'Պրոֆիլից', included: 'Ներառված է փաթեթում', selected: 'Ընտրված է', extra: 'Լրացուցիչ', addOns: 'Վճարովի հավելումներ', deliveryFee: 'Առաքում', totalToday: 'Ընդամենը այսօր', recommendation: 'Առաջարկվող քանակ', applicator: 'Տամպոնի ապլիկատոր', withApplicator: 'Ապլիկատորով', withoutApplicator: 'Առանց ապլիկատորի', noPreference: 'Կարևոր չէ', reusable: 'Բաժակ/դիսկ · մեկ անգամ', cosmeticAllergies: 'Կոսմետիկ ալերգիաներ', disliked: 'Ինչ չդնել բոքսում', cosmeticPlaceholder: 'Օրինակ՝ եթերայուղեր, ռետինոլ', dislikedPlaceholder: 'Օրինակ՝ մոմ, քաղցրավենիք', night: 'Գիշերային պաշտպանություն', fragrance: 'Առանց բույրի', sensitive: 'Զգայուն մաշկ', wings: 'Թևիկներով',
        heat: 'Տաքացուցիչ · մեկ անգամ', tea: 'Բուսական թեյ · ամեն բոքսում', chocolate: 'Մուգ շոկոլադ · ամեն բոքսում', allergies: 'Ալերգիաներ և սահմանափակումներ', allergiesPlaceholder: 'Օրինակ՝ ընկույզ, լակտոզ',
        address: 'Առաքման հասցե', addressPlaceholder: 'Քաղաք, փողոց, շենք, բնակարան', chooseMap: 'Ընտրել տունը իրական քարտեզի վրա', changeMap: 'Փոխել կետը քարտեզի վրա', mapRequired: 'Նախ ընտրիր տունը քարտեզի վրա և ստուգիր առաքման գոտին։', mapVerified: 'Հասցեն հաստատված է կոորդինատներով', phone: 'Հեռախոս', phonePlaceholder: '+374…', window: 'Առաքման ժամերը', note: 'Մեկնաբանություն առաքիչին', notePlaceholder: 'Մուտքի կոդ կամ կողմնորոշիչ', target: 'Նպատակային առաքում', range: 'Առաքման միջակայք', deadline: 'Փոխել մինչև',
        summary: 'Ամփոփում', plan: 'Փաթեթ', products: 'Անհատականացում', delivery: 'Առաքում', monthly: 'ամսական', prototype: 'Գինը վճարումից առաջ ստուգվում է սերվերում։', continue: 'Շարունակել', back: 'Հետ', activate: 'Հաստատել պատվերը', save: 'Պահպանել', cancel: 'Չեղարկել բաժանորդագրությունը', cancelTitle: 'Չեղարկե՞լ բաժանորդագրությունը', cancelBody: 'Նոր պատվերներ չեն ստեղծվի, իսկ պատմությունը կմնա հավելվածում։', keep: 'Պահպանել բաժանորդագրությունը', confirmCancel: 'Չեղարկել', addressError: 'Նշիր ամբողջական հասցե։', phoneError: 'Նշիր վավեր հեռախոսահամար։', insufficient: 'Անհրաժեշտ են ավելի շատ ճշգրիտ ամսաթվեր։ Ցուցադրվում է անվտանգ պահեստային օր։', privacy: 'Առաքիչը ստանում է միայն անունը, հեռախոսը, հասցեն, ժամային պատուհանն ու մեկնաբանությունը։',
        recommendationNotAuto: 'Առաջարկը ինքնաբերաբար չի ավելացվում։ Դու ես որոշում կազմը։', addRecommended: 'Ավելացնել առաջարկը', keepIncluded: 'Թողնել ներառվածը', preferencesSection: 'Միջոցների նախասիրություններ', preferencesHelp: 'Այս կարգավորումները օգնում են ընտրել կազմը և ինքնուրույն գին չեն ավելացնում։', paidExtrasSection: 'Վճարովի հավելումներ', paidExtrasHelp: 'Գնին ավելանում են միայն քո ընտրությունից հետո։', profileLengthText: (days: number) => `Քո պրոֆիլում՝ սովորաբար ${days} օր։`, todayPayment: 'Այսօր վճարման ենթակա', nextMonths: 'Հաջորդ ամիսներ', subscriptionConsent: 'Հասկանում եմ, որ սա ամսական բաժանորդագրություն է, և կազմը կարելի է փոխել մինչև հավաքումը։', substitutions: 'Թույլատրել ապրանքի փոխարինումը', substitutionsHelp: 'Միայն նույն կատեգորիայի ապրանքով։ Լռելյայն փոխարինումը արգելված է։',
    },
} as const;

function orderingCopy(language: 'ru' | 'en' | 'hy') {
    if (language === 'en') return {
        flow: 'How is your flow usually?', light: 'Light', medium: 'Typical', heavy: 'Heavy', estimate: 'Your starting estimate', history: 'Based on your recorded cycles', starting: 'A gentle starting point, not a rule', daily: (value: number) => `about ${value} products per day`, exact: (value: number) => `We will pack exactly ${value} menstrual products.`, apply: 'Use this setup', plan: 'Recommended plan', capacity: (value: number) => `up to ${value} products`, noExtras: 'We never add extra menstrual products just to fill a plan.', testPayment: 'Test order', testPaymentDetail: 'LOUSA test card ending in 4242. No money will be charged. Your order will appear in history and Operations.', realPayment: 'Secure payment', realPaymentDetail: 'Your payment method will be confirmed before any charge.', total: 'Total today', testAction: 'Create test order', orderAction: 'Confirm order', includedCare: 'Care items included in the plan are listed separately from your selected menstrual products.',
    };
    if (language === 'hy') return {
        flow: 'Սովորաբար ինչպիսի՞ն է հոսքը', light: 'Թեթև', medium: 'Սովորական', heavy: 'Ուժեղ', estimate: 'Քո մեկնարկային գնահատականը', history: 'Հիմնված է քո գրանցված ցիկլերի վրա', starting: 'Նուրբ մեկնարկային գնահատական է, ոչ կանոն', daily: (value: number) => `մոտ ${value} միջոց օրական`, exact: (value: number) => `Կհավաքենք ճիշտ ${value} դաշտանային միջոց։`, apply: 'Օգտագործել այս կարգավորումը', plan: 'Առաջարկվող փաթեթ', capacity: (value: number) => `մինչև ${value} միջոց`, noExtras: 'Փաթեթը լրացնելու համար լրացուցիչ դաշտանային միջոցներ երբեք չենք ավելացնում։', testPayment: 'Փորձնական պատվեր', testPaymentDetail: 'LOUSA փորձնական քարտ՝ 4242 վերջավորությամբ։ Գումար չի գանձվի։ Պատվերը կհայտնվի պատմության և Operations-ում։', realPayment: 'Անվտանգ վճարում', realPaymentDetail: 'Վճարման եղանակը կհաստատվի գանձումից առաջ։', total: 'Ընդամենը այսօր', testAction: 'Ստեղծել փորձնական պատվեր', orderAction: 'Հաստատել պատվերը', includedCare: 'Փաթեթի խնամքի ներառված միջոցները ցուցադրվում են ընտրված դաշտանային միջոցներից առանձին։',
    };
    return {
        flow: 'Какая интенсивность обычно?', light: 'Лёгкая', medium: 'Обычная', heavy: 'Обильная', estimate: 'Твоя стартовая оценка', history: 'На основе отмеченных тобой циклов', starting: 'Это мягкий ориентир, а не медицинская норма', daily: (value: number) => `примерно ${value} средства в день`, exact: (value: number) => `Соберём ровно ${value} менструальных средств.`, apply: 'Использовать этот вариант', plan: 'Подходящий тариф', capacity: (value: number) => `до ${value} средств`, noExtras: 'Мы никогда не добавляем лишние менструальные средства только для заполнения тарифа.', testPayment: 'Тестовый заказ', testPaymentDetail: 'Тестовая карта LOUSA с окончанием 4242. Деньги не списываются. Заказ появится в истории и Operations.', realPayment: 'Безопасная оплата', realPaymentDetail: 'Способ оплаты будет подтверждён до любого списания.', total: 'Итого сегодня', testAction: 'Создать тестовый заказ', orderAction: 'Подтвердить заказ', includedCare: 'Заботливые дополнения тарифа показываются отдельно от выбранных менструальных средств.',
    };
}
function ChoiceChip({ label, selected, onPress }: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return <UiChoiceChip label={label} selected={selected} onPress={onPress} />;
}
function ToggleRow({ label, value, onPress }: {
    label: string;
    value: boolean;
    onPress: () => void;
}) {
    return <SwitchRow label={label} value={value} onPress={onPress} />;
}
function SummaryRow({ label, value, icon }: {
    label: string;
    value: string;
    icon: string;
}) {
    const { colors } = useTheme();
    return <View style={styles.summaryRow}><IconBubble icon={icon} tone="rose" size={38}/><Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>{label}</Text><Text style={[styles.summaryValue, { color: colors.onBackground }]}>{value}</Text></View>;
}
export default function SubscriptionScreen() {
    const language = useUserStore((state) => state.language);
    const isGuestMode = useUserStore((state) => state.isGuestMode);
    const copy = COPY[language] || COPY.ru;
    if (isGuestMode) return <GuestAccountGate screenTitle={copy.appBar} />;
    return <AuthenticatedSubscriptionScreen />;
}

function AuthenticatedSubscriptionScreen() {
    const { colors, isDark } = useTheme();
    const { compactWidth } = useResponsiveLayout();
    const language = useUserStore((s) => s.language);
    const copy = COPY[language] || COPY.ru;
    const orderCopy = orderingCopy(language);
    const box = useBoxStore();
    const cycle = useCycleStore();
    const setPremium = useUserStore((s) => s.setPremium);
    const [step, setStep] = useState(0);
    const [planId, setPlanId] = useState<BoxPlanId>(box.planId || 'comfort');
    const [productType, setProductType] = useState<ProductType>((box.preferences.primaryProduct === 'cup' || box.preferences.primaryProduct === 'disc') ? 'mixed' : (box.preferences.primaryProduct || box.productType || 'pads'));
    const periodLength = Math.max(3, Math.min(8, box.preferences.periodLengthEstimate || cycle.avgPeriodLength || 5));
    const initialPlan = BOX_PLANS.find((item) => item.id === (box.planId || 'comfort')) || BOX_PLANS[1];
    const [cycleUnits, setCycleUnits] = useState(() => Math.max(8, Math.min(48, (box.preferences.dailyQuantityEstimate || 4) * periodLength)));
    const [flowChoice, setFlowChoice] = useState<BoxFlowChoice>(() => flowChoiceFromProfile(box.preferences.flowProfile));
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
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    useEffect(() => {
        if (!box.deliveryAddress)
            return;
        setAddress(box.deliveryAddress.formattedAddress);
        setPhone((current) => box.deliveryAddress?.phone || current);
        setNote(box.deliveryAddress.instructions || '');
        setDeliveryWindow((current) => box.deliveryAddress?.validationStatus === 'verified' ? current : WINDOWS[0]);
    }, [box.deliveryAddress]);
    const prediction = useMemo(() => calculateCyclePrediction(cycle.periodRecords, { fallbackCycleLength: cycle.avgCycleLength, fallbackPeriodLength: cycle.avgPeriodLength, cycleContext: cycle.onboardingProfile.cycleContext, factors: cycle.onboardingProfile.factors }), [cycle.periodRecords, cycle.avgCycleLength, cycle.avgPeriodLength, cycle.onboardingProfile]);
    const deliveryPlan = useMemo(() => planBoxDelivery({ prediction, paused: box.paused, skipNext: box.subscription?.skipNextBox }), [prediction, box.paused, box.subscription?.skipNextBox]);
    const selectedPlan = BOX_PLANS.find((item) => item.id === planId) || BOX_PLANS[1];
    const historicalCycleItems = useMemo(() => cycle.periodRecords
        .filter((record) => !record.deletedAt)
        .map((record) => Object.values(record.productsUsedByDay || {}).reduce((sum, value) => sum + (Number(value) || 0), 0))
        .filter((value) => value > 0), [cycle.periodRecords]);
    const needEstimate = useMemo(() => estimateBoxNeed({
        flow: flowChoice,
        periodLength,
        historicalCycleItems,
    }), [flowChoice, historicalCycleItems, periodLength]);
    const recommendedUnits = needEstimate.suggestedItems;
    const hasRecommendationDelta = recommendedUnits !== cycleUnits;
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
    }, [planId, productType, cycleUnits, nightProtection, fragranceFree, skinSensitivity, wingPreference, applicatorPreference, reusableProducts, heatPad, tea, chocolate, allergies, cosmeticAllergies, dislikedItems, allowSubstitutions, box.deliveryAddress?.id]);
    useEffect(() => {
        if (step !== 3 || getServiceMode() !== 'api') return;
        let live = true;
        void services.payments.listPaymentMethods().then((result) => {
            if (live && result.ok) setPaymentMethod(result.data[0] || null);
        });
        return () => { live = false; };
    }, [step]);
    const buildSelectedItems = () => {
        const nightUnits = nightProtection ? Math.min(Math.max(2, Math.round(cycleUnits * 0.25)), cycleUnits) : 0;
        const dayUnits = Math.max(0, cycleUnits - nightUnits);
        const items: Array<{
            sku: string;
            quantity: number;
        }> = [];
        if (productType === 'pads') {
            if (dayUnits)
                items.push({ sku: 'pad-day', quantity: dayUnits });
            if (nightUnits)
                items.push({ sku: 'pad-night', quantity: nightUnits });
        }
        else if (productType === 'tampons') {
            items.push({ sku: applicatorPreference === 'non_applicator' ? 'tampon-non-applicator' : 'tampon-regular', quantity: cycleUnits });
        }
        else if (productType === 'mixed') {
            const tamponUnits = Math.floor(cycleUnits / 2);
            const padUnits = cycleUnits - tamponUnits;
            const mixedNight = nightProtection ? Math.min(Math.max(2, Math.round(padUnits * 0.3)), padUnits) : 0;
            if (padUnits - mixedNight)
                items.push({ sku: 'pad-day', quantity: padUnits - mixedNight });
            if (mixedNight)
                items.push({ sku: 'pad-night', quantity: mixedNight });
            if (tamponUnits)
                items.push({ sku: applicatorPreference === 'non_applicator' ? 'tampon-non-applicator' : 'tampon-regular', quantity: tamponUnits });
        }
        else {
            items.push({ sku: productType === 'cup' ? 'menstrual-cup' : 'menstrual-disc', quantity: 1 });
            items.push({ sku: 'pad-day', quantity: Math.min(4, cycleUnits) });
        }
        if (heatPad)
            items.push({ sku: 'heat-pad', quantity: 1 });
        if (tea)
            items.push({ sku: 'tea', quantity: 1 });
        if (chocolate)
            items.push({ sku: 'chocolate', quantity: 1 });
        return items;
    };
    const requestServerQuote = async () => {
        if (getServiceMode() !== 'api')
            throw new Error('Для оформления нужен подключённый backend LOUSA. Demo не создаёт реальные заказы.');
        if (!box.deliveryAddress?.id || box.deliveryAddress.validationStatus !== 'verified')
            throw new Error(copy.mapRequired);
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
                flowProfile: [flowChoice],
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
        if (!result.ok)
            throw new Error(result.error.message);
        if (result.data.deliveryFeeMinor !== 0)
            throw new Error('Сервер вернул недопустимую стоимость доставки. Оформление остановлено.');
        if (result.data.validationErrors.length)
            throw new QuoteValidationError(result.data.validationErrors, language);
        setServerQuote(result.data);
        return result.data;
    };
    const next = async () => {
        setError('');
        if (step === 2) {
            if (!box.deliveryAddress || box.deliveryAddress.validationStatus !== 'verified')
                return setError(copy.mapRequired);
            if (address.trim().length < 6)
                return setError(copy.addressError);
            if (phone.replace(/\D/g, '').length < 8)
                return setError(copy.phoneError);
        }
        if (step === 2) {
            setProcessing(true);
            try {
                await requestServerQuote();
            }
            catch (cause) {
                if (cause instanceof QuoteValidationError)
                    setStep(1);
                setError(cause instanceof Error ? cause.message : 'QUOTE_ERROR');
                setProcessing(false);
                return;
            }
            setProcessing(false);
        }
        setStep((value) => Math.min(3, value + 1));
    };
    const activate = async () => {
        if (processing)
            return;
        setProcessing(true);
        setError('');
        try {
            if (!subscriptionConsent)
                throw new Error(copy.subscriptionConsent);
            const quote = serverQuote && new Date(serverQuote.expiresAt).getTime() > Date.now()
                ? serverQuote
                : await requestServerQuote();
            if (quote.deliveryFeeMinor !== 0 || quote.validationErrors.length)
                throw new Error('Серверная цена не прошла проверку. Обнови расчёт.');
            const preferences = {
                ...box.preferences,
                primaryProduct: productType,
                menstrualProducts: productType === 'mixed' ? ['pads', 'tampons'] as ProductType[] : [productType],
                dailyQuantityEstimate: Math.max(1, Math.ceil(cycleUnits / Math.max(1, periodLength))),
                periodLengthEstimate: periodLength,
                flowProfile: [flowChoice],
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
            if (!preferenceResult.ok)
                throw new Error(preferenceResult.error.message);
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
            if (!orderResult.ok)
                throw new Error(orderResult.error.message);
            const methodsResult = await services.payments.listPaymentMethods();
            if (!methodsResult.ok || !methodsResult.data.length)
                throw new Error(methodsResult.ok ? 'Способ оплаты пока не настроен.' : methodsResult.error.message);
            const paymentResult = await services.payments.createPayment({ orderId: orderResult.data.id, amountMinor: quote.totalMinor, idempotencyKey: `payment-${quote.quoteId}` });
            if (!paymentResult.ok)
                throw new Error(paymentResult.error.message);
            const confirmedPayment = await services.payments.confirmPayment(paymentResult.data.id, methodsResult.data[0].id);
            if (!confirmedPayment.ok || confirmedPayment.data.status !== 'succeeded')
                throw new Error(confirmedPayment.ok ? 'Платёж не подтверждён.' : confirmedPayment.error.message);
            const subscriptionResult = await services.subscription.saveSubscription({
                orderId: orderResult.data.id,
                plan: planId,
                deliveryAddressId: box.deliveryAddress!.id,
                deliveryWindow,
                preferredDeliveryDate: deliveryPlan.targetDate,
            });
            if (!subscriptionResult.ok)
                throw new Error(subscriptionResult.error.message);
            useBoxStore.setState((state) => ({
                isSubscribed: true,
                planId,
                address: box.deliveryAddress?.formattedAddress || address.trim(),
                phone: box.deliveryAddress?.phone || phone.trim(),
                deliveryNote: note.trim(),
                deliveryWindow,
                nextDeliveryDate: subscriptionResult.data.nextDeliveryDate || state.nextDeliveryDate,
                paused: false,
                preferences,
                subscription: subscriptionResult.data,
                orders: [{ ...orderResult.data, paymentStatus: 'paid', status: 'paid', demo: Boolean(confirmedPayment.data.demo) }, ...state.orders.filter((item) => item.id !== orderResult.data.id)],
            }));
            setPremium(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            router.replace('/(tabs)/box');
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'ORDER_CONFIRMATION_ERROR');
        }
        finally {
            setProcessing(false);
        }
    };
    const cancelSubscription = async () => {
        if (processing)
            return;
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
    const applyEstimate = () => {
        setPlanId(needEstimate.recommendedPlanId);
        setCycleUnits(needEstimate.suggestedItems);
        Haptics.selectionAsync().catch(() => {});
    };
    const contents = [
        <View key="plan" style={styles.stepBody}>
          <SurfaceCard padding={20} tone="accent">
            <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>{orderCopy.flow}</Text>
            <View style={styles.chips}>{(['light', 'medium', 'heavy'] as BoxFlowChoice[]).map((item) => <ChoiceChip key={item} label={orderCopy[item]} selected={flowChoice === item} onPress={() => setFlowChoice(item)}/>)}</View>
            <View style={styles.estimateLead}><View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>{orderCopy.estimate}</Text><Text style={[styles.estimateNumber, { color: colors.onBackground }]}>{needEstimate.suggestedItems}</Text><Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{needEstimate.source === 'history' ? orderCopy.history : orderCopy.starting} · {orderCopy.daily(needEstimate.dailyItems)}</Text></View><IconBubble icon="auto_awesome" tone="rose" size={48}/></View>
            <Text style={[styles.exactPromise, { color: colors.onBackground }]}>{orderCopy.exact(needEstimate.suggestedItems)}</Text>
            <PressScale onPress={applyEstimate} style={styles.estimateAction}><Text style={styles.estimateActionText}>{orderCopy.apply}</Text><MaterialSymbol name="arrow_forward" size={18} color="#FFFFFF"/></PressScale>
          </SurfaceCard>
          <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{orderCopy.plan}</Text>
          <Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{orderCopy.noExtras}</Text>
          {BOX_PLANS.map((plan) => { const selected = plan.id === planId; const recommended = plan.id === needEstimate.recommendedPlanId; return <PressScale key={plan.id} onPress={() => setPlanId(plan.id)} style={styles.planPress}><SurfaceCard padding={0} tone={selected ? 'accent' : 'default'} style={[styles.planCard, selected && styles.planSelected]}><Image source={PLAN_IMAGES[plan.id]} style={styles.planImage} resizeMode="contain"/><View style={styles.planContent}><View style={styles.planHead}><View style={{ flex: 1 }}><View style={styles.planNameRow}><Text style={[styles.planName, { color: colors.onBackground }]}>{plan.name}</Text>{recommended ? <StatusPill label={copy.popular} tone="rose"/> : null}</View><Text style={[styles.planDescription, { color: colors.onSurfaceVariant }]}>{localizedText(plan.description, language)}</Text><Text style={[styles.planCapacity, { color: colors.onSurfaceVariant }]}>{orderCopy.capacity(plan.includedUnits)}</Text><Text style={styles.planPrice}>{formatAmd(plan.monthlyPriceAmd, language)} / {copy.monthly}</Text></View><View style={[styles.radio, { borderColor: selected ? LousaPalette.berry : colors.outlineVariant }]}>{selected ? <View style={styles.radioInner}/> : null}</View></View></View></SurfaceCard></PressScale>; })}
        </View>,
        <View key="contents" style={styles.stepBody}><SurfaceCard padding={20}>
      <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>{copy.product}</Text><View style={styles.chips}>{(['pads', 'tampons', 'mixed'] as ProductType[]).map((item) => <ChoiceChip key={item} label={productLabels[item]} selected={productType === item} onPress={() => setProductType(item)}/>)}</View>
      {(productType === 'tampons' || productType === 'mixed') ? <><Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.applicator}</Text><View style={styles.chips}><ChoiceChip label={copy.withApplicator} selected={applicatorPreference === 'applicator'} onPress={() => setApplicatorPreference('applicator')}/><ChoiceChip label={copy.withoutApplicator} selected={applicatorPreference === 'non_applicator'} onPress={() => setApplicatorPreference('non_applicator')}/><ChoiceChip label={copy.noPreference} selected={applicatorPreference === 'no_preference'} onPress={() => setApplicatorPreference('no_preference')}/></View></> : null}
      <SurfaceCard padding={14} tone="accent" style={styles.allowanceCard}>
        <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.onSurfaceVariant }]}>{copy.included}</Text><Text style={[styles.allowanceValue, { color: colors.onBackground }]}>{selectedPlan.includedUnits}</Text></View>
        <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.onSurfaceVariant }]}>{copy.recommendation}</Text><Text style={[styles.allowanceValue, { color: colors.onBackground }]}>{recommendedUnits}</Text></View>
        <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.onSurfaceVariant }]}>{copy.selected}</Text><Text style={[styles.allowanceValue, { color: colors.onBackground }]}>{cycleUnits}</Text></View>
        <View style={styles.allowanceRow}><Text style={[styles.allowanceLabel, { color: colors.onSurfaceVariant }]}>{copy.extra}</Text><Text style={[styles.allowanceValue, { color: extraUnits > 0 ? LousaPalette.berry : LousaPalette.success }]}>{extraUnits > 0 ? `${extraUnits} · ${formatAmd(sanitaryAddOn, language)}` : formatAmd(0, language)}</Text></View>
        <Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{orderCopy.exact(cycleUnits)} {orderCopy.includedCare}</Text>
        {hasRecommendationDelta ? <View style={styles.recommendActions}><PressScale onPress={() => setCycleUnits(needEstimate.safeMinimumItems)} style={styles.smallAction}><Text style={styles.smallActionText}>{needEstimate.safeMinimumItems}</Text></PressScale><PressScale onPress={() => setCycleUnits(recommendedUnits)} style={[styles.smallAction, cycleUnits === recommendedUnits && styles.smallActionActive]}><Text style={[styles.smallActionText, cycleUnits === recommendedUnits && styles.smallActionTextActive]}>{copy.addRecommended}</Text></PressScale></View> : null}
      </SurfaceCard>
      <View style={styles.fieldGap}><QuantitySelector value={cycleUnits} min={8} max={48} step={1} onChange={setCycleUnits} label={copy.quantity} helper={orderCopy.noExtras}/></View>
      <Text style={[styles.profileLength, { color: colors.onSurfaceVariant }]}>{copy.profileLengthText(periodLength)}</Text>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.preferencesSection}</Text><Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{copy.preferencesHelp}</Text>
      <View style={styles.toggleGroup}><ToggleRow label={copy.night} value={nightProtection} onPress={() => setNightProtection((value) => !value)}/><ToggleRow label={copy.fragrance} value={fragranceFree} onPress={() => setFragranceFree((value) => !value)}/><ToggleRow label={copy.sensitive} value={skinSensitivity} onPress={() => setSkinSensitivity((value) => !value)}/><ToggleRow label={copy.wings} value={wingPreference} onPress={() => setWingPreference((value) => !value)}/></View>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.paidExtrasSection}</Text><Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{copy.paidExtrasHelp}</Text>
      <View style={styles.toggleGroup}><ToggleRow label={copy.reusable} value={reusableProducts} onPress={() => setReusableProducts((value) => !value)}/><ToggleRow label={copy.heat} value={heatPad} onPress={() => setHeatPad((value) => !value)}/><ToggleRow label={copy.tea} value={tea} onPress={() => setTea((value) => !value)}/><ToggleRow label={copy.chocolate} value={chocolate} onPress={() => setChocolate((value) => !value)}/></View>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.allergies}</Text><TextInput value={allergies} onChangeText={setAllergies} placeholder={copy.allergiesPlaceholder} placeholderTextColor={colors.outline} multiline style={[styles.input, styles.textArea, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}/>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.cosmeticAllergies}</Text><TextInput value={cosmeticAllergies} onChangeText={setCosmeticAllergies} placeholder={copy.cosmeticPlaceholder} placeholderTextColor={colors.outline} multiline style={[styles.input, styles.textArea, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}/>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.disliked}</Text><TextInput value={dislikedItems} onChangeText={setDislikedItems} placeholder={copy.dislikedPlaceholder} placeholderTextColor={colors.outline} multiline style={[styles.input, styles.textArea, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}/>
    </SurfaceCard></View>,
        <View key="delivery" style={styles.stepBody}><SurfaceCard padding={20}>
      <View style={styles.deliveryTarget}><IconBubble icon="event_available" tone="rose"/><View style={{ flex: 1 }}><Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>{copy.target}</Text><Text style={[styles.deliveryDate, { color: colors.onBackground }]}>{deliveryPlan.targetDate ? formatHumanDate(deliveryPlan.targetDate, language) : '—'}</Text>{deliveryPlan.earliestDate && deliveryPlan.latestDate ? <Text style={[styles.deliveryRange, { color: colors.onSurfaceVariant }]}>{copy.range}: {formatHumanDate(deliveryPlan.earliestDate, language)}–{formatHumanDate(deliveryPlan.latestDate, language)}</Text> : <Text style={[styles.deliveryRange, { color: LousaPalette.warning }]}>{copy.insufficient}</Text>}{deliveryPlan.customizationDeadline ? <Text style={[styles.deliveryRange, { color: colors.onSurfaceVariant }]}>{copy.deadline}: {formatHumanDate(deliveryPlan.customizationDeadline, language)}</Text> : null}</View></View>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.address}</Text>
      <PressScale onPress={() => router.push('/screens/address-map')} style={[styles.mapAddressCard, { borderColor: box.deliveryAddress?.validationStatus === 'verified' ? LousaPalette.rose : colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}>
        <View style={styles.mapAddressIcon}><MaterialSymbol name="map" size={23} color={LousaPalette.berry}/></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mapAddressTitle, { color: colors.onBackground }]}>{box.deliveryAddress ? copy.changeMap : copy.chooseMap}</Text>
          <Text style={[styles.mapAddressText, { color: colors.onSurfaceVariant }]} numberOfLines={3}>{box.deliveryAddress?.formattedAddress || copy.addressPlaceholder}</Text>
          {box.deliveryAddress?.validationStatus === 'verified' ? <Text style={styles.mapVerifiedText}>{copy.mapVerified} · {box.deliveryAddress.latitude.toFixed(5)}, {box.deliveryAddress.longitude.toFixed(5)}</Text> : null}
        </View>
        <MaterialSymbol name="chevron_right" size={22} color={colors.onSurfaceVariant}/>
      </PressScale>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.phone}</Text><TextInput value={phone} onChangeText={setPhone} placeholder={copy.phonePlaceholder} keyboardType="phone-pad" placeholderTextColor={colors.outline} style={[styles.input, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}/>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.window}</Text><View style={styles.chips}>{WINDOWS.map((item) => <ChoiceChip key={item} label={item} selected={deliveryWindow === item} onPress={() => setDeliveryWindow(item)}/>)}</View>
      <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.note}</Text><TextInput value={note} onChangeText={setNote} placeholder={copy.notePlaceholder} placeholderTextColor={colors.outline} multiline style={[styles.input, styles.textArea, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}/>
      <View style={styles.privacyRow}><MaterialSymbol name="privacy_tip" size={18} color={LousaPalette.berry}/><Text style={[styles.privacyText, { color: colors.onSurfaceVariant }]}>{copy.privacy}</Text></View>
    </SurfaceCard></View>,
        <View key="review" style={styles.stepBody}><Image source={PLAN_IMAGES[selectedPlan.id]} style={styles.reviewImage} resizeMode="contain"/>{box.deliveryAddress ? <RealMapPreview latitude={box.deliveryAddress.latitude} longitude={box.deliveryAddress.longitude} label={box.deliveryAddress.formattedAddress}/> : null}<SurfaceCard padding={4}><SummaryRow label={copy.plan} value={`${selectedPlan.name} · ${formatAmd(selectedPlan.monthlyPriceAmd, language)}`} icon="inventory_2"/><View style={[styles.divider, { backgroundColor: colors.outlineVariant }]}/><SummaryRow label={copy.products} value={`${productLabels[productType]} · ${cycleUnits} ${language === 'en' ? 'units' : language === 'hy' ? 'միավոր' : 'единиц'}`} icon="favorite"/><View style={[styles.divider, { backgroundColor: colors.outlineVariant }]}/><SummaryRow label={copy.delivery} value={`${box.deliveryAddress?.formattedAddress || address || '—'} · ${deliveryWindow} · ${copy.included}`} icon="local_shipping"/></SurfaceCard><SectionSurface><CheckboxRow label={copy.substitutions} detail={copy.substitutionsHelp} checked={allowSubstitutions} onPress={() => setAllowSubstitutions((value) => !value)} /></SectionSurface><SectionSurface><CheckboxRow label={copy.subscriptionConsent} checked={subscriptionConsent} onPress={() => setSubscriptionConsent((value) => !value)} /></SectionSurface><SurfaceCard padding={16} tone="accent"><View style={styles.paymentMethod}><IconBubble icon={paymentMethod?.demo ? 'science' : 'credit_card'} tone="rose" size={42}/><View style={{ flex: 1 }}><Text style={[styles.fieldLabel, { color: colors.onBackground }]}>{paymentMethod?.demo ? orderCopy.testPayment : orderCopy.realPayment}</Text><Text style={[styles.explainText, { color: colors.onSurfaceVariant }]}>{paymentMethod?.demo ? orderCopy.testPaymentDetail : orderCopy.realPaymentDetail}</Text></View></View><View style={[styles.priceRow, styles.priceTop, compactWidth && styles.priceColumn]}><View><Text style={[styles.eyebrow, { color: colors.onSurfaceVariant }]}>{orderCopy.total}</Text><Text style={[styles.total, { color: colors.onBackground }]}>{formatAmd(orderTotal, language)}</Text></View><StatusPill label={copy.deliveryFee === 'Delivery' ? 'Included' : copy.included} tone="neutral"/></View></SurfaceCard></View>,
    ][step];
    const primaryLabel = step === 3 ? (box.isSubscribed ? copy.save : paymentMethod?.demo ? orderCopy.testAction : orderCopy.orderAction) : copy.continue;
    return (
        <ModalScreen title={copy.appBar} closeIcon="close" keyboard>
            <View style={styles.modalBody}>
                <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollWithFooter}>
                    <ProgressHeader steps={copy.steps} currentStep={step} />
                    <View style={styles.intro}>
                        <Text style={[styles.title, { color: colors.onBackground }]}>{copy.titles[step]}</Text>
                        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{copy.subtitles[step]}</Text>
                    </View>
                    {contents}
                    {error ? <InlineMessage body={error} tone="danger" /> : null}
                    <SectionSurface style={styles.stickyPriceCard}>
                        <View style={styles.stickyPriceRows}>
                            <View style={styles.stickyPriceLine}>
                                <Text style={[styles.stickyPriceLabel, { color: colors.onSurfaceVariant }]}>{copy.plan}</Text>
                                <Text style={[styles.stickyPriceValue, { color: colors.onBackground }]}>{formatAmd(selectedPlan.monthlyPriceAmd, language)}</Text>
                            </View>
                            <View style={styles.stickyPriceLine}>
                                <Text style={[styles.stickyPriceLabel, { color: colors.onSurfaceVariant }]}>{copy.addOns}</Text>
                                <Text style={[styles.stickyPriceValue, { color: addOnTotal > 0 ? LousaPalette.berry : colors.onBackground }]}>{formatAmd(addOnTotal, language)}</Text>
                            </View>
                            <View style={styles.stickyPriceLine}>
                                <Text style={[styles.stickyPriceLabel, { color: colors.onSurfaceVariant }]}>{copy.deliveryFee}</Text>
                                <Text style={[styles.stickyPriceValue, { color: colors.onBackground }]}>{copy.included}</Text>
                            </View>
                        </View>
                        <View style={[styles.stickyTotalLine, { borderTopColor: colors.outlineVariant }]}>
                            <Text style={[styles.stickyTotalLabel, { color: colors.onBackground }]}>{copy.todayPayment}</Text>
                            <Text style={[styles.stickyTotalValue, { color: LousaPalette.berry }]}>{formatAmd(orderTotal, language)}</Text>
                        </View>
                    </SectionSurface>
                    {box.isSubscribed && step === 3 ? (
                        <DestructiveButton
                            label={copy.cancel}
                            disabled={processing}
                            onPress={() => Alert.alert(copy.cancelTitle, copy.cancelBody, [
                                { text: copy.keep, style: 'cancel' },
                                { text: copy.confirmCancel, style: 'destructive', onPress: () => void cancelSubscription() },
                            ])}
                        />
                    ) : null}
                </ScreenScroll>
                <StickyBottomAction
                    primaryLabel={`${primaryLabel} · ${formatAmd(orderTotal, language)}`}
                    primaryIcon={step === 3 ? 'check' : 'arrow_forward'}
                    primaryLoading={processing}
                    onPrimary={step === 3 ? activate : next}
                    secondaryLabel={step > 0 ? copy.back : undefined}
                    onSecondary={step > 0 ? () => { setError(''); setStep((value) => value - 1); } : undefined}
                />
            </View>
        </ModalScreen>
    );
}
const styles = StyleSheet.create({
    modalBody: { flex: 1 },
    scrollWithFooter: { paddingBottom: 24 },
    progressHeader: { marginTop: 8 }, stepLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 }, stepLabel: { flex: 1, textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 12 }, progressRail: { flexDirection: 'row', gap: 6, marginTop: 10 }, progressSegment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E9E0E5' }, progressSegmentActive: { backgroundColor: LousaPalette.berry },
    intro: { marginTop: 24, marginBottom: 20 }, title: { fontFamily: 'sans-serif-medium', fontSize: 29, lineHeight: 35, letterSpacing: -0.3 }, subtitle: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 20, marginTop: 7 }, stepBody: { gap: 12 },
    planPress: { marginBottom: 12 }, planCard: { overflow: 'hidden' }, planSelected: { borderColor: LousaPalette.rose, borderWidth: 1.5 }, planImage: { width: '100%', height: 170, backgroundColor: '#F8EFF2' }, planContent: { padding: 17 }, planHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, planNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, planName: { fontFamily: 'serif', fontSize: 24 }, planDescription: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18, marginTop: 3 }, planCapacity: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: 8 }, planPrice: { color: LousaPalette.berry, fontFamily: 'sans-serif-medium', fontSize: 14, marginTop: 12 }, radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: LousaPalette.berry },
    fieldLabel: { fontFamily: 'sans-serif-medium', fontSize: 14 }, fieldGap: { marginTop: 20 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 }, chip: { minHeight: 48, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 }, chipText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
    toggleGroup: { marginTop: 18, gap: 1 }, toggleRow: { minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LousaPalette.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, toggleTitle: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 13 }, switchTrack: { width: 48, height: 29, borderRadius: 15, backgroundColor: '#DDD3D8', padding: 3 }, switchOn: { backgroundColor: LousaPalette.berry }, switchThumb: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#fff' }, switchThumbOn: { alignSelf: 'flex-end' },
    mapAddressCard: { minHeight: 92, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 14, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
    mapAddressIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8E7ED' },
    mapAddressTitle: { fontFamily: 'sans-serif-medium', fontSize: 13.5 },
    mapAddressText: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 3 },
    mapVerifiedText: { color: LousaPalette.success, fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 16, marginTop: 5 },
    input: { minHeight: 52, borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, fontFamily: 'sans-serif', fontSize: 14, marginTop: 9 }, textArea: { minHeight: 90, paddingTop: 14, textAlignVertical: 'top' },
    deliveryTarget: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 }, eyebrow: { fontFamily: 'sans-serif-medium', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1 }, deliveryDate: { fontFamily: 'sans-serif-medium', fontSize: 21, marginTop: 2 }, deliveryRange: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 3 }, privacyRow: { marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LousaPalette.line, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, privacyText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17 },
    reviewImage: { width: '100%', height: 240, borderRadius: 28, backgroundColor: '#F8EFF2' }, summaryRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 9 }, summaryLabel: { width: 78, fontFamily: 'sans-serif-medium', fontSize: 12 }, summaryValue: { flex: 1, textAlign: 'right', fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 17 }, divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14, opacity: 0.55 }, priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, priceColumn: { flexDirection: 'column', alignItems: 'flex-start' }, total: { fontFamily: 'serif', fontSize: 31, marginTop: 3 },
    profileLength: { fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 18, marginTop: 10 }, explainText: { fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18, marginTop: 8 }, estimateLead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 }, estimateNumber: { fontFamily: 'serif', fontSize: 42, lineHeight: 46, marginTop: 2 }, exactPromise: { fontFamily: 'sans-serif-medium', fontSize: 14, lineHeight: 20, marginTop: 16 }, estimateAction: { minHeight: 50, borderRadius: 16, backgroundColor: LousaPalette.berry, marginTop: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, estimateActionText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 14 }, recommendActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, smallAction: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: LousaPalette.line, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDFE' }, smallActionActive: { borderColor: LousaPalette.rose, backgroundColor: '#F8E7ED' }, smallActionText: { fontFamily: 'sans-serif-medium', fontSize: 12.5, color: LousaPalette.inkSoft }, smallActionTextActive: { color: LousaPalette.berry }, consentRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12 }, checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: LousaPalette.line, alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { backgroundColor: LousaPalette.berry, borderColor: LousaPalette.berry }, consentText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12.5, lineHeight: 18 }, allowanceCard: { marginTop: 12 }, allowanceRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, allowanceLabel: { fontFamily: 'sans-serif', fontSize: 12 }, allowanceValue: { fontFamily: 'sans-serif-medium', fontSize: 13 }, paymentMethod: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, priceTop: { marginTop: 18 },
    stickyPriceCard: { marginTop: 18 }, stickyPriceRows: { gap: 8 }, stickyPriceLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, stickyPriceLabel: { fontFamily: 'sans-serif', fontSize: 12 }, stickyPriceValue: { fontFamily: 'sans-serif-medium', fontSize: 13 }, stickyTotalLine: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, stickyTotalLabel: { fontFamily: 'sans-serif-medium', fontSize: 15 }, stickyTotalValue: { fontFamily: 'serif', fontSize: 25 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 }, backSemanticButton: { minWidth: 112 }, actionsColumn: { flexDirection: 'column' }, backButton: { minWidth: 104, minHeight: 54, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 15 }, backText: { fontFamily: 'sans-serif-medium', fontSize: 13 }, error: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 12.5, textAlign: 'center', marginTop: 14 }, cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, cancelText: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 13 },
});
