import type { AllergenCode, StructuredAllergen } from '../domain/models';

const TERM_TO_CODE: Array<[AllergenCode, RegExp]> = [
  ['peanuts', /(?:peanut|арахис|գետնանուշ)/iu],
  ['nuts', /(?:nut|nuts|орех|миндал|фундук|ընկույզ|նուշ)/iu],
  ['milk', /(?:milk|dairy|lactose|молок|лактоз|կաթ|լակտոզ)/iu],
  ['gluten', /(?:gluten|wheat|глютен|пшениц|գլյուտեն|ցորեն)/iu],
  ['soy', /(?:soy|soya|со[яи]|սոյա)/iu],
  ['egg', /(?:egg|яйц|ձու)/iu],
  ['sesame', /(?:sesame|кунжут|քունջութ)/iu],
  ['herbs', /(?:herb|трав|բուսական|խոտաբույս)/iu],
  ['fragrance', /(?:fragrance|perfume|аромат|отдуш|բույր)/iu],
  ['latex', /(?:latex|латекс|լատեքս)/iu],
];

export function normalizeAllergenCode(value: unknown): AllergenCode {
  const term = String(value || '').trim().toLowerCase();
  if (!term) return 'unknown';
  return TERM_TO_CODE.find(([, pattern]) => pattern.test(term))?.[0] || 'unknown';
}

export function structureAllergens(values: unknown[]): StructuredAllergen[] {
  const result = new Map<AllergenCode, StructuredAllergen>();
  for (const value of values) {
    const label = String(value || '').trim();
    if (!label) continue;
    const code = normalizeAllergenCode(label);
    if (!result.has(code)) result.set(code, { code, label, severity: 'avoid' });
  }
  return [...result.values()];
}

export function allergenCodesFromPreferences(preferences: any): Set<AllergenCode> {
  const raw = [
    ...(Array.isArray(preferences?.foodAllergies) ? preferences.foodAllergies : []),
    ...(Array.isArray(preferences?.foodIntolerances) ? preferences.foodIntolerances : []),
    ...(Array.isArray(preferences?.cosmeticAllergies) ? preferences.cosmeticAllergies : []),
    ...(Array.isArray(preferences?.avoidedMaterials) ? preferences.avoidedMaterials : []),
  ];
  const codes = new Set<AllergenCode>(structureAllergens(raw).map((item) => item.code));
  for (const item of Array.isArray(preferences?.structuredAllergens) ? preferences.structuredAllergens : []) {
    const code = normalizeAllergenCode(item?.code || item?.label);
    codes.add(code);
  }
  if (preferences?.fragranceFree) codes.add('fragrance');
  codes.delete('unknown');
  return codes;
}

export function productAllergenCodes(metadata: any): Set<AllergenCode> {
  const raw = Array.isArray(metadata?.allergens) ? metadata.allergens : [];
  const codes = new Set<AllergenCode>();
  for (const value of raw) {
    const code = normalizeAllergenCode(value);
    if (code !== 'unknown') codes.add(code);
  }
  return codes;
}


export function hasUnrecognizedAllergens(preferences: any): boolean {
  const raw = [
    ...(Array.isArray(preferences?.foodAllergies) ? preferences.foodAllergies : []),
    ...(Array.isArray(preferences?.foodIntolerances) ? preferences.foodIntolerances : []),
    ...(Array.isArray(preferences?.cosmeticAllergies) ? preferences.cosmeticAllergies : []),
    ...(Array.isArray(preferences?.avoidedMaterials) ? preferences.avoidedMaterials : []),
  ];
  if (raw.some((value) => String(value || '').trim() && normalizeAllergenCode(value) === 'unknown')) return true;
  return (Array.isArray(preferences?.structuredAllergens) ? preferences.structuredAllergens : [])
    .some((item: any) => normalizeAllergenCode(item?.code || item?.label) === 'unknown');
}

export function findAllergenConflicts(preferences: any, productMetadata: any): AllergenCode[] {
  const userCodes = allergenCodesFromPreferences(preferences);
  return [...productAllergenCodes(productMetadata)].filter((code) => userCodes.has(code));
}
