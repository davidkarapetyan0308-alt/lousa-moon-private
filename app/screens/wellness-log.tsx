import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ModalScreen, ScreenScroll, useResponsiveLayout } from '../../src/components/layout';
import { IconBubble, PressScale, PrimaryButton, SectionHeader, SurfaceCard } from '../../src/components/ui';
import { MOOD_ITEMS, MOOD_LABELS, SYMPTOM_ITEMS, SYMPTOM_LABELS } from '../../src/data/wellnessCatalog';
import { FlowLevel } from '../../src/domain/models';
import { MoodType, SymptomType, useCycleStore, useUserStore, useWellnessStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { differenceInLocalDays, fromLocalDateString, toLocalDateString } from '../../src/utils/date';

const FLOW_OPTIONS: FlowLevel[] = ['spotting', 'light', 'medium', 'heavy', 'very_heavy'];

const COPY = {
  ru: {
    title: 'Запись состояния', subtitle: 'Отметь главное за сегодня. Эти данные помогают видеть закономерности, но даты цикла прогнозируются по подтверждённой истории менструаций.',
    mood: 'Настроение', energy: 'Энергия', symptoms: 'Симптомы', period: 'Менструальные данные', flow: 'Интенсивность', pain: 'Боль', products: 'Использовано средств', leak: 'Ночное протекание',
    water: 'Вода', sleep: 'Сон', notes: 'Личная заметка', placeholder: 'Что важно запомнить об этом дне?', save: 'Сохранить запись', glasses: 'стак.', hours: 'ч', none: 'Не отмечать', yes: 'Да', no: 'Нет',
    fertility: 'Дополнительные признаки овуляции', fertilityInfo: 'Необязательный раздел. Календарный прогноз не подтверждает овуляцию и не является методом контрацепции.', basal: 'Базальная температура', mucus: 'Цервикальная слизь', lh: 'Тест ЛГ', negative: 'Отрицательный', positive: 'Положительный', dry: 'Сухо', sticky: 'Липкая', creamy: 'Кремовая', watery: 'Водянистая', eggWhite: 'Как яичный белок', showAdvanced: 'Добавить признаки', hideAdvanced: 'Скрыть раздел',
    flowLabels: { spotting: 'Spotting', light: 'Лёгкая', medium: 'Средняя', heavy: 'Обильная', very_heavy: 'Очень обильная' },
    energyLabels: ['Очень низкая', 'Низкая', 'Средняя', 'Хорошая', 'Высокая'],
  },
  en: {
    title: 'Daily check-in', subtitle: 'Log what matters today. These entries reveal patterns, while cycle dates are predicted mainly from confirmed period history.',
    mood: 'Mood', energy: 'Energy', symptoms: 'Symptoms', period: 'Menstrual data', flow: 'Flow', pain: 'Pain', products: 'Products used', leak: 'Night leak',
    water: 'Water', sleep: 'Sleep', notes: 'Personal note', placeholder: 'What would you like to remember about today?', save: 'Save check-in', glasses: 'gl.', hours: 'h', none: 'Not now', yes: 'Yes', no: 'No',
    fertility: 'Optional ovulation signs', fertilityInfo: 'Optional. A calendar forecast does not confirm ovulation and is not contraception.', basal: 'Basal temperature', mucus: 'Cervical mucus', lh: 'LH test', negative: 'Negative', positive: 'Positive', dry: 'Dry', sticky: 'Sticky', creamy: 'Creamy', watery: 'Watery', eggWhite: 'Egg-white', showAdvanced: 'Add fertility signs', hideAdvanced: 'Hide section',
    flowLabels: { spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy', very_heavy: 'Very heavy' },
    energyLabels: ['Very low', 'Low', 'Medium', 'Good', 'High'],
  },
  hy: {
    title: 'Օրվա գրառում', subtitle: 'Նշիր այսօրվա կարևոր տվյալները։ Դրանք օգնում են տեսնել օրինաչափությունները, իսկ ցիկլի ամսաթվերը կանխատեսվում են հիմնականում հաստատված դաշտանների պատմությունից։',
    mood: 'Տրամադրություն', energy: 'Էներգիա', symptoms: 'Ախտանիշներ', period: 'Դաշտանային տվյալներ', flow: 'Արյունահոսություն', pain: 'Ցավ', products: 'Օգտագործված միջոցներ', leak: 'Գիշերային արտահոսք',
    water: 'Ջուր', sleep: 'Քուն', notes: 'Անձնական նշում', placeholder: 'Ի՞նչն է կարևոր հիշել այս օրվա մասին։', save: 'Պահպանել', glasses: 'բաժ.', hours: 'ժ', none: 'Չնշել', yes: 'Այո', no: 'Ոչ',
    fertility: 'Օվուլյացիայի լրացուցիչ նշաններ', fertilityInfo: 'Ոչ պարտադիր բաժին։ Օրացուցային կանխատեսումը չի հաստատում օվուլյացիան և հակաբեղմնավորում չէ։', basal: 'Բազալ ջերմաստիճան', mucus: 'Արգանդի վզիկի լորձ', lh: 'ԼՀ թեստ', negative: 'Բացասական', positive: 'Դրական', dry: 'Չոր', sticky: 'Կպչուն', creamy: 'Կրեմային', watery: 'Ջրիկ', eggWhite: 'Ձվի սպիտակուցի նման', showAdvanced: 'Ավելացնել նշաններ', hideAdvanced: 'Թաքցնել բաժինը',
    flowLabels: { spotting: 'Թեթև հետքեր', light: 'Թեթև', medium: 'Միջին', heavy: 'Առատ', very_heavy: 'Շատ առատ' },
    energyLabels: ['Շատ ցածր', 'Ցածր', 'Միջին', 'Լավ', 'Բարձր'],
  },
} as const;

export default function LogStateScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((state) => state.language);
  const copy = COPY[language];
  const { compactWidth } = useResponsiveLayout();
  const today = toLocalDateString();
  const store = useWellnessStore();
  const existing = store.getLog(today);

  const [mood, setMood] = useState<MoodType | null>(existing.mood);
  const [symptoms, setSymptoms] = useState<SymptomType[]>(existing.symptoms);
  const [energy, setEnergy] = useState(existing.energy || 3);
  const [water, setWater] = useState(existing.water);
  const [sleep, setSleep] = useState(existing.sleep);
  const [flow, setFlow] = useState<FlowLevel | null>(existing.flow);
  const [painLevel, setPainLevel] = useState<number | null>(existing.painLevel);
  const [productsUsed, setProductsUsed] = useState<number | null>(existing.productsUsed);
  const [nightLeak, setNightLeak] = useState(existing.nightLeak);
  const [notes, setNotes] = useState(existing.notes);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(existing.basalTemperature || existing.cervicalMucus || existing.lhTest));
  const [basalTemperature, setBasalTemperature] = useState(existing.basalTemperature ? String(existing.basalTemperature) : '');
  const [cervicalMucus, setCervicalMucus] = useState(existing.cervicalMucus);
  const [lhTest, setLhTest] = useState(existing.lhTest);
  const [saving, setSaving] = useState(false);

  const moodLabels = MOOD_LABELS[language];
  const symptomLabels = SYMPTOM_LABELS[language];
  const energyOptions = useMemo(() => [1, 2, 3, 4, 5], []);

  const toggleSymptom = (id: SymptomType) => {
    setSymptoms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    if (mood) store.setMood(today, mood);
    const currentSymptoms = useWellnessStore.getState().getLog(today).symptoms;
    SYMPTOM_ITEMS.forEach(({ id }) => {
      if (currentSymptoms.includes(id) !== symptoms.includes(id)) store.toggleSymptom(today, id);
    });
    store.setEnergy(today, energy);
    store.setSleep(today, sleep);
    store.setNotes(today, notes.trim());
    store.setFlow(today, flow);
    store.setPainLevel(today, painLevel);
    store.setProductsUsed(today, productsUsed);
    store.setNightLeak(today, nightLeak);
    const parsedTemperature = Number.parseFloat(basalTemperature.replace(',', '.'));
    store.setFertilitySignal(today, {
      basalTemperature: Number.isFinite(parsedTemperature) && parsedTemperature >= 34 && parsedTemperature <= 42 ? parsedTemperature : null,
      cervicalMucus,
      lhTest,
    });

    if (flow) {
      const cycle = useCycleStore.getState();
      const matching = cycle.periodRecords.find((record) => {
        const offset = differenceInLocalDays(fromLocalDateString(today), fromLocalDateString(record.startDate));
        if (offset < 0 || offset > 14) return false;
        return !record.endDate || today <= record.endDate || offset <= 10;
      });
      if (matching) {
        cycle.setFlowForDate(matching.id, today, flow);
        if (flow !== 'spotting' && (!matching.endDate || today > matching.endDate)) cycle.setPeriodEnd(matching.id, today);
      } else if (flow !== 'spotting') {
        cycle.addPeriodRecord({
          startDate: today,
          endDate: today,
          confirmed: true,
          source: 'user',
          flowByDay: { [today]: flow },
        });
      }
    }

    useWellnessStore.setState((state) => ({
      dailyLogs: { ...state.dailyLogs, [today]: { ...state.getLog(today), water } },
    }));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setSaving(false);
    router.back();
  };

  return (
    <ModalScreen title={copy.title} keyboard>
      <View style={styles.screenBody}>
        <ScreenScroll contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{copy.subtitle}</Text>

          <SectionHeader title={copy.mood} />
          <View style={[styles.moodGrid, compactWidth && styles.twoColumns]}>
            {MOOD_ITEMS.map((item) => {
              const selected = mood === item.id;
              return (
                <PressScale key={item.id} onPress={() => setMood(item.id)} style={[styles.moodCard, compactWidth && styles.moodCardCompact, cardState(selected, isDark)]}>
                  <MaterialSymbol name={item.icon} size={24} color={selected ? LousaPalette.berry : colors.onSurfaceVariant} />
                  <Text numberOfLines={2} style={[styles.moodText, { color: selected ? LousaPalette.berry : colors.onSurfaceVariant }]}>{moodLabels[item.id]}</Text>
                </PressScale>
              );
            })}
          </View>

          <SectionHeader title={copy.energy} />
          <SurfaceCard padding={16}>
            <View style={styles.energyRow}>
              {energyOptions.map((value) => {
                const selected = energy === value;
                return (
                  <PressScale key={value} onPress={() => setEnergy(value)} style={[styles.energyCircle, selected && styles.energyCircleSelected, { borderColor: selected ? LousaPalette.berry : colors.outlineVariant }]}>
                    <Text style={[styles.energyNumber, { color: selected ? '#FFFFFF' : colors.onBackground }]}>{value}</Text>
                  </PressScale>
                );
              })}
            </View>
            <Text style={[styles.scaleLabel, { color: colors.onSurfaceVariant }]}>{copy.energyLabels[energy - 1]}</Text>
          </SurfaceCard>

          <SectionHeader title={copy.symptoms} />
          <SurfaceCard padding={14}>
            <View style={styles.symptomWrap}>
              {SYMPTOM_ITEMS.map((item) => {
                const selected = symptoms.includes(item.id);
                return (
                  <PressScale key={item.id} onPress={() => toggleSymptom(item.id)} style={[styles.symptomChip, cardState(selected, isDark)]}>
                    <MaterialSymbol name={item.icon} size={17} color={selected ? LousaPalette.berry : colors.onSurfaceVariant} />
                    <Text style={[styles.symptomText, { color: selected ? LousaPalette.berry : colors.onSurfaceVariant }]}>{symptomLabels[item.id]}</Text>
                  </PressScale>
                );
              })}
            </View>
          </SurfaceCard>

          <SectionHeader title={copy.period} />
          <SurfaceCard padding={16}>
            <Text style={[styles.fieldLabel, { color: colors.onBackground }]}>{copy.flow}</Text>
            <View style={styles.optionWrap}>
              <Choice label={copy.none} selected={flow === null} onPress={() => setFlow(null)} />
              {FLOW_OPTIONS.map((value) => <Choice key={value} label={copy.flowLabels[value]} selected={flow === value} onPress={() => setFlow(value)} />)}
            </View>

            <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.pain}: {painLevel ?? '—'}/10</Text>
            <View style={styles.numberRow}>{[0, 2, 4, 6, 8, 10].map((value) => <Choice key={value} label={String(value)} selected={painLevel === value} onPress={() => setPainLevel(value)} compact />)}</View>

            <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.products}: {productsUsed ?? '—'}</Text>
            <Counter value={productsUsed ?? 0} onMinus={() => setProductsUsed(Math.max(0, (productsUsed ?? 0) - 1))} onPlus={() => setProductsUsed(Math.min(20, (productsUsed ?? 0) + 1))} />

            <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.leak}</Text>
            <View style={styles.yesNo}><Choice label={copy.no} selected={!nightLeak} onPress={() => setNightLeak(false)} /><Choice label={copy.yes} selected={nightLeak} onPress={() => setNightLeak(true)} /></View>
          </SurfaceCard>

          <SectionHeader title={copy.fertility} actionLabel={showAdvanced ? copy.hideAdvanced : copy.showAdvanced} onAction={() => setShowAdvanced((value) => !value)} />
          {showAdvanced ? (
            <SurfaceCard padding={16}>
              <View style={styles.fertilityInfo}>
                <MaterialSymbol name="info" size={17} color={colors.onSurfaceVariant} />
                <Text style={[styles.fertilityInfoText, { color: colors.onSurfaceVariant }]}>{copy.fertilityInfo}</Text>
              </View>
              <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.basal}</Text>
              <TextInput
                value={basalTemperature}
                onChangeText={(value) => setBasalTemperature(value.replace(/[^0-9.,]/g, '').slice(0, 5))}
                keyboardType="decimal-pad"
                placeholder="36.6 °C"
                placeholderTextColor={colors.outline}
                style={[styles.temperatureInput, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]}
              />

              <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.mucus}</Text>
              <View style={styles.optionWrap}>
                <Choice label={copy.none} selected={cervicalMucus === null} onPress={() => setCervicalMucus(null)} />
                {([
                  ['dry', copy.dry], ['sticky', copy.sticky], ['creamy', copy.creamy], ['watery', copy.watery], ['egg_white', copy.eggWhite],
                ] as const).map(([value, label]) => <Choice key={value} label={label} selected={cervicalMucus === value} onPress={() => setCervicalMucus(value)} />)}
              </View>

              <Text style={[styles.fieldLabel, styles.fieldGap, { color: colors.onBackground }]}>{copy.lh}</Text>
              <View style={styles.yesNo}>
                <Choice label={copy.none} selected={lhTest === null} onPress={() => setLhTest(null)} />
                <Choice label={copy.negative} selected={lhTest === 'negative'} onPress={() => setLhTest('negative')} />
                <Choice label={copy.positive} selected={lhTest === 'peak'} onPress={() => setLhTest('peak')} />
              </View>
            </SurfaceCard>
          ) : null}

          <View style={[styles.metricRow, compactWidth && styles.metricColumn]}>
            <CounterCard icon="water_drop" title={copy.water} value={`${water} ${copy.glasses}`} onMinus={() => setWater(Math.max(0, water - 1))} onPlus={() => setWater(Math.min(12, water + 1))} />
            <CounterCard icon="bedtime" title={copy.sleep} value={`${sleep.toFixed(1)} ${copy.hours}`} onMinus={() => setSleep(Math.max(0, Math.round((sleep - 0.5) * 2) / 2))} onPlus={() => setSleep(Math.min(16, Math.round((sleep + 0.5) * 2) / 2))} />
          </View>

          <SectionHeader title={copy.notes} />
          <SurfaceCard padding={16}>
            <TextInput value={notes} onChangeText={setNotes} placeholder={copy.placeholder} placeholderTextColor={colors.outline} multiline style={[styles.notes, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FCF8FA' }]} />
          </SurfaceCard>
        </ScreenScroll>

        <View style={[styles.stickyFooter, { backgroundColor: isDark ? 'rgba(23,19,29,0.98)' : 'rgba(255,253,254,0.98)', borderTopColor: colors.outlineVariant }]}>
          <PrimaryButton label={copy.save} icon="check" onPress={save} loading={saving} />
        </View>
      </View>
    </ModalScreen>
  );
}

