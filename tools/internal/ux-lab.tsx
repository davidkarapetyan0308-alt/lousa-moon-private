import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ModalScreen, PageIntro, ScreenScroll } from '../../src/components/layout';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { PressScale, SurfaceCard } from '../../src/components/ui';
import { applyUxTestPersona, UX_TEST_PERSONAS } from '../../src/services/uxTesting';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';

export default function UxLabScreen() {
  const { colors } = useTheme();

  return (
    <ModalScreen title="UX Lab" closeIcon="arrow_back">
      <ScreenScroll>
        <PageIntro
          title="Сценарии UX-тестирования"
          subtitle="Внутренний инструмент: заменяет локальные демо-данные выбранным сценарием. Реальные серверные данные он не изменяет."
        />
        <View style={styles.list}>
          {UX_TEST_PERSONAS.map((persona) => (
            <PressScale
              key={persona.id}
              onPress={() => {
                applyUxTestPersona(persona.id);
                router.replace('/(tabs)');
              }}
            >
              <SurfaceCard padding={17} style={styles.card}>
                <View style={styles.icon}>
                  <MaterialSymbol name="person_search" size={20} color={LousaPalette.berry} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.title, { color: colors.onBackground }]}>{persona.title}</Text>
                  <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{persona.description}</Text>
                </View>
                <MaterialSymbol name="arrow_forward" size={19} color={colors.outline} />
              </SurfaceCard>
            </PressScale>
          ))}
        </View>
      </ScreenScroll>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8E7ED', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontFamily: 'sans-serif-medium', fontSize: 14, lineHeight: 19 },
  body: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 17, marginTop: 3 },
});
