import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ModalScreen, ScreenScroll } from '../../src/components/layout';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { PressScale, PrimaryButton, SurfaceCard } from '../../src/components/ui';
import { useCycleStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { formatHumanDate } from '../../src/utils/date';

const COPY = {
  ru: {
    title: 'Проверка перенесённых дат',
    intro: 'Подтверди, исправь или удали каждую перенесённую запись. После проверки LOUSA сможет использовать её для прогноза.',
    confirm: 'Подтвердить', edit: 'Исправить', remove: 'Удалить', done: 'Готово', empty: 'Все даты проверены. LOUSA использует их для прогноза.',
    removeTitle: 'Удалить эту дату?', removeBody: 'Её можно будет восстановить сразу после удаления.', cancel: 'Отмена', source: 'Перенесено из старой версии',
  },
  en: {
    title: 'Review imported dates', intro: 'Confirm, edit, or remove each imported record. After review, LOUSA can use it for the forecast.',
    confirm: 'Confirm', edit: 'Edit', remove: 'Delete', done: 'Done', empty: 'All dates are reviewed. LOUSA will use them for the forecast.',
    removeTitle: 'Delete this date?', removeBody: 'You can restore it immediately after deletion.', cancel: 'Cancel', source: 'Imported from an older version',
  },
  hy: {
    title: 'Ստուգել տեղափոխված ամսաթվերը', intro: 'Հաստատիր, փոխիր կամ ջնջիր յուրաքանչյուր տեղափոխված գրառում։ Ստուգումից հետո LOUSA-ն կօգտագործի այն կանխատեսման համար։',
    confirm: 'Հաստատել', edit: 'Փոխել', remove: 'Ջնջել', done: 'Պատրաստ է', empty: 'Բոլոր ամսաթվերը ստուգված են։ LOUSA-ն կօգտագործի դրանք կանխատեսման համար։',
    removeTitle: 'Ջնջե՞լ այս ամսաթիվը', removeBody: 'Ջնջելուց հետո այն հնարավոր կլինի անմիջապես վերականգնել։', cancel: 'Չեղարկել', source: 'Տեղափոխված է հին տարբերակից',
  },
} as const;

export default function PeriodReviewScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((state) => state.language);
  const copy = COPY[language];
  const store = useCycleStore();
  const pending = useMemo(
    () => store.periodRecords.filter((record) => record.needsReview || (record.source === 'legacy' && !record.confirmed)),
    [store.periodRecords]
  );

  const remove = (id: string) => {
    Alert.alert(copy.removeTitle, copy.removeBody, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.remove, style: 'destructive', onPress: () => store.softDeletePeriodRecord(id) },
    ]);
  };

  return (
    <ModalScreen title={copy.title} closeIcon="arrow_back">
      <ScreenScroll contentContainerStyle={styles.content}>
        {pending.length > 0 ? (
          <SurfaceCard padding={18} tone="accent">
            <View style={styles.infoRow}>
              <MaterialSymbol name="shield" size={22} color={LousaPalette.berry} />
              <Text style={[styles.intro, { color: colors.onSurfaceVariant }]}>{copy.intro}</Text>
            </View>
          </SurfaceCard>
        ) : null}

        {pending.length ? pending.map((record) => (
          <SurfaceCard key={record.id} padding={18}>
            <View style={styles.recordTop}>
              <View style={styles.recordText}>
                <Text style={[styles.date, { color: colors.onBackground }]}>{formatHumanDate(record.startDate, language)}</Text>
                <Text style={[styles.source, { color: colors.onSurfaceVariant }]}>{copy.source}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(184,135,71,0.18)' : LousaPalette.warningSoft }]}>
                <MaterialSymbol name="priority_high" size={16} color={LousaPalette.warning} />
              </View>
            </View>
            <View style={styles.actions}>
              <PressScale onPress={() => store.confirmPeriodRecord(record.id)} style={[styles.actionButton, styles.primaryButton]}>
                <Text style={styles.primaryText}>{copy.confirm}</Text>
              </PressScale>
              <PressScale onPress={() => router.push({ pathname: '/screens/period-editor', params: { id: record.id } })} style={[styles.actionButton, { borderColor: colors.outlineVariant }]}>
                <Text style={[styles.secondaryText, { color: colors.onBackground }]}>{copy.edit}</Text>
              </PressScale>
              <PressScale onPress={() => remove(record.id)} style={styles.iconButton}>
                <MaterialSymbol name="delete" size={20} color={LousaPalette.danger} />
              </PressScale>
            </View>
          </SurfaceCard>
        )) : (
          <SurfaceCard padding={24}>
            <View style={styles.empty}>
              <MaterialSymbol name="check_circle" size={36} color={LousaPalette.success} />
              <Text style={[styles.emptyText, { color: colors.onBackground }]}>{copy.empty}</Text>
            </View>
          </SurfaceCard>
        )}

        <PrimaryButton label={copy.done} icon="check" onPress={() => { store.completeMigrationReview(); router.back(); }} />
      </ScreenScroll>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 18 },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  intro: { flex: 1, fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21 },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordText: { flex: 1 },
  date: { fontFamily: 'sans-serif-medium', fontSize: 18 },
  source: { fontFamily: 'sans-serif', fontSize: 12, marginTop: 3 },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' },
  actionButton: { minHeight: 48, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  primaryButton: { backgroundColor: LousaPalette.berry, borderColor: LousaPalette.berry },
  primaryText: { color: '#FFFFFF', fontFamily: 'sans-serif-medium', fontSize: 13 },
  secondaryText: { fontFamily: 'sans-serif-medium', fontSize: 13 },
  iconButton: { width: 48, height: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10 },
  emptyText: { fontFamily: 'sans-serif-medium', fontSize: 16, textAlign: 'center' },
});
