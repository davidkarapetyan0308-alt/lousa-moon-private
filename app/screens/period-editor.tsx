import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { DateCalendarPicker } from '../../src/components/DateCalendarPicker';
import { ModalScreen, ScreenScroll } from '../../src/components/layout';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { PressScale, PrimaryAction, SectionHeader, SurfaceCard } from '../../src/components/ui';
import { FlowLevel } from '../../src/domain/models';
import { useCycleStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { addLocalDays, differenceInLocalDays, fromLocalDateString, toLocalDateString } from '../../src/utils/date';

const FLOWS: FlowLevel[] = ['spotting', 'light', 'medium', 'heavy', 'very_heavy'];
const COPY = {
  ru: {
    title: 'Редактор менструации', start: 'Первый день', end: 'Последний день', noEnd: 'Ещё продолжается', flow: 'Интенсивность по дням',
    pain: 'Боль 0–10', products: 'Использовано средств', leak: 'Ночное протекание', note: 'Заметка', save: 'Сохранить', delete: 'Удалить запись',
    invalid: 'Дата окончания не может быть раньше начала.', deleteTitle: 'Удалить запись?', cancel: 'Отмена', yes: 'Да', no: 'Нет',
    flows: { spotting: 'Spotting', light: 'Лёгкая', medium: 'Средняя', heavy: 'Обильная', very_heavy: 'Очень обильная' },
  },
  en: {
    title: 'Period editor', start: 'First day', end: 'Last day', noEnd: 'Still ongoing', flow: 'Daily flow', pain: 'Pain 0–10', products: 'Products used', leak: 'Night leakage', note: 'Note', save: 'Save', delete: 'Delete record',
    invalid: 'The end date cannot be before the start date.', deleteTitle: 'Delete this record?', cancel: 'Cancel', yes: 'Yes', no: 'No',
    flows: { spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy', very_heavy: 'Very heavy' },
  },
  hy: {
    title: 'Դաշտանի խմբագրիչ', start: 'Առաջին օրը', end: 'Վերջին օրը', noEnd: 'Դեռ շարունակվում է', flow: 'Օրական ինտենսիվություն', pain: 'Ցավ 0–10', products: 'Օգտագործված միջոցներ', leak: 'Գիշերային արտահոսք', note: 'Նշում', save: 'Պահպանել', delete: 'Ջնջել գրառումը',
    invalid: 'Ավարտի օրը չի կարող սկզբից շուտ լինել։', deleteTitle: 'Ջնջե՞լ գրառումը', cancel: 'Չեղարկել', yes: 'Այո', no: 'Ոչ',
    flows: { spotting: 'Թեթև spotting', light: 'Թեթև', medium: 'Միջին', heavy: 'Առատ', very_heavy: 'Շատ առատ' },
  },
} as const;

export default function PeriodEditorScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const { colors, isDark } = useTheme();
  const language = useUserStore((state) => state.language);
  const copy = COPY[language];
  const store = useCycleStore();
  const existing = params.id ? store.periodRecords.find((item) => item.id === params.id) : null;
  const today = toLocalDateString();

  const [startDate, setStartDate] = useState(existing?.startDate || params.date || today);
  const [endDate, setEndDate] = useState<string | null>(existing?.endDate || null);
  const [flowByDay, setFlowByDay] = useState<Record<string, FlowLevel>>(existing?.flowByDay || { [startDate]: 'medium' });
  const [painByDay, setPainByDay] = useState<Record<string, number>>(existing?.painByDay || {});
  const [productsUsedByDay, setProductsUsedByDay] = useState<Record<string, number>>(existing?.productsUsedByDay || {});
  const [nightLeakageByDay, setNightLeakageByDay] = useState<Record<string, boolean>>(existing?.nightLeakageByDay || {});
  const [notesByDay, setNotesByDay] = useState<Record<string, string>>(existing?.notesByDay || {});

  const days = useMemo(() => {
    const last = endDate && endDate >= startDate ? endDate : startDate;
    const length = Math.max(1, Math.min(14, differenceInLocalDays(fromLocalDateString(last), fromLocalDateString(startDate)) + 1));
    return Array.from({ length }, (_, index) => toLocalDateString(addLocalDays(startDate, index)));
  }, [startDate, endDate]);

  const save = () => {
    if (endDate && endDate < startDate) {
      Alert.alert(copy.invalid);
      return;
    }
    const payload = {
      startDate,
      endDate,
      confirmed: true,
      source: 'user' as const,
      needsReview: false,
      flowByDay,
      painByDay,
      productsUsedByDay,
      nightLeakageByDay,
      notesByDay,
    };
    if (existing) store.updatePeriodRecord(existing.id, payload);
    else store.addPeriodRecord(payload);
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(copy.deleteTitle, undefined, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.delete, style: 'destructive', onPress: () => { store.softDeletePeriodRecord(existing.id); router.back(); } },
    ]);
  };

  return (
    <ModalScreen title={copy.title} closeIcon="arrow_back" keyboard>
      <ScreenScroll contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionHeader title={copy.start} />
        <DateCalendarPicker value={startDate} onChange={(value) => { setStartDate(value); if (endDate && endDate < value) setEndDate(null); }} language={language} maximumDate={today} />

        <SectionHeader title={copy.end} />
        <SurfaceCard padding={16}>
          <PressScale onPress={() => setEndDate(null)} style={[styles.ongoing, { borderColor: endDate === null ? LousaPalette.berry : colors.outlineVariant, backgroundColor: endDate === null ? (isDark ? 'rgba(166,77,114,0.18)' : '#F8E7ED') : 'transparent' }]}>
            <MaterialSymbol name="timelapse" size={20} color={endDate === null ? LousaPalette.berry : colors.onSurfaceVariant} />
            <Text style={[styles.ongoingText, { color: endDate === null ? LousaPalette.berry : colors.onBackground }]}>{copy.noEnd}</Text>
          </PressScale>
        </SurfaceCard>
        {endDate !== null ? <DateCalendarPicker value={endDate} onChange={setEndDate} language={language} minimumDate={startDate} maximumDate={today} /> : (
          <PressScale onPress={() => setEndDate(startDate)} style={[styles.chooseEnd, { borderColor: colors.outlineVariant }]}>
            <Text style={[styles.chooseEndText, { color: colors.onBackground }]}>{copy.end}</Text>
          </PressScale>
        )}

        <SectionHeader title={copy.flow} />
        {days.map((date) => (
          <SurfaceCard key={date} padding={16}>
            <Text style={[styles.dayTitle, { color: colors.onBackground }]}>{new Date(`${date}T12:00:00`).toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'hy' ? 'hy-AM' : 'en-US', { day: 'numeric', month: 'long' })}</Text>
            <View style={styles.flowWrap}>
              {FLOWS.map((flow) => (
                <PressScale key={flow} onPress={() => setFlowByDay((current) => ({ ...current, [date]: flow }))} style={[styles.flowChip, { borderColor: flowByDay[date] === flow ? LousaPalette.berry : colors.outlineVariant, backgroundColor: flowByDay[date] === flow ? (isDark ? 'rgba(166,77,114,0.18)' : '#F8E7ED') : 'transparent' }]}>
                  <Text style={[styles.flowText, { color: flowByDay[date] === flow ? LousaPalette.berry : colors.onSurfaceVariant }]}>{copy.flows[flow]}</Text>
                </PressScale>
              ))}
            </View>
            <View style={styles.metricsRow}>
              <SmallNumberField label={copy.pain} value={painByDay[date] ?? 0} max={10} onChange={(value) => setPainByDay((current) => ({ ...current, [date]: value }))} />
              <SmallNumberField label={copy.products} value={productsUsedByDay[date] ?? 0} max={30} onChange={(value) => setProductsUsedByDay((current) => ({ ...current, [date]: value }))} />
            </View>
            <Text style={[styles.smallLabel, { color: colors.onBackground }]}>{copy.leak}</Text>
            <View style={styles.booleanRow}>
              {[false, true].map((value) => (
                <PressScale key={String(value)} onPress={() => setNightLeakageByDay((current) => ({ ...current, [date]: value }))} style={[styles.booleanChoice, { borderColor: nightLeakageByDay[date] === value ? LousaPalette.berry : colors.outlineVariant }]}>
                  <Text style={[styles.booleanText, { color: nightLeakageByDay[date] === value ? LousaPalette.berry : colors.onSurfaceVariant }]}>{value ? copy.yes : copy.no}</Text>
                </PressScale>
              ))}
            </View>
            <TextInput
              value={notesByDay[date] || ''}
              onChangeText={(value) => setNotesByDay((current) => ({ ...current, [date]: value }))}
              placeholder={copy.note}
              placeholderTextColor={colors.outline}
              style={[styles.noteInput, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}
            />
          </SurfaceCard>
        ))}

        <PrimaryAction label={copy.save} icon="check" onPress={save} />
        {existing ? (
          <PressScale onPress={remove} style={styles.deleteButton}>
            <MaterialSymbol name="delete" size={19} color={LousaPalette.danger} />
            <Text style={styles.deleteText}>{copy.delete}</Text>
          </PressScale>
        ) : null}
      </ScreenScroll>
    </ModalScreen>
  );
}

