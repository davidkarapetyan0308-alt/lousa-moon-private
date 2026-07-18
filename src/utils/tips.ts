type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
type Language = 'en' | 'ru' | 'hy';

/**
 * Gentle self-care prompts only. These messages deliberately avoid diagnosis,
 * treatment claims, hormone promises and instructions that could be read as
 * medical advice.
 */
export const CYCLE_TIPS: Record<Language, Record<Phase, string[]>> = {
  en: {
    menstrual: [
      'Give yourself a little more rest today if your body is asking for it.',
      'A warm drink and regular water can make it easier to keep up a comfortable routine.',
      'Gentle stretching or a calm walk may feel better than an intense workout today.',
      'A warm compress or bath can be a comforting option for your lower back.',
      'Choose simple meals that feel satisfying and familiar to you.',
      'Write down how you feel today so you can notice patterns over time.',
    ],
    follicular: [
      'If your energy is returning, increase activity gradually rather than all at once.',
      'This can be a useful time to plan a new task and split it into small steps.',
      'Add familiar sources of fiber and healthy fats if they suit you.',
      'Make space for a task that benefits from concentration or curiosity.',
      'Keep your skincare simple and comfortable rather than changing many products at once.',
      'Notice what feels easier today and record it for your own comparison.',
    ],
    ovulation: [
      'If you feel more energetic or social, use that energy without pushing past your limits.',
      'Keep water nearby, especially on a more active day.',
      'A calendar estimate does not confirm ovulation, so treat this phase as approximate.',
      'Choose movement based on how you feel today, not only on the predicted phase.',
      'This may be a convenient day for a conversation or task you have been postponing.',
      'A short check-in can help you compare this day with future cycles.',
    ],
    luteal: [
      'For longer-lasting fullness, try oats, whole-grain bread or another familiar complex carbohydrate.',
      'If your energy feels lower, choose a walk, stretching, pilates or another gentle activity.',
      'A short journal entry may help you understand changes in mood before your period.',
      'If you notice puffiness, see whether less salty food feels more comfortable for you.',
      'Prepare a few comforting essentials in advance so the next days feel less rushed.',
      'Keep your routine flexible and adjust it to your actual symptoms today.',
    ],
  },
  ru: {
    menstrual: [
      'Дай себе немного больше отдыха, если сегодня тело просит замедлиться.',
      'Тёплый напиток и обычная вода помогут поддерживать привычный комфортный режим.',
      'Мягкая растяжка или спокойная прогулка сегодня могут подойти лучше интенсивной тренировки.',
      'Грелка или тёплая ванна могут стать приятным вариантом для поясницы.',
      'Выбери простую и привычную еду, после которой тебе комфортно.',
      'Коротко запиши своё состояние, чтобы со временем замечать личные закономерности.',
    ],
    follicular: [
      'Если энергия возвращается, увеличивай активность постепенно, без резкой нагрузки.',
      'Можно выбрать одно новое дело и разбить его на небольшие понятные шаги.',
      'Добавь привычные источники клетчатки и полезных жиров, если они тебе подходят.',
      'Удели немного времени задаче, для которой нужны концентрация или любопытство.',
      'Оставь уход за кожей простым и комфортным, не меняя сразу много средств.',
      'Отметь, что сегодня даётся легче, чтобы потом сравнить разные дни цикла.',
    ],
    ovulation: [
      'Если чувствуешь больше энергии или желания общаться, используй это без перегрузки.',
      'Держи воду рядом, особенно если сегодня больше двигаешься.',
      'Календарный расчёт не подтверждает овуляцию, поэтому воспринимай фазу как приблизительную.',
      'Выбирай активность по реальному самочувствию, а не только по прогнозной фазе.',
      'Сегодня может быть удобно заняться разговором или делом, которое ты откладывала.',
      'Короткая отметка поможет сравнить этот день с будущими циклами.',
    ],
    luteal: [
      'Чтобы дольше сохранять сытость, попробуй овсянку, цельнозерновой хлеб или другой привычный сложный углевод.',
      'Если энергии меньше, выбери прогулку, растяжку, пилатес или другую спокойную активность.',
      'Короткая запись мыслей может помочь лучше понять изменения настроения перед менструацией.',
      'Если замечаешь отёчность, проверь, комфортнее ли тебе с меньшим количеством очень солёной пищи.',
      'Подготовь несколько привычных вещей заранее, чтобы следующие дни прошли без спешки.',
      'Оставь режим гибким и ориентируйся на сегодняшние симптомы, а не только на календарь.',
    ],
  },
  hy: {
    menstrual: [
      'Եթե այսօր մարմինդ դանդաղելու կարիք ունի, մի փոքր ավելի շատ հանգստացիր։',
      'Տաք ըմպելիքն ու սովորական ջուրը կարող են օգնել պահպանել հարմարավետ առօրյան։',
      'Նուրբ ձգումները կամ հանգիստ քայլքը կարող են ավելի հարմար լինել, քան ծանր մարզումը։',
      'Տաքացուցիչը կամ տաք լոգանքը կարող են հաճելի տարբերակ լինել գոտկատեղի համար։',
      'Ընտրիր պարզ ու ծանոթ սնունդ, որից հետո քեզ հարմարավետ ես զգում։',
      'Կարճ գրիր ինքնազգացողությունդ՝ ժամանակի ընթացքում անձնական օրինաչափությունները նկատելու համար։',
    ],
    follicular: [
      'Եթե էներգիադ վերադառնում է, ակտիվությունն ավելացրու աստիճանաբար։',
      'Կարող ես ընտրել մեկ նոր գործ և բաժանել այն փոքր, հասկանալի քայլերի։',
      'Ավելացրու քեզ հարմար մանրաթել և օգտակար ճարպեր պարունակող ծանոթ մթերքներ։',
      'Ժամանակ հատկացրու կենտրոնացում կամ հետաքրքրություն պահանջող գործին։',
      'Մաշկի խնամքը պահիր պարզ ու հարմարավետ՝ միանգամից շատ բան չփոխելով։',
      'Նշիր, թե այսօր ինչն է ավելի հեշտ ստացվում, որպեսզի հետո համեմատես օրերը։',
    ],
    ovulation: [
      'Եթե ավելի շատ էներգիա կամ շփվելու ցանկություն ունես, օգտագործիր այն առանց գերծանրաբեռնվելու։',
      'Ջուրը մոտ պահիր, հատկապես եթե այսօր ավելի ակտիվ ես։',
      'Օրացուցային հաշվարկը չի հաստատում օվուլյացիան, ուստի փուլը համարիր մոտավոր։',
      'Ակտիվությունն ընտրիր ըստ իրական ինքնազգացողության, ոչ միայն կանխատեսվող փուլի։',
      'Այս օրը կարող է հարմար լինել հետաձգած զրույցի կամ գործի համար։',
      'Կարճ գրառումը կօգնի այս օրը համեմատել ապագա ցիկլերի հետ։',
    ],
    luteal: [
      'Ավելի երկար կուշտ մնալու համար փորձիր վարսակ, ամբողջահատիկ հաց կամ քեզ ծանոթ այլ բարդ ածխաջուր։',
      'Եթե էներգիադ պակաս է, ընտրիր քայլք, ձգումներ, պիլատես կամ այլ հանգիստ ակտիվություն։',
      'Կարճ գրառումը կարող է օգնել հասկանալ դաշտանից առաջ տրամադրության փոփոխությունները։',
      'Եթե այտուցվածություն ես նկատում, տես՝ ավելի քիչ աղի սնունդն արդյոք հարմար է քեզ։',
      'Մի քանի անհրաժեշտ ու ծանոթ իր պատրաստիր նախապես, որպեսզի հաջորդ օրերը չանցնեն շտապելով։',
      'Պահիր առօրյադ ճկուն և առաջնորդվիր այսօրվա ախտանիշներով, ոչ միայն օրացույցով։',
    ],
  },
};

export function getDailyTip(phase: Phase, cycleDay: number, language: Language = 'ru'): string {
  const phaseTips = CYCLE_TIPS[language]?.[phase] || CYCLE_TIPS.ru[phase];
  const index = (new Date().getDate() + cycleDay) % phaseTips.length;
  return phaseTips[index];
}