function cardState(selected: boolean, isDark: boolean) {
  return {
    backgroundColor: selected ? (isDark ? 'rgba(217,133,165,0.18)' : '#F8E7ED') : (isDark ? 'rgba(255,255,255,0.04)' : '#FFFDFE'),
    borderColor: selected ? LousaPalette.rose : (isDark ? LousaPalette.lineDark : LousaPalette.line),
  };
}

function Choice({ label, selected, onPress, compact = false }: { label: string; selected: boolean; onPress: () => void; compact?: boolean }) {
  const { colors, isDark } = useTheme();
  return <PressScale onPress={onPress} style={[styles.choice, compact && styles.choiceCompact, cardState(selected, isDark)]}><Text style={[styles.choiceText, { color: selected ? LousaPalette.berry : colors.onSurfaceVariant }]}>{label}</Text></PressScale>;
}

function Counter({ value, onMinus, onPlus }: { value: number; onMinus: () => void; onPlus: () => void }) {
  const { colors } = useTheme();
  return <View style={styles.counterInline}><PressScale onPress={onMinus} style={[styles.roundButton, { borderColor: colors.outlineVariant }]}><MaterialSymbol name="remove" size={20} color={colors.onBackground} /></PressScale><Text style={[styles.counterNumber, { color: colors.onBackground }]}>{value}</Text><PressScale onPress={onPlus} style={[styles.roundButton, styles.roundButtonActive]}><MaterialSymbol name="add" size={20} color="#fff" /></PressScale></View>;
}

