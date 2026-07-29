type SupportedLanguage = 'ru' | 'en' | 'hy';

const PRODUCT_NAMES: Record<SupportedLanguage, Record<string, string>> = {
  ru: { wipes: 'Деликатные салфетки' },
  en: { wipes: 'Gentle wipes' },
  hy: { wipes: 'Նուրբ անձեռոցիկներ' },
};

/** Converts backend validation codes into copy a customer can safely act on. */
export function formatQuoteValidationError(validationErrors: string[], language: SupportedLanguage): string {
  const conflict = validationErrors.find((value) => value.startsWith('ALLERGEN_CONFLICT:'));
  if (!conflict) {
    return language === 'hy'
      ? 'Բոքսի կազմը չի համապատասխանում ընտրված սահմանափակումներին։ Փոխիր կազմը և փորձիր նորից։'
      : language === 'en'
        ? 'Your box contains an item that does not match your selected restrictions. Update the contents and try again.'
        : 'В составе бокса есть товар, который не подходит под выбранные ограничения. Измени состав и попробуй ещё раз.';
  }

  const [, sku = '', rawAllergens = ''] = conflict.split(':');
  const item = PRODUCT_NAMES[language][sku] || (language === 'hy' ? 'Ապրանքը' : language === 'en' ? 'This item' : 'Этот товар');
  const fragranceConflict = rawAllergens.split('+').includes('fragrance');
  if (fragranceConflict) {
    return language === 'hy'
      ? `${item} չեն կարող ավելացվել, քանի որ ընտրվել է «Առանց բույրի»։ Ընտրիր այլ կազմ կամ փոխիր նախընտրությունները։`
      : language === 'en'
        ? `${item} cannot be added because you selected “Fragrance-free”. Choose another option or change your preferences.`
        : `«${item}» нельзя добавить, потому что выбрано «Без ароматизаторов». Выбери другой состав или измени предпочтения.`;
  }

  return language === 'hy'
    ? `${item} չի համապատասխանում ընտրված սահմանափակումներին։ Փոխիր կազմը և փորձիր նորից։`
    : language === 'en'
      ? `${item} does not match your selected restrictions. Update the contents and try again.`
      : `«${item}» не подходит под выбранные ограничения. Измени состав и попробуй ещё раз.`;
}

export class QuoteValidationError extends Error {
  readonly validationErrors: string[];

  constructor(validationErrors: string[], language: SupportedLanguage) {
    super(formatQuoteValidationError(validationErrors, language));
    this.name = 'QuoteValidationError';
    this.validationErrors = validationErrors;
  }
}