function SmallNumberField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.numberField}>
      <Text numberOfLines={2} style={[styles.smallLabel, { color: colors.onBackground }]}>{label}</Text>
      <View style={[styles.counter, { borderColor: colors.outlineVariant }]}>
        <PressScale onPress={() => onChange(Math.max(0, value - 1))} style={styles.counterButton}><Text style={[styles.counterSign, { color: colors.onBackground }]}>−</Text></PressScale>
        <Text style={[styles.counterValue, { color: colors.onBackground }]}>{value}</Text>
        <PressScale onPress={() => onChange(Math.min(max, value + 1))} style={styles.counterButton}><Text style={[styles.counterSign, { color: colors.onBackground }]}>+</Text></PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 18 },
  ongoing: { minHeight: 48, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ongoingText: { fontFamily: 'sans-serif-medium', fontSize: 14 },
  chooseEnd: { minHeight: 50, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chooseEndText: { fontFamily: 'sans-serif-medium', fontSize: 14 },
  dayTitle: { fontFamily: 'sans-serif-medium', fontSize: 17, marginBottom: 12 },
  flowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flowChip: { minHeight: 48, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  flowText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  metricsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  numberField: { flex: 1, gap: 8 },
  smallLabel: { fontFamily: 'sans-serif-medium', fontSize: 12, lineHeight: 16 },
  counter: { height: 44, borderWidth: 1, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  counterSign: { fontFamily: 'sans-serif-medium', fontSize: 19 },
  counterValue: { fontFamily: 'sans-serif-medium', fontSize: 15 },
  booleanRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  booleanChoice: { minHeight: 48, minWidth: 74, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  booleanText: { fontFamily: 'sans-serif-medium', fontSize: 12 },
  noteInput: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, marginTop: 12, fontFamily: 'sans-serif', fontSize: 14 },
  deleteButton: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 14 },
});
