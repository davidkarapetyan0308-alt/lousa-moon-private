import { findAllergenConflicts, hasUnrecognizedAllergens, structureAllergens } from '../src/services/allergenSafety';

describe('box allergen safety', () => {
  test('normalizes multilingual allergy labels', () => {
    expect(structureAllergens(['орехи', 'lactose', 'բույր']).map((item) => item.code)).toEqual(['nuts', 'milk', 'fragrance']);
  });

  test('blocks catalog products with a matching allergen', () => {
    expect(findAllergenConflicts({ foodAllergies: ['орехи'] }, { allergens: ['nuts', 'milk'] })).toEqual(['nuts']);
  });

  test('requires manual review for an unknown free-text allergen', () => {
    expect(hasUnrecognizedAllergens({ foodAllergies: ['редкий экстракт'] })).toBe(true);
  });
});
