import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ModalScreen, ScreenScroll } from '../../src/components/layout';
import { MaterialSymbol } from '../../src/components/MaterialSymbol';
import { SurfaceCard } from '../../src/components/ui';
import { useUserStore } from '../../src/store';
import { useTheme } from '../../src/theme/ThemeProvider';
import { LousaPalette } from '../../src/theme/designSystem';

const CONTENT = {
  ru: {
    privacy: {
      title: 'Конфиденциальность',
      sections: [
        ['Что хранится локально', 'Настройки интерфейса сохраняются на устройстве. Чувствительные данные цикла и адреса хранятся в защищённом слое приложения.'],
        ['Чувствительные данные', 'Данные цикла и самочувствия не должны передаваться курьеру. Курьеру доступны только имя, телефон, адрес, окно доставки и комментарий.'],
        ['Твои права', 'Ты можешь экспортировать данные, удалить локальные данные или запросить удаление аккаунта в настройках.'],
      ],
    },
    terms: {
      title: 'Условия использования',
      sections: [
        ['Прогнозы', 'Прогноз цикла является приблизительной календарной оценкой и не является диагнозом или методом контрацепции.'],
        ['LOUSA BOX', 'Состав и цена бокса подтверждаются серверным расчётом перед оформлением. Платные дополнения добавляются только после явного выбора.'],
        ['Безопасность', 'При сильной, необычной боли, очень обильном кровотечении, длительном отсутствии менструации или подозрении на беременность обратись к медицинскому специалисту.'],
      ],
    },
  },
  en: {
    privacy: {
      title: 'Privacy',
      sections: [
        ['Local storage', 'Interface preferences are stored on this device. Sensitive cycle data and addresses are kept in the app protected layer.'],
        ['Sensitive data', 'Cycle and wellness data must never be exposed to a courier. A courier only needs a name, phone, address, delivery window and note.'],
        ['Your rights', 'You can export data, remove local data, or request account deletion in settings.'],
      ],
    },
    terms: {
      title: 'Terms of use',
      sections: [
        ['Forecasts', 'Cycle forecasts are approximate calendar estimates and are not a diagnosis or contraception.'],
        ['LOUSA BOX', 'Box contents and pricing are confirmed by a server quote before checkout. Paid extras are added only after explicit selection.'],
        ['Safety', 'Seek medical care for severe or unusual pain, very heavy bleeding, a prolonged missed period, or possible pregnancy.'],
      ],
    },
  },
  hy: {
    privacy: {
      title: 'Գաղտնիություն',
      sections: [
        ['Տեղային պահպանում', 'Ինտերֆեյսի կարգավորումները պահվում են այս սարքում։ Ցիկլի զգայուն տվյալներն ու հասցեները պահվում են հավելվածի պաշտպանված շերտում։'],
        ['Զգայուն տվյալներ', 'Ցիկլի և ինքնազգացողության տվյալները չեն փոխանցվում առաքիչին։ Առաքիչը տեսնում է միայն անունը, հեռախոսը, հասցեն, ժամային պատուհանն ու մեկնաբանությունը։'],
        ['Քո իրավունքները', 'Կարգավորումներում կարող ես արտահանել տվյալները, ջնջել տեղային տվյալները կամ պահանջել հաշվի ջնջում։'],
      ],
    },
    terms: {
      title: 'Օգտագործման պայմաններ',
      sections: [
        ['Կանխատեսումներ', 'Ցիկլի կանխատեսումը մոտավոր օրացուցային գնահատում է և ախտորոշում կամ հակաբեղմնավորում չէ։'],
        ['LOUSA BOX', 'Բոքսի կազմն ու գինը հաստատվում են սերվերային հաշվարկով՝ ձևակերպումից առաջ։ Վճարովի հավելումները ավելացվում են միայն հստակ ընտրությունից հետո։'],
        ['Անվտանգություն', 'Ուժեղ կամ անսովոր ցավի, շատ առատ արյունահոսության, երկար բացակայող դաշտանի կամ հնարավոր հղիության դեպքում դիմիր բժշկի։'],
      ],
    },
  },
} as const;

export default function LegalScreen() {
  const params = useLocalSearchParams<{ document?: 'privacy' | 'terms' }>();
  const language = useUserStore((state) => state.language);
  const { colors } = useTheme();
  const document = params.document === 'terms' ? 'terms' : 'privacy';
  const content = CONTENT[language][document];

  return (
    <ModalScreen title={content.title} closeIcon="arrow_back">
      <ScreenScroll contentContainerStyle={styles.content}>
        <SurfaceCard padding={18} tone="accent">
          <View style={styles.introRow}>
            <MaterialSymbol name={document === 'privacy' ? 'shield' : 'description'} size={23} color={LousaPalette.berry} />
            <Text style={[styles.intro, { color: colors.onSurfaceVariant }]}>LOUSA MOON · Version 1.18.22 · Build 133</Text>
          </View>
        </SurfaceCard>
        {content.sections.map(([title, body]) => (
          <SurfaceCard key={title} padding={18}>
            <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text>
            <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{body}</Text>
          </SurfaceCard>
        ))}
      </ScreenScroll>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingTop: 16 },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intro: { flex: 1, fontFamily: 'sans-serif-medium', fontSize: 12 },
  title: { fontFamily: 'sans-serif-medium', fontSize: 17, marginBottom: 7 },
  body: { fontFamily: 'sans-serif', fontSize: 14, lineHeight: 21 },
});