function CounterCard({ icon, title, value, onMinus, onPlus }: { icon: string; title: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const { colors } = useTheme();
  return <SurfaceCard padding={16} style={styles.counterCard}><View style={styles.counterHead}><IconBubble icon={icon} tone="rose" size={38} /><Text style={[styles.counterTitle, { color: colors.onBackground }]}>{title}</Text></View><Text style={[styles.counterValue, { color: colors.onBackground }]}>{value}</Text><Counter value={Number.parseFloat(value) || 0} onMinus={onMinus} onPlus={onPlus} /></SurfaceCard>;
}

const styles = StyleSheet.create({
  screenBody: { flex: 1 }, content: { paddingTop: 8, paddingBottom: 32 }, subtitle: { fontFamily: 'sans-serif', fontSize: 13.5, lineHeight: 20, marginBottom: 20 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, twoColumns: {}, moodCard: { width: '31%', minHeight: 96, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 }, moodCardCompact: { width: '48%' }, moodText: { fontFamily: 'sans-serif-medium', fontSize: 12, textAlign: 'center', lineHeight: 16 },
  energyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, energyCircle: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, energyCircleSelected: { backgroundColor: LousaPalette.berry }, energyNumber: { fontFamily: 'sans-serif-medium', fontSize: 16 }, scaleLabel: { textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 12.5, marginTop: 12 },
  symptomWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, symptomChip: { minHeight: 48, maxWidth: '100%', borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8 }, symptomText: { fontFamily: 'sans-serif-medium', fontSize: 12.5, flexShrink: 1 },
  fieldLabel: { fontFamily: 'sans-serif-medium', fontSize: 14 }, fieldGap: { marginTop: 22 }, optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, choice: { minHeight: 48, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 8 }, choiceCompact: { minWidth: 44, paddingHorizontal: 10 }, choiceText: { fontFamily: 'sans-serif-medium', fontSize: 12 }, numberRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 10 }, yesNo: { flexDirection: 'row', gap: 10, marginTop: 10 },
  counterInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 12 }, roundButton: { width: 48, height: 48, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, roundButtonActive: { backgroundColor: LousaPalette.berry, borderColor: LousaPalette.berry }, counterNumber: { minWidth: 28, textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 20 },
  fertilityInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  fertilityInfoText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17 },
  temperatureInput: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, marginTop: 10, fontFamily: 'sans-serif-medium', fontSize: 15 },
  metricRow: { flexDirection: 'row', gap: 12, marginTop: 26 }, metricColumn: { flexDirection: 'column' }, counterCard: { flex: 1 }, counterHead: { flexDirection: 'row', alignItems: 'center', gap: 10 }, counterTitle: { fontFamily: 'sans-serif-medium', fontSize: 14 }, counterValue: { fontFamily: 'sans-serif-medium', fontSize: 22, marginTop: 12 },
  notes: { minHeight: 120, borderRadius: 18, borderWidth: 1, padding: 14, fontFamily: 'sans-serif', fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  stickyFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 },
});
