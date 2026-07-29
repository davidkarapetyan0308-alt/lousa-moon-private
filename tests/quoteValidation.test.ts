import { formatQuoteValidationError } from '../src/services/quoteValidation';

describe('quote validation copy', () => {
  test('never exposes raw allergen codes to the customer', () => {
    const message = formatQuoteValidationError(['ALLERGEN_CONFLICT:wipes:fragrance'], 'ru');
    expect(message).toContain('Без ароматизаторов');
    expect(message).not.toContain('ALLERGEN_CONFLICT');
    expect(message).not.toContain(':fragrance');
  });

  test('has understandable fallback copy', () => {
    expect(formatQuoteValidationError(['OUT_OF_STOCK:wipes'], 'en')).toContain('selected restrictions');
  });
});
