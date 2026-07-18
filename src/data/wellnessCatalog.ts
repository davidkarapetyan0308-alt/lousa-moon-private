import { MoodType, SymptomType } from '../store';
import { SupportedLanguage } from '../domain/models';

export const MOOD_ITEMS: { id: MoodType; icon: string }[] = [
  { id: 'calm', icon: 'sentiment_calm' },
  { id: 'happy', icon: 'sentiment_very_satisfied' },
  { id: 'sad', icon: 'sentiment_sad' },
  { id: 'anxious', icon: 'sentiment_stressed' },
  { id: 'irritable', icon: 'sentiment_dissatisfied' },
];

export const SYMPTOM_ITEMS: { id: SymptomType; icon: string }[] = [
  { id: 'cramps', icon: 'healing' },
  { id: 'headache', icon: 'psychology' },
  { id: 'migraine', icon: 'neurology' },
  { id: 'fatigue', icon: 'battery_alert' },
  { id: 'bloating', icon: 'bubble_chart' },
  { id: 'cravings', icon: 'restaurant' },
  { id: 'backpain', icon: 'accessibility_new' },
  { id: 'insomnia', icon: 'bedtime' },
  { id: 'chills', icon: 'ac_unit' },
  { id: 'breast_tenderness', icon: 'favorite' },
  { id: 'nausea', icon: 'sick' },
  { id: 'skin_irritation', icon: 'dermatology' },
  { id: 'other', icon: 'more_horiz' },
];

export const MOOD_LABELS: Record<SupportedLanguage, Record<MoodType, string>> = {
  ru: { calm: 'Спокойно', happy: 'Радостно', sad: 'Грустно', tired: 'Устала', anxious: 'Тревожно', irritable: 'Раздражённо' },
  en: { calm: 'Calm', happy: 'Happy', sad: 'Sad', tired: 'Tired', anxious: 'Anxious', irritable: 'Irritable' },
  hy: { calm: 'Հանգիստ', happy: 'Ուրախ', sad: 'Տխուր', tired: 'Հոգնած', anxious: 'Անհանգիստ', irritable: 'Գրգռված' },
};

export const SYMPTOM_LABELS: Record<SupportedLanguage, Record<SymptomType, string>> = {
  ru: {
    cramps: 'Спазмы', headache: 'Головная боль', migraine: 'Мигрень', fatigue: 'Усталость', bloating: 'Вздутие', cravings: 'Тяга к еде',
    backpain: 'Боль в спине', insomnia: 'Бессонница', chills: 'Озноб', breast_tenderness: 'Чувствительность груди', nausea: 'Тошнота',
    skin_irritation: 'Раздражение кожи', other: 'Другое',
  },
  en: {
    cramps: 'Cramps', headache: 'Headache', migraine: 'Migraine', fatigue: 'Fatigue', bloating: 'Bloating', cravings: 'Cravings',
    backpain: 'Back pain', insomnia: 'Insomnia', chills: 'Chills', breast_tenderness: 'Breast tenderness', nausea: 'Nausea',
    skin_irritation: 'Skin irritation', other: 'Other',
  },
  hy: {
    cramps: 'Սպազմեր', headache: 'Գլխացավ', migraine: 'Միգրեն', fatigue: 'Հոգնածություն', bloating: 'Փքվածություն', cravings: 'Սննդի ցանկություն',
    backpain: 'Մեջքի ցավ', insomnia: 'Անքնություն', chills: 'Դող', breast_tenderness: 'Կրծքի զգայունություն', nausea: 'Սրտխառնոց',
    skin_irritation: 'Մաշկի գրգռում', other: 'Այլ',
  },
};
