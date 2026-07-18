import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressScale } from './ui';
import { MaterialSymbol } from './MaterialSymbol';
import { useTheme } from '../theme/ThemeProvider';
import { LousaPalette } from '../theme/designSystem';
import { fromLocalDateString, toLocalDateString } from '../utils/date';

interface Props {
  value: string | null;
  onChange: (value: string) => void;
  language: 'ru' | 'en' | 'hy';
  maximumDate?: string;
  minimumDate?: string;
}

const WEEKDAYS = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  hy: ['Երկ', 'Երք', 'Չրք', 'Հնգ', 'Ուրբ', 'Շբթ', 'Կիր'],
};

export function DateCalendarPicker({ value, onChange, language, maximumDate, minimumDate }: Props) {
  const { colors, isDark } = useTheme();
  const initial = value ? fromLocalDateString(value) : new Date();
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1, 12));
  const locale = language === 'ru' ? 'ru-RU' : language === 'hy' ? 'hy-AM' : 'en-US';
  const max = maximumDate ? fromLocalDateString(maximumDate) : null;
  const min = minimumDate ? fromLocalDateString(minimumDate) : null;

  const calendar = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const slots = Array.from({ length: offset + days }, (_, slot) => {
      const day = slot - offset + 1;
      return day > 0 ? day : null;
    });
    while (slots.length % 7 !== 0) slots.push(null);
    return { year, month, slots };
  }, [cursor]);

  const move = (delta: number) => setCursor(new Date(calendar.year, calendar.month + delta, 1, 12));

  return (
    <View style={[styles.card, { borderColor: isDark ? LousaPalette.lineDark : LousaPalette.line, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFDFE' }]}> 
      <View style={styles.header}>
        <PressScale accessibilityLabel="Previous month" onPress={() => move(-1)} style={styles.arrow}>
          <MaterialSymbol name="chevron_left" size={22} color={colors.onBackground} />
        </PressScale>
        <Text style={[styles.month, { color: colors.onBackground }]} numberOfLines={1}>
          {cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </Text>
        <PressScale accessibilityLabel="Next month" onPress={() => move(1)} style={styles.arrow}>
          <MaterialSymbol name="chevron_right" size={22} color={colors.onBackground} />
        </PressScale>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS[language].map((day) => (
          <View key={day} style={styles.weekCell}>
            <Text style={[styles.weekday, { color: colors.onSurfaceVariant }]}>{day}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {calendar.slots.map((day, index) => {
          if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
          const date = new Date(calendar.year, calendar.month, day, 12);
          const dateString = toLocalDateString(date);
          const selected = value === dateString;
          const disabled = Boolean((max && date > max) || (min && date < min));
          return (
            <View key={dateString} style={styles.dayCell}>
              <PressScale
                disabled={disabled}
                accessibilityLabel={date.toLocaleDateString(locale)}
                onPress={() => onChange(dateString)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[styles.dayButton, selected && styles.selectedDayButton, disabled && styles.disabledDayButton]}
              >
                <Text style={[styles.day, { color: selected ? '#FFFFFF' : disabled ? colors.outline : colors.onBackground }]}>{day}</Text>
              </PressScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  arrow: { width: 48, height: 48, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  month: { flex: 1, textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 16, textTransform: 'capitalize' },
  weekRow: { flexDirection: 'row', marginBottom: 3 },
  weekCell: { width: `${100 / 7}%`, height: 30, alignItems: 'center', justifyContent: 'center' },
  weekday: { textAlign: 'center', fontFamily: 'sans-serif-medium', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  dayButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  selectedDayButton: { backgroundColor: LousaPalette.berry },
  disabledDayButton: { opacity: 0.38 },
  day: { fontFamily: 'sans-serif-medium', fontSize: 13, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
});
