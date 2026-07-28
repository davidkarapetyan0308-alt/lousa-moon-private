import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AmbientBackground } from '../../src/components/AmbientBackground';
import { DateCalendarPicker } from '../../src/components/DateCalendarPicker';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ChoiceChip, PressScale, PrimaryButton, SecondaryButton, SurfaceCard, TextButton } from '../../src/components/ui';
import { useResponsiveLayout } from '../../src/components/layout';
import { useBoxStore, useCycleStore, useNotificationStore, useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaLayout, LousaPalette, LousaTypography } from '../../src/theme/designSystem';
import { encryptedJsonStore } from '../../src/security/encryptedStateStorage';
import { saveAddressDraft } from '../../src/services/addressDraft';
import { requestNotificationPermission, syncLousaNotifications } from '../../src/services/notifications';
import { getServiceMode } from '../../src/services';
import { flushCycleSettingsSync } from '../../src/services/cycleSettingsSync';
import { flushCycleSyncQueue } from '../../src/services/cycleSync';
import { trackProductEvent } from '../../src/services/productAnalytics';
import { toLocalDateString } from '../../src/utils/date';

const DRAFT_KEY = 'lousa-onboarding-draft-v9';
const TOTAL_STEPS = 5;
const QUESTIONNAIRE_SCHEMA_VERSION = 3;
const QUESTIONNAIRE_SCHEMA_ID = 'cycle-profile-v3';

type Step = 1 | 2 | 3 | 4 | 5;
type ReminderChoice = 'yes' | 'no' | null;

type Draft = {
  step: Step;
  selectedDate: string | null;
  cycleLength: number;
  periodLength: number;
  reminders: ReminderChoice;
  address: {
    city: string;
    street: string;
    house: string;
    apartment: string;
  };
  addressSkipped: boolean;
};

const makeDraft = (): Draft => ({
  step: 1,
  selectedDate: null,
  cycleLength: 28,
  periodLength: 5,
  reminders: null,
  address: { city: '', street: '', house: '', apartment: '' },
  addressSkipped: false,
});

