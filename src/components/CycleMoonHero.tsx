import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { RealisticMoon } from './RealisticMoon';
import { MoonPhaseName } from '../utils/moonPhase';
import { useTheme } from '../theme/ThemeProvider';
import { LousaPalette } from '../theme/designSystem';
import { StatusPill } from './ui';

interface Props {
  cycleDay: number;
  cycleLength: number;
  cyclePhaseLabel: string;
  moonPhase: MoonPhaseName;
  moonLabel: string;
  moonIllumination: number;
  daysUntilPeriod: number;
  compact?: boolean;
  language?: 'ru' | 'en' | 'hy';
}

export function CycleMoonHero({
  cycleDay,
  cycleLength,
  cyclePhaseLabel,
  moonPhase,
  moonLabel,
  moonIllumination,
  daysUntilPeriod,
  compact = false,
  language = 'ru',
}: Props) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const maxSize = compact ? 226 : 270;
  const size = Math.max(202, Math.min(maxSize, width - 112));
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, cycleDay / Math.max(1, cycleLength)));
  const dashOffset = circumference * (1 - progress);
  const moonSize = Math.round(size * 0.56);
  const copy = {
    ru: { day: 'день', today: 'Ожидается сегодня', until: (days: number) => `До менструации около ${days} дн.` },
    en: { day: 'day', today: 'Expected today', until: (days: number) => `Period expected in about ${days} days` },
    hy: { day: 'օր', today: 'Սպասվում է այսօր', until: (days: number) => `Դաշտանը՝ մոտ ${days} օրից` },
  }[language];

  return (
    <View style={[styles.root, { width: size, minHeight: size + 62 }]}>
      <View style={[styles.ringWrap, { width: size, height: size }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="cycleGradient" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={isDark ? '#D7C4F0' : LousaPalette.lavender} />
              <Stop offset="0.55" stopColor={isDark ? '#F1B7CD' : LousaPalette.rose} />
              <Stop offset="1" stopColor={isDark ? '#B86B91' : LousaPalette.berry} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(91,54,95,0.09)'} strokeWidth={stroke} />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="url(#cycleGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>

        <View style={styles.moonWrap}>
          <RealisticMoon size={moonSize} illumination={moonIllumination} phase={moonPhase} glowColor={isDark ? 'rgba(184,166,217,0.14)' : 'rgba(217,133,165,0.13)'} />
        </View>

        <View style={[styles.dayBadge, { backgroundColor: isDark ? '#282331' : '#FFFDFE', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(91,54,95,0.10)' }]}>
          <Text style={[styles.dayNumber, { color: colors.onBackground }]}>{cycleDay}</Text>
          <Text style={[styles.dayCaption, { color: colors.onSurfaceVariant }]}>{copy.day}</Text>
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={[styles.phaseTitle, { color: colors.onBackground }]}>{cyclePhaseLabel}</Text>
        <Text style={[styles.moonTitle, { color: colors.onSurfaceVariant }]}>{moonLabel} · {Math.round(moonIllumination * 100)}%</Text>
        <StatusPill tone={daysUntilPeriod <= 3 ? 'warning' : 'rose'} icon="event" label={daysUntilPeriod <= 0 ? copy.today : copy.until(daysUntilPeriod)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', alignItems: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  moonWrap: { alignItems: 'center', justifyContent: 'center' },
  dayBadge: {
    position: 'absolute',
    right: 1,
    bottom: 28,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C1A31',
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  dayNumber: { fontFamily: 'serif', fontSize: 21, lineHeight: 23 },
  dayCaption: { fontFamily: 'sans-serif-medium', fontSize: 12, marginTop: -1 },
  meta: { alignItems: 'center', marginTop: -1, gap: 4 },
  phaseTitle: { fontFamily: 'serif', fontSize: 21, lineHeight: 26, textAlign: 'center' },
  moonTitle: { fontFamily: 'sans-serif', fontSize: 12, marginBottom: 5, textAlign: 'center' },
});
