import { SupportedLanguage } from '../domain/models';

export type BoxPlanId = 'essential' | 'comfort' | 'ritual';
export type LocalizedText = Record<SupportedLanguage, string>;

export interface BoxPlan {
  id: BoxPlanId;
  name: string;
  monthlyPriceAmd: number;
  description: LocalizedText;
  accent: string;
  items: LocalizedText[];
  includedUnits: number;
  extraUnitPriceAmd: number;
  includedAddOns: { heatPad: boolean; tea: boolean; chocolate: boolean };
}

const text = (ru: string, en: string, hy: string): LocalizedText => ({ ru, en, hy });

export const BOX_PLANS: BoxPlan[] = [
  {
    id: 'essential',
    name: 'Essential',
    monthlyPriceAmd: 8900,
    description: text(
      'Базовая поддержка на дни менструации.',
      'Essential support for period days.',
      'Հիմնական աջակցություն դաշտանի օրերի համար։'
    ),
    accent: '#D985A5',
    includedUnits: 16,
    extraUnitPriceAmd: 175,
    includedAddOns: { heatPad: false, tea: true, chocolate: true },
    items: [
      text('Прокладки или тампоны', 'Pads or tampons', 'Միջադիրներ կամ տամպոններ'),
      text('Травяной чай', 'Herbal tea', 'Բուսական թեյ'),
      text('Мини-шоколад', 'Mini chocolate', 'Փոքր շոկոլադ'),
      text('Карточка самонаблюдения', 'Reflection card', 'Ինքնադիտարկման քարտ'),
    ],
  },
  {
    id: 'comfort',
    name: 'Comfort',
    monthlyPriceAmd: 14900,
    description: text(
      'Больше тепла, текстиля и бережного ухода.',
      'More warmth, textiles and gentle care.',
      'Ավելի շատ ջերմություն, տեքստիլ և նուրբ խնամք։'
    ),
    accent: '#A64D72',
    includedUnits: 24,
    extraUnitPriceAmd: 150,
    includedAddOns: { heatPad: true, tea: true, chocolate: true },
    items: [
      text('Всё из Essential', 'Everything in Essential', 'Essential-ի ամբողջ պարունակությունը'),
      text('Многоразовая грелка', 'Reusable heat pad', 'Բազմակի օգտագործման տաքացուցիչ'),
      text('Средство интимного ухода', 'Intimate-care product', 'Ինտիմ խնամքի միջոց'),
      text('Маска для сна', 'Sleep mask', 'Քնի դիմակ'),
      text('Комфортные носки', 'Comfort socks', 'Հարմարավետ գուլպաներ'),
    ],
  },
  {
    id: 'ritual',
    name: 'Moon Ritual',
    monthlyPriceAmd: 22900,
    description: text(
      'Премиальный персональный набор и особый подарок месяца.',
      'A premium personalized set with a monthly gift.',
      'Պրեմիում անհատական հավաքածու և ամսվա հատուկ նվեր։'
    ),
    accent: '#5B365F',
    includedUnits: 32,
    extraUnitPriceAmd: 125,
    includedAddOns: { heatPad: true, tea: true, chocolate: true },
    items: [
      text('Всё из Comfort', 'Everything in Comfort', 'Comfort-ի ամբողջ պարունակությունը'),
      text('Свеча в сливовом стекле', 'Muted-plum glass candle', 'Սալորագույն ապակե մոմ'),
      text('Лунный дневник', 'Moon journal', 'Լուսնային օրագիր'),
      text('Серебряный аксессуар', 'Moon-silver accessory', 'Արծաթագույն աքսեսուար'),
      text('Особый подарок месяца', 'Monthly special gift', 'Ամսվա հատուկ նվեր'),
    ],
  },
];

export const DELIVERY_STEPS = [
  { id: 'scheduled', label: text('Бокс запланирован', 'Box scheduled', 'Բոքսը պլանավորված է'), icon: 'event_available' },
  { id: 'packing', label: text('Собираем под твой цикл', 'Packing for your cycle', 'Հավաքում ենք ըստ քո ցիկլի'), icon: 'inventory_2' },
  { id: 'courier', label: text('Курьер в пути', 'Courier on the way', 'Առաքիչը ճանապարհին է'), icon: 'moped' },
  { id: 'delivered', label: text('Бокс доставлен', 'Box delivered', 'Բոքսը առաքված է'), icon: 'check_circle' },
] as const;

export function localizedText(value: LocalizedText, language: SupportedLanguage): string {
  return value[language] || value.ru;
}

export function formatAmd(amount: number, language: SupportedLanguage = 'ru'): string {
  const locale = language === 'en' ? 'en-US' : language === 'hy' ? 'hy-AM' : 'ru-RU';
  return `${new Intl.NumberFormat(locale).format(amount)} ֏`;
}
