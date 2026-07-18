import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ModalScreen, ScreenScroll } from '../../src/components/layout';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { PressScale, PrimaryAction, SectionHeader, SurfaceCard } from '../../src/components/ui';
import { useBoxStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';

const COPY = {
  ru: { title: 'Отзыв о боксе', intro: 'Твои ответы изменят количество и состав следующего бокса.', enough: 'Средств хватило?', yes: 'Да', no: 'Нет', liked: 'Что понравилось?', remove: 'Что убрать в следующий раз?', allergy: 'Была аллергическая реакция?', packaging: 'Упаковка', delivery: 'Доставка', note: 'Комментарий', placeholder: 'Что стоит изменить?', save: 'Сохранить отзыв', saved: 'Отзыв сохранён' },
  en: { title: 'Box feedback', intro: 'Your answers will adjust the quantity and contents of your next box.', enough: 'Were there enough products?', yes: 'Yes', no: 'No', liked: 'What did you like?', remove: 'What should be removed next time?', allergy: 'Any allergic reaction?', packaging: 'Packaging', delivery: 'Delivery', note: 'Comment', placeholder: 'What should change?', save: 'Save feedback', saved: 'Feedback saved' },
  hy: { title: 'Բոքսի կարծիք', intro: 'Քո պատասխանները կփոխեն հաջորդ բոքսի քանակն ու պարունակությունը։', enough: 'Միջոցները բավարա՞ր էին', yes: 'Այո', no: 'Ոչ', liked: 'Ի՞նչը հավանեցիր', remove: 'Ի՞նչը հեռացնել հաջորդ անգամ', allergy: 'Ալերգիկ ռեակցիա եղե՞լ է', packaging: 'Փաթեթավորում', delivery: 'Առաքում', note: 'Մեկնաբանություն', placeholder: 'Ի՞նչը փոխել', save: 'Պահպանել', saved: 'Կարծիքը պահպանվեց' },
} as const;

export default function BoxFeedbackScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((state) => state.language);
  const copy = COPY[language];
  const box = useBoxStore();
  const order = box.orders.find((item) => item.status === 'delivered') || box.orders[0];
  const existing = useMemo(() => box.feedback.find((item) => item.orderId === order?.id), [box.feedback, order?.id]);
  const [enough, setEnough] = useState<boolean | null>(existing?.enoughItems ?? null);
  const [liked, setLiked] = useState<string[]>(existing?.likedItems ?? []);
  const [remove, setRemove] = useState<string[]>(existing?.removeItems ?? []);
  const [allergy, setAllergy] = useState<boolean | null>(existing?.allergyReaction ?? null);
  const [packaging, setPackaging] = useState(existing?.packagingRating ?? 0);
  const [delivery, setDelivery] = useState(existing?.deliveryRating ?? 0);
  const [note, setNote] = useState(existing?.note ?? '');

  const toggle = (list: string[], value: string, setList: (next: string[]) => void) => setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const save = () => {
    if (!order) return router.back();
    box.addFeedback({
      orderId: order.id,
      enoughItems: enough,
      tooFewCategories: enough === false ? ['menstrual'] : [],
      tooManyCategories: remove,
      likedItems: liked,
      removeItems: remove,
      allergyReaction: allergy,
      packagingRating: packaging || null,
      deliveryRating: delivery || null,
      note: note.trim(),
    });
    router.back();
  };

  const BooleanChoice = ({ value, onChange }: { value: boolean | null; onChange: (next: boolean) => void }) => (
    <View style={styles.rowChoices}>
      {[true, false].map((item) => <PressScale key={String(item)} onPress={() => onChange(item)} style={[styles.choice, { borderColor: value === item ? LousaPalette.berry : colors.outlineVariant, backgroundColor: value === item ? (isDark ? 'rgba(217,133,165,0.18)' : '#F8E7ED') : 'transparent' }]}><Text style={[styles.choiceText, { color: value === item ? LousaPalette.berry : colors.onSurfaceVariant }]}>{item ? copy.yes : copy.no}</Text></PressScale>)}
    </View>
  );

  if (!order) return <ModalScreen title={copy.title} closeIcon="arrow_back"><ScreenScroll><Text style={{ color: colors.onSurfaceVariant }}>{copy.intro}</Text></ScreenScroll></ModalScreen>;

  return <ModalScreen title={copy.title} closeIcon="arrow_back" keyboard>
    <ScreenScroll keyboardShouldPersistTaps="handled">
      <Text style={[styles.intro, { color: colors.onSurfaceVariant }]}>{copy.intro}</Text>

      <SectionHeader title={copy.enough} />
      <SurfaceCard padding={16}><BooleanChoice value={enough} onChange={setEnough} /></SurfaceCard>

      <SectionHeader title={copy.liked} />
      <SurfaceCard padding={14}><View style={styles.chips}>{order.items.map((item) => <PressScale key={item.id} onPress={() => toggle(liked, item.name, setLiked)} style={[styles.chip, { borderColor: liked.includes(item.name) ? LousaPalette.berry : colors.outlineVariant, backgroundColor: liked.includes(item.name) ? (isDark ? 'rgba(217,133,165,0.18)' : '#F8E7ED') : 'transparent' }]}><MaterialSymbol name={liked.includes(item.name) ? 'favorite' : 'favorite_border'} size={16} color={liked.includes(item.name) ? LousaPalette.berry : colors.onSurfaceVariant} /><Text style={[styles.chipText, { color: liked.includes(item.name) ? LousaPalette.berry : colors.onSurfaceVariant }]}>{item.name}</Text></PressScale>)}</View></SurfaceCard>

      <SectionHeader title={copy.remove} />
      <SurfaceCard padding={14}><View style={styles.chips}>{order.items.filter((item) => item.replaceable).map((item) => <PressScale key={item.id} onPress={() => toggle(remove, item.name, setRemove)} style={[styles.chip, { borderColor: remove.includes(item.name) ? LousaPalette.danger : colors.outlineVariant, backgroundColor: remove.includes(item.name) ? 'rgba(185,79,98,0.08)' : 'transparent' }]}><MaterialSymbol name={remove.includes(item.name) ? 'remove_circle' : 'circle'} size={16} color={remove.includes(item.name) ? LousaPalette.danger : colors.onSurfaceVariant} /><Text style={[styles.chipText, { color: remove.includes(item.name) ? LousaPalette.danger : colors.onSurfaceVariant }]}>{item.name}</Text></PressScale>)}</View></SurfaceCard>

      <SectionHeader title={copy.allergy} />
      <SurfaceCard padding={16}><BooleanChoice value={allergy} onChange={setAllergy} /></SurfaceCard>

      <SectionHeader title={copy.packaging} />
      <Rating value={packaging} onChange={setPackaging} />
      <SectionHeader title={copy.delivery} />
      <Rating value={delivery} onChange={setDelivery} />

      <SectionHeader title={copy.note} />
      <SurfaceCard padding={16}><TextInput value={note} onChangeText={setNote} placeholder={copy.placeholder} placeholderTextColor={colors.outline} multiline style={[styles.input, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]} /></SurfaceCard>

      <View style={styles.save}><PrimaryAction label={copy.save} icon="check" onPress={save} /></View>
    </ScreenScroll>
  </ModalScreen>;
}

function Rating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { colors } = useTheme();
  return <SurfaceCard padding={16}><View style={styles.rating}>{[1,2,3,4,5].map((item) => <PressScale key={item} onPress={() => onChange(item)} style={styles.star}><MaterialSymbol name={item <= value ? 'star' : 'star_border'} size={30} color={item <= value ? LousaPalette.berry : colors.outlineVariant} /></PressScale>)}</View></SurfaceCard>;
}

const styles = StyleSheet.create({
  intro: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  rowChoices: { flexDirection: 'row', gap: 10 }, choice: { flex: 1, minHeight: 48, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, choiceText: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 48, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 }, chipText: { maxWidth: 220, fontFamily: 'sans-serif-medium', fontSize: 12 },
  rating: { flexDirection: 'row', justifyContent: 'space-around' }, star: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 18, padding: 14, fontFamily: 'sans-serif', fontSize: 14, textAlignVertical: 'top' }, save: { marginTop: 24 },
});
