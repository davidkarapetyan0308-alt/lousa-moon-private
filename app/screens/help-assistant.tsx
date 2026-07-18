import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { ModalScreen } from '../../src/components/layout';
import { IconBubble, PressScale, StatusPill, SurfaceCard } from '../../src/components/ui';
import { useCycleStore, useUserStore, useWellnessStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';
import { getCycleData } from '../../src/utils/cycleEngine';
import { fromLocalDateString, toLocalDateString } from '../../src/utils/date';

interface Message { id: string; text: string; user: boolean; time: Date }

const COPY = {
  ru: {
    appBar: 'Справочник LOUSA', context: 'Ответы выбраны из подготовленных материалов с учётом подтверждённых записей.', contextUnknown: 'Текущий день цикла не подтверждён, поэтому справочник не будет придумывать фазу.', disclaimer: 'Это подготовленный справочный материал, а не AI, диагноз или замена врачу.',
    hello: (name: string, day: number) => `Привет, ${name || 'друг'}. Сейчас ${day}-й день твоего цикла. О чём хочешь поговорить?`,
    helloUnknown: (name: string) => `Привет, ${name || 'друг'}. Текущий день цикла пока не подтверждён. Я могу помочь с записями и самочувствием без выдуманной фазы.`,
    prompts: ['Как я чувствую себя сегодня?', 'Что важно в моей фазе цикла?', 'Как подготовиться к менструации?', 'Покажи безопасный совет для сна'],
    placeholder: 'Напиши вопрос…', send: 'Отправить', based: (day: number) => `Основано на ${day}-м дне цикла`, basedUnknown: 'Фаза не подтверждена',
    stateNone: 'Сегодня дневник ещё не заполнен. Добавь настроение, энергию и симптомы, чтобы совет стал персональнее.',
    state: (energy: number, water: number, symptoms: number) => `Сегодня у тебя отмечено: энергия ${energy}/5, вода — ${water} стаканов, симптомов — ${symptoms}. Постарайся ориентироваться на самочувствие и оставить время на восстановление.`,
    phase: (day: number, phase: string, until: number) => `Сейчас ${day}-й день цикла, фаза — ${phase}. До предполагаемой менструации около ${until} дней. Прогноз приблизительный и не подходит для контрацепции.`,
    phaseUnknown: 'Последнее прогнозное окно прошло без новой подтверждённой записи. LOUSA не будет автоматически считать, что начался новый цикл. Уточни дату в календаре, когда будет удобно.',
    prepare: 'Подготовь необходимые средства заранее, проверь состав следующего LOUSA BOX, запланируй более спокойный график и обращай внимание на необычно сильную боль или кровотечение.',
    sleep: 'Для сна попробуй постоянное время отхода ко сну, меньше яркого света вечером и спокойный ритуал без экрана. При длительной бессоннице стоит обратиться к врачу.',
    fallback: 'Я могу помочь разобрать записи самочувствия, текущую фазу цикла, подготовку к менструации или мягкие привычки сна и восстановления.',
  },
  en: {
    appBar: 'LOUSA guide', context: 'Prepared answers use confirmed records and your logged wellbeing.', contextUnknown: 'The current cycle day is not confirmed, so the guide will not invent a phase.', disclaimer: 'This is prepared educational content, not AI, a diagnosis or a replacement for a clinician.',
    hello: (name: string, day: number) => `Hi, ${name || 'there'}. You are on cycle day ${day}. What would you like to explore?`,
    helloUnknown: (name: string) => `Hi, ${name || 'there'}. Your current cycle day is not confirmed. I can still help with your records and wellbeing without inventing a phase.`,
    prompts: ['How am I feeling today?', 'What matters in my cycle phase?', 'How can I prepare for my period?', 'Give me a safe sleep tip'],
    placeholder: 'Write a question…', send: 'Send', based: (day: number) => `Based on cycle day ${day}`, basedUnknown: 'Phase not confirmed',
    stateNone: 'You have not completed today’s check-in yet. Add mood, energy and symptoms to make guidance more personal.',
    state: (energy: number, water: number, symptoms: number) => `Today you logged ${energy}/5 energy, ${water} glasses of water and ${symptoms} symptoms. Follow how you feel and leave room for recovery.`,
    phase: (day: number, phase: string, until: number) => `You are on cycle day ${day}, in the ${phase} phase. Your next period is estimated in about ${until} days. This forecast is approximate and not suitable for contraception.`,
    phaseUnknown: 'The last forecast window passed without a new confirmed record. LOUSA will not assume that another cycle started. Update the calendar when you are ready.',
    prepare: 'Prepare your preferred period products, review the next LOUSA BOX, leave more flexibility in your schedule and seek medical care for unusually severe pain or bleeding.',
    sleep: 'For sleep, try a consistent bedtime, less bright light in the evening and a screen-free wind-down ritual. Persistent insomnia deserves medical advice.',
    fallback: 'I can help you review today’s check-in, understand your cycle phase, prepare for your period or build gentle sleep and recovery habits.',
  },
  hy: {
    appBar: 'LOUSA ՏԵՂԵԿԱՏՈՒ', context: 'Պատասխանները հաշվի են առնում հաստատված գրառումներն ու իրական ինքնազգացողությունը։', contextUnknown: 'Ցիկլի ընթացիկ օրը հաստատված չէ, ուստի տեղեկատուն փուլ չի հորինի։', disclaimer: 'Սա նախապես պատրաստված տեղեկություն է, ոչ թե AI, ախտորոշում կամ բժշկի փոխարինում։',
    hello: (name: string, day: number) => `Ողջույն, ${name || 'ընկեր'}։ Հիմա ցիկլի ${day}-րդ օրն է։ Ի՞նչ կուզես քննարկել։`,
    helloUnknown: (name: string) => `Ողջույն, ${name || 'ընկեր'}։ Ցիկլի ընթացիկ օրը դեռ հաստատված չէ։ Կարող եմ օգնել գրառումներով ու ինքնազգացողությամբ՝ առանց հորինված փուլի։`,
    prompts: ['Ինչպե՞ս եմ ինձ զգում այսօր', 'Ի՞նչն է կարևոր ցիկլիս փուլում', 'Ինչպե՞ս պատրաստվել դաշտանին', 'Տուր անվտանգ խորհուրդ քնի համար'],
    placeholder: 'Գրիր հարցը…', send: 'Ուղարկել', based: (day: number) => `Հիմնված է ցիկլի ${day}-րդ օրվա վրա`, basedUnknown: 'Փուլը հաստատված չէ',
    stateNone: 'Այսօրվա օրագիրը դեռ լրացված չէ։ Ավելացրու տրամադրությունը, էներգիան ու ախտանիշները՝ ավելի անհատական խորհրդի համար։',
    state: (energy: number, water: number, symptoms: number) => `Այսօր նշել ես էներգիա՝ ${energy}/5, ջուր՝ ${water} բաժակ և ${symptoms} ախտանիշ։ Կողմնորոշվիր ինքնազգացողությամբ և ժամանակ թող վերականգնման համար։`,
    phase: (day: number, phase: string, until: number) => `Հիմա ցիկլի ${day}-րդ օրն է, փուլը՝ ${phase}։ Հաջորդ դաշտանը սպասվում է մոտ ${until} օրից։ Կանխատեսումը մոտավոր է և նախատեսված չէ հակաբեղմնավորման համար։`,
    phaseUnknown: 'Վերջին կանխատեսվող շրջանն անցել է առանց նոր հաստատված գրառման։ LOUSA-ն չի ենթադրի, որ նոր ցիկլ է սկսվել։ Ճշտիր օրացույցը, երբ հարմար լինի։',
    prepare: 'Նախապես պատրաստիր անհրաժեշտ միջոցները, ստուգիր հաջորդ LOUSA BOX-ի պարունակությունը, ընտրիր ավելի հանգիստ գրաֆիկ և ուժեղ ցավի կամ անսովոր արյունահոսության դեպքում դիմիր բժշկի։',
    sleep: 'Քնի համար փորձիր նույն ժամին պառկել, երեկոյան նվազեցնել պայծառ լույսը և ունենալ առանց էկրանի հանգիստ արարողություն։ Երկարատև անքնության դեպքում դիմիր բժշկի։',
    fallback: 'Կարող եմ օգնել հասկանալ այսօրվա գրառումը, ցիկլի փուլը, պատրաստվել դաշտանին կամ ստեղծել մեղմ քնի ու վերականգնման սովորություններ։',
  },
} as const;

const PHASE_LABELS = {
  ru: { menstrual: 'менструальная', follicular: 'фолликулярная', ovulation: 'овуляция', luteal: 'лютеиновая' },
  en: { menstrual: 'menstrual', follicular: 'follicular', ovulation: 'ovulation', luteal: 'luteal' },
  hy: { menstrual: 'դաշտանային', follicular: 'ֆոլիկուլային', ovulation: 'օվուլյացիա', luteal: 'լյուտեինային' },
} as const;

export default function PreparedHelpScreen() {
  const { colors, isDark } = useTheme();
  const language = useUserStore((s) => s.language);
  const name = useUserStore((s) => s.name);
  const copy = COPY[language] || COPY.ru;
  const cycleStore = useCycleStore();
  const today = useWellnessStore((s) => s.getLog(toLocalDateString()));
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');

  const cycle = useMemo(() => getCycleData(cycleStore.lastPeriodStart ? fromLocalDateString(cycleStore.lastPeriodStart) : null, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, new Date(), cycleStore.periodHistory.length, cycleStore.periodRecords, { cycleContext: cycleStore.onboardingProfile.cycleContext, factors: cycleStore.onboardingProfile.factors }), [cycleStore.lastPeriodStart, cycleStore.avgCycleLength, cycleStore.avgPeriodLength, cycleStore.periodHistory.length, cycleStore.periodRecords, cycleStore.onboardingProfile.cycleContext, cycleStore.onboardingProfile.factors]);
  const welcomeText = cycle.isCyclePositionKnown ? copy.hello(name, cycle.currentDay) : copy.helloUnknown(name);
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', text: welcomeText, user: false, time: new Date() }]);

  useEffect(() => {
    const nextWelcome = cycle.isCyclePositionKnown ? copy.hello(name, cycle.currentDay) : copy.helloUnknown(name);
    setMessages((current) => current.length === 1 && current[0].id === 'welcome' ? [{ ...current[0], text: nextWelcome }] : current);
  }, [language, name, cycle.currentDay, cycle.isCyclePositionKnown, copy]);

  const responseFor = (text: string) => {
    const lower = text.toLowerCase();
    const hasState = Boolean(today.mood || today.symptoms.length || today.notes.trim());
    const promptIndex = copy.prompts.findIndex((item) => item === text);
    if (promptIndex === 0 || /чув|feel|զգ|настро|mood|տրամ/.test(lower)) return hasState ? copy.state(today.energy, today.water, today.symptoms.length) : copy.stateNone;
    if (promptIndex === 1 || /цикл|phase|cycle|փուլ|ցիկլ/.test(lower)) return cycle.isCyclePositionKnown ? copy.phase(cycle.currentDay, PHASE_LABELS[language][cycle.phase], cycle.daysUntilPeriod) : copy.phaseUnknown;
    if (promptIndex === 2 || /менстру|period|դաշտան|подготов|prepare|պատրաստ/.test(lower)) return copy.prepare;
    if (promptIndex === 3 || /сон|sleep|քուն/.test(lower)) return copy.sleep;
    return copy.fallback;
  };

  const send = (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text) return;
    setMessages((current) => [...current, { id: `${Date.now()}-u`, text, user: true, time: new Date() }]);
    setInput('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMessages((current) => [...current, { id: `${Date.now()}-a`, text: responseFor(text), user: false, time: new Date() }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <ModalScreen title={copy.appBar} closeIcon="arrow_back" backgroundVariant={isDark ? 'cosmic' : 'minimal'}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 62 : 0}
      >
        <View style={styles.contextBar}>
          <StatusPill label={cycle.isCyclePositionKnown ? copy.based(cycle.currentDay) : copy.basedUnknown} tone={cycle.isCyclePositionKnown ? "rose" : "neutral"} icon="cycle" />
          <Text style={[styles.contextText, { color: colors.onSurfaceVariant }]}>{cycle.isCyclePositionKnown ? copy.context : copy.contextUnknown}</Text>
        </View>

        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageRow, message.user && styles.messageRowUser]}>
              {!message.user ? <Image source={require('../../assets/images/profile/profile-placeholder.png')} style={styles.assistantAvatar} /> : null}
              <View style={[styles.bubble, message.user ? styles.userBubble : { backgroundColor: isDark ? '#23202B' : '#FFFDFE', borderColor: isDark ? 'rgba(255,255,255,0.10)' : LousaPalette.line }]}>
                <Text style={[styles.messageText, { color: message.user ? '#FFFFFF' : colors.onBackground }]}>{message.text}</Text>
                <Text style={[styles.time, { color: message.user ? 'rgba(255,255,255,0.65)' : colors.onSurfaceVariant }]}>{message.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>
          ))}

          {messages.length <= 2 ? (
            <View style={styles.quickSection}>
              {copy.prompts.map((prompt) => <PressScale key={prompt} onPress={() => send(prompt)} style={[styles.quickPrompt, { borderColor: colors.outlineVariant }]}><IconBubble icon="auto_awesome" tone="rose" size={32} /><Text style={[styles.quickText, { color: colors.onBackground }]}>{prompt}</Text><MaterialSymbol name="arrow_forward" size={17} color={LousaPalette.berry} /></PressScale>)}
            </View>
          ) : null}
          <View style={styles.disclaimer}><MaterialSymbol name="health_and_safety" size={16} color={colors.onSurfaceVariant} /><Text style={[styles.disclaimerText, { color: colors.onSurfaceVariant }]}>{copy.disclaimer}</Text></View>
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.background, borderTopColor: colors.outlineVariant }]}>
          <TextInput value={input} onChangeText={setInput} placeholder={copy.placeholder} placeholderTextColor={colors.outline} style={[styles.input, { color: colors.onBackground, backgroundColor: isDark ? '#23202B' : '#FFFDFE', borderColor: colors.outlineVariant }]} multiline maxLength={500} />
          <PressScale onPress={() => send()} disabled={!input.trim()} style={styles.sendButton} accessibilityLabel={copy.send}><MaterialSymbol name="arrow_upward" size={21} color="#fff" /></PressScale>
        </View>
      </KeyboardAvoidingView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contextBar: { paddingHorizontal: 18, paddingVertical: 12, gap: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(91,54,95,0.10)' },
  contextText: { fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16 },
  messages: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 20, maxWidth: 680, width: '100%', alignSelf: 'center' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  messageRowUser: { justifyContent: 'flex-end' },
  assistantAvatar: { width: 34, height: 34, borderRadius: 17 },
  bubble: { maxWidth: '82%', borderRadius: 22, borderWidth: 1, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 8 },
  userBubble: { backgroundColor: LousaPalette.berry, borderColor: LousaPalette.berry, borderBottomRightRadius: 7 },
  messageText: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21 },
  time: { fontFamily: 'sans-serif', fontSize: 12, marginTop: 6, alignSelf: 'flex-end' },
  quickSection: { gap: 8, marginTop: 6, marginBottom: 20 },
  quickPrompt: { minHeight: 58, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickText: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 12.5, lineHeight: 17 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 6, marginTop: 8 },
  disclaimerText: { flex: 1, fontFamily: 'sans-serif', fontSize: 12, lineHeight: 16 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 18 : 10, flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  input: { flex: 1, minHeight: 48, maxHeight: 112, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 11, fontFamily: 'sans-serif', fontSize: 14 },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: LousaPalette.berry, alignItems: 'center', justifyContent: 'center' },
});