const COPY = {
  ru: {
    step: 'Шаг', of: 'из', back: 'Назад', next: 'Продолжить', skip: 'Пропустить', finish: 'Сохранить настройки',
    titles: [
      'Когда начался последний цикл?',
      'Как обычно долго длится цикл?',
      'Сколько дней обычно длится менструация?',
      'Нужны напоминания?',
      'Где доставлять LOUSA BOX?',
    ],
    bodies: [
      'Выберите первый день последней менструации.',
      'Укажите обычную длительность. Это можно изменить позже.',
      'Выберите примерную продолжительность.',
      'LOUSA может напоминать о прогнозе и статусе доставки.',
      'Добавьте адрес сейчас или завершите его позже в профиле.',
    ],
    days: 'дней', yes: 'Да, нужны', no: 'Нет, не сейчас',
    city: 'Город', street: 'Улица', house: 'Дом', apartment: 'Квартира', optional: 'необязательно',
    reviewTitle: 'Проверить настройки?',
    reviewBody: (cycle: number, period: number, reminders: ReminderChoice, address: string) =>
      `Цикл: ${cycle} дней\nМенструация: ${period} дней\nНапоминания: ${reminders === 'yes' ? 'включить' : 'не включать'}\nАдрес: ${address || 'добавить позже'}`,
    cancel: 'Изменить', confirm: 'Всё верно',
    dateRequired: 'Выберите дату начала последнего цикла.',
    addressHint: 'Для доставки обязательны город, улица и дом. Квартиру можно добавить позже.',
    saved: 'Настройки сохранены',
    saveError: 'Не удалось сохранить настройки. Данные не потеряны — попробуйте ещё раз.',
    addressMissing: (field: string) => `Не заполнено поле «${field}». Заполните его или нажмите «Пропустить».`,
  },
  en: {
    step: 'Step', of: 'of', back: 'Back', next: 'Continue', skip: 'Skip', finish: 'Save setup',
    titles: [
      'When did your last period start?',
      'How long is your usual cycle?',
      'How many days does your period last?',
      'Would you like reminders?',
      'Where should LOUSA BOX be delivered?',
    ],
    bodies: [
      'Choose day one of your latest period.',
      'Choose your usual length. You can change it later.',
      'Choose an approximate duration.',
      'LOUSA can remind you about forecasts and delivery status.',
      'Add an address now or complete it later from Profile.',
    ],
    days: 'days', yes: 'Yes, remind me', no: 'Not now',
    city: 'City', street: 'Street', house: 'House', apartment: 'Apartment', optional: 'optional',
    reviewTitle: 'Review your setup?',
    reviewBody: (cycle: number, period: number, reminders: ReminderChoice, address: string) =>
      `Cycle: ${cycle} days\nPeriod: ${period} days\nReminders: ${reminders === 'yes' ? 'on' : 'off'}\nAddress: ${address || 'add later'}`,
    cancel: 'Edit', confirm: 'Looks right',
    dateRequired: 'Choose the start date of your last period.',
    addressHint: 'City, street and house are required for delivery. Apartment can be added later.',
    saved: 'Setup saved',
    saveError: 'Could not save your setup. Your entries are still here — try again.',
    addressMissing: (field: string) => `The “${field}” field is missing. Fill it in or choose Skip.`,
  },
  hy: {
    step: 'Քայլ', of: 'ից', back: 'Հետ', next: 'Շարունակել', skip: 'Բաց թողնել', finish: 'Պահպանել կարգավորումները',
    titles: [
      'Ե՞րբ է սկսվել վերջին ցիկլը',
      'Սովորաբար քանի՞ օր է տևում ցիկլը',
      'Քանի՞ օր է տևում դաշտանը',
      'Հիշեցումներ պե՞տք են',
      'Որտե՞ղ առաքել LOUSA BOX-ը',
    ],
    bodies: [
      'Ընտրեք վերջին դաշտանի առաջին օրը։',
      'Նշեք սովորական տևողությունը։ Այն կարելի է փոխել հետո։',
      'Ընտրեք մոտավոր տևողությունը։',
      'LOUSA-ն կարող է հիշեցնել կանխատեսման և առաքման կարգավիճակի մասին։',
      'Ավելացրեք հասցեն հիմա կամ ավարտեք այն հետո պրոֆիլում։',
    ],
    days: 'օր', yes: 'Այո, պետք են', no: 'Ոչ, հիմա ոչ',
    city: 'Քաղաք', street: 'Փողոց', house: 'Տուն', apartment: 'Բնակարան', optional: 'ոչ պարտադիր',
    reviewTitle: 'Ստուգե՞լ կարգավորումները',
    reviewBody: (cycle: number, period: number, reminders: ReminderChoice, address: string) =>
      `Ցիկլ՝ ${cycle} օր\nԴաշտան՝ ${period} օր\nՀիշեցումներ՝ ${reminders === 'yes' ? 'միացնել' : 'չմիացնել'}\nՀասցե՝ ${address || 'ավելացնել հետո'}`,
    cancel: 'Փոխել', confirm: 'Ճիշտ է',
    dateRequired: 'Ընտրեք վերջին ցիկլի սկիզբը։',
    addressHint: 'Առաքման համար անհրաժեշտ են քաղաքը, փողոցը և տունը։ Բնակարանը կարելի է ավելացնել հետո։',
    saved: 'Կարգավորումները պահպանվեցին',
    saveError: 'Չհաջողվեց պահպանել կարգավորումները։ Տվյալները չեն կորել․ փորձեք կրկին։',
    addressMissing: (field: string) => `«${field}» դաշտը լրացված չէ։ Լրացրեք կամ ընտրեք «Բաց թողնել»։`,
  },
} as const;

const CYCLE_LENGTHS = [21, 24, 26, 28, 30, 32, 35, 40];
const PERIOD_LENGTHS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const { horizontalPadding, compactWidth } = useResponsiveLayout();
  const language = useUserStore((state) => state.language);
  const isGuestMode = useUserStore((state) => state.isGuestMode);
  const copy = COPY[language] || COPY.ru;
  const [draft, setDraft] = useState<Draft>(makeDraft);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    encryptedJsonStore.get<Partial<Draft>>(DRAFT_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        setDraft((current) => ({
          ...current,
          ...stored,
          step: Math.max(1, Math.min(TOTAL_STEPS, Number(stored.step) || 1)) as Step,
          address: { ...current.address, ...(stored.address || {}) },
        }));
      })
      .finally(() => active && setLoaded(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    encryptedJsonStore.set(DRAFT_KEY, draft).catch(() => {});
  }, [draft, loaded]);

  const addressLine = useMemo(() => [draft.address.city, draft.address.street, draft.address.house, draft.address.apartment]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', '), [draft.address]);

  const missingAddressField = useMemo(() => {
    if (!draft.address.city.trim()) return copy.city;
    if (!draft.address.street.trim()) return copy.street;
    if (!draft.address.house.trim()) return copy.house;
    return '';
  }, [copy.city, copy.house, copy.street, draft.address.city, draft.address.house, draft.address.street]);

  const canContinue = draft.step === 1
    ? Boolean(draft.selectedDate)
    : draft.step === 4
      ? draft.reminders !== null
      : true;

  const back = () => {
    setError('');
    if (draft.step === 1) router.back();
    else setDraft((state) => ({ ...state, step: (state.step - 1) as Step }));
  };

  const next = () => {
    setError('');
    if (!canContinue) {
      if (draft.step === 1) setError(copy.dateRequired);
      return;
    }
    setDraft((state) => ({ ...state, step: Math.min(TOTAL_STEPS, state.step + 1) as Step }));
  };

  const skip = () => {
    if (draft.step === 4) setDraft((state) => ({ ...state, reminders: 'no', step: 5 }));
    if (draft.step === 5) confirmFinish(true);
  };

  const completeSetup = async (skipAddress = false) => {
    setSaving(true);
    setError('');
    try {
      const now = new Date().toISOString();
      const cycle = useCycleStore.getState();
      cycle.setCycleLength(draft.cycleLength);
      cycle.setPeriodLength(draft.periodLength);
      if (!draft.selectedDate) throw new Error(copy.dateRequired);
      const records = [draft.selectedDate];
      cycle.setLastPeriod(draft.selectedDate);
      cycle.setOnboardingProfile({
        goals: draft.reminders === 'yes' ? ['track', 'reminders', 'box'] : ['track', 'box'],
        cycleContext: cycle.onboardingProfile.cycleContext || 'prefer_not_to_say',
        factors: cycle.onboardingProfile.factors?.length ? cycle.onboardingProfile.factors : ['prefer_not_to_say'],
        regularity: 'unknown',
        shortestCycle: draft.cycleLength,
        longestCycle: draft.cycleLength,
        periodLengthKnown: true,
        completedAt: now,
        consentVersion: 'local-sensitive-data-v4',
        sensitiveDataConsentAt: now,
        onboardingStep: TOTAL_STEPS,
        onboardingCompleted: true,
        questionnaireStatus: records.length ? 'completed' : 'skipped_cycle_date',
        questionnaireSchemaVersion: `${QUESTIONNAIRE_SCHEMA_ID}-v${QUESTIONNAIRE_SCHEMA_VERSION}`,
      });

      if (!skipAddress && addressLine) {
        await saveAddressDraft({
          city: draft.address.city.trim(),
          street: draft.address.street.trim(),
          house: draft.address.house.trim(),
          apartment: draft.address.apartment.trim(),
          formattedAddress: addressLine,
          source: 'onboarding',
        });
        useBoxStore.getState().setAddress(addressLine);
      }

      const notifications = useNotificationStore.getState();
      if (draft.reminders === 'yes') {
        const permission = await requestNotificationPermission().catch(() => 'denied' as const);
        notifications.setEnabled(permission === 'granted');
        if (permission === 'granted') await syncLousaNotifications().catch(() => {});
      } else {
        notifications.setEnabled(false);
      }

      if (!isGuestMode && getServiceMode() === 'api') {
        await Promise.allSettled([flushCycleSettingsSync(), flushCycleSyncQueue()]);
      }

      useUserStore.getState().setOnboarded(true);
      await encryptedJsonStore.remove(DRAFT_KEY).catch(() => {});
      await trackProductEvent('onboarding_completed', {
        language,
        source: 'guided_setup_v1',
        cycle_length: draft.cycleLength,
        period_length: draft.periodLength,
        reminders: draft.reminders,
        address_added: Boolean(!skipAddress && addressLine),
      }).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/(tabs)');
    } catch {
      setError(copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const confirmFinish = (skipAddress = false) => {
    if (!skipAddress && missingAddressField) {
      setError(copy.addressMissing(missingAddressField));
      return;
    }
    const resolvedAddress = skipAddress ? '' : addressLine;
    Alert.alert(
      copy.reviewTitle,
      copy.reviewBody(draft.cycleLength, draft.periodLength, draft.reminders, resolvedAddress),
      [
        { text: copy.cancel, style: 'cancel' },
        { text: copy.confirm, onPress: () => { void completeSetup(skipAddress); } },
      ],
    );
  };

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} accessibilityLabel="LOUSA" />;
  }

  const title = copy.titles[draft.step - 1];
  const body = copy.bodies[draft.step - 1];

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <AmbientBackground variant={isDark ? 'cosmic' : 'minimal'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
          <PressScale accessibilityLabel={copy.back} onPress={back} style={[styles.headerButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFDFE' }]}>
            <MaterialSymbol name="arrow_back" size={21} color={colors.onBackground} />
          </PressScale>
          <Text style={[styles.stepText, { color: colors.onSurfaceVariant }]}>{copy.step} {draft.step} {copy.of} {TOTAL_STEPS}</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={[styles.progressTrack, { marginHorizontal: horizontalPadding, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEE5EA' }]}>
          <View style={[styles.progressFill, { width: `${draft.step / TOTAL_STEPS * 100}%` }]} />
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        >
          <Text style={[styles.title, compactWidth && styles.titleCompact, { color: colors.onBackground }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{body}</Text>

          {draft.step === 1 ? (
            <SurfaceCard padding={compactWidth ? 12 : 16}>
              <DateCalendarPicker
                value={draft.selectedDate}
                onChange={(selectedDate) => setDraft((state) => ({ ...state, selectedDate }))}
                language={language}
                maximumDate={toLocalDateString()}
              />
            </SurfaceCard>
          ) : null}

          {draft.step === 2 ? (
            <View style={styles.choices}>
              {CYCLE_LENGTHS.map((days) => (
                <ChoiceChip key={days} label={`${days} ${copy.days}`} selected={draft.cycleLength === days} onPress={() => setDraft((state) => ({ ...state, cycleLength: days }))} />
              ))}
            </View>
          ) : null}

          {draft.step === 3 ? (
            <View style={styles.choices}>
              {PERIOD_LENGTHS.map((days) => (
                <ChoiceChip key={days} label={`${days} ${copy.days}`} selected={draft.periodLength === days} onPress={() => setDraft((state) => ({ ...state, periodLength: days }))} />
              ))}
            </View>
          ) : null}

          {draft.step === 4 ? (
            <View style={styles.stack}>
              <SecondaryButton label={copy.yes} icon="notifications_active" onPress={() => setDraft((state) => ({ ...state, reminders: 'yes' }))} style={draft.reminders === 'yes' ? styles.selectedButton : undefined} />
              <SecondaryButton label={copy.no} icon="notifications_off" onPress={() => setDraft((state) => ({ ...state, reminders: 'no' }))} style={draft.reminders === 'no' ? styles.selectedButton : undefined} />
            </View>
          ) : null}

          {draft.step === 5 ? (
            <SurfaceCard padding={16}>
              <View style={styles.fieldGrid}>
                <TextInput
                  value={draft.address.city}
                  onChangeText={(city) => setDraft((state) => ({ ...state, address: { ...state.address, city }, addressSkipped: false }))}
                  placeholder={copy.city}
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={[styles.input, { color: colors.onBackground, borderColor: colors.outlineVariant }]}
                  accessibilityLabel={copy.city}
                />
                <TextInput
                  value={draft.address.street}
                  onChangeText={(street) => setDraft((state) => ({ ...state, address: { ...state.address, street }, addressSkipped: false }))}
                  placeholder={copy.street}
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={[styles.input, { color: colors.onBackground, borderColor: colors.outlineVariant }]}
                  accessibilityLabel={copy.street}
                />
                <View style={styles.addressRow}>
                  <TextInput
                    value={draft.address.house}
                    onChangeText={(house) => setDraft((state) => ({ ...state, address: { ...state.address, house }, addressSkipped: false }))}
                    placeholder={copy.house}
                    placeholderTextColor={colors.onSurfaceVariant}
                    style={[styles.input, styles.flexInput, { color: colors.onBackground, borderColor: colors.outlineVariant }]}
                    accessibilityLabel={copy.house}
                  />
                  <TextInput
                    value={draft.address.apartment}
                    onChangeText={(apartment) => setDraft((state) => ({ ...state, address: { ...state.address, apartment }, addressSkipped: false }))}
                    placeholder={`${copy.apartment} · ${copy.optional}`}
                    placeholderTextColor={colors.onSurfaceVariant}
                    style={[styles.input, styles.flexInput, { color: colors.onBackground, borderColor: colors.outlineVariant }]}
                    accessibilityLabel={copy.apartment}
                  />
                </View>
                <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>{copy.addressHint}</Text>
              </View>
            </SurfaceCard>
          ) : null}

          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingHorizontal: horizontalPadding, borderTopColor: colors.outlineVariant, backgroundColor: isDark ? 'rgba(23,19,29,0.98)' : 'rgba(255,253,254,0.98)' }]}>
          {draft.step === 4 || draft.step === 5 ? <TextButton label={copy.skip} onPress={skip} fullWidth /> : null}
          <PrimaryButton
            label={draft.step === TOTAL_STEPS ? copy.finish : copy.next}
            icon={draft.step === TOTAL_STEPS ? 'check' : 'arrow_forward'}
            onPress={() => draft.step === TOTAL_STEPS ? confirmFinish(false) : next()}
            disabled={!canContinue}
            loading={saving}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  safe: { flex: 1 },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerPlaceholder: { width: LousaLayout.touchTarget },
  stepText: { ...LousaTypography.caption },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: LousaPalette.berry },
  scrollView: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: 28, paddingBottom: 28 },
  title: { ...LousaTypography.display, maxWidth: 520 },
  titleCompact: { fontSize: 27, lineHeight: 33 },
  subtitle: { ...LousaTypography.body, marginTop: 10, marginBottom: 26, maxWidth: 520 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stack: { gap: 12 },
  selectedButton: { borderColor: LousaPalette.berry, backgroundColor: '#F8E7ED' },
  fieldGrid: { gap: 12 },
  addressRow: { flexDirection: 'row', gap: 10 },
  flexInput: { flex: 1, minWidth: 0 },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, fontFamily: 'sans-serif', fontSize: 15 },
  hint: { ...LousaTypography.caption, marginTop: 2 },
  error: { color: LousaPalette.danger, fontFamily: 'sans-serif-medium', fontSize: 13, lineHeight: 18, marginTop: 18 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingBottom: 12, gap: 6 },
});
