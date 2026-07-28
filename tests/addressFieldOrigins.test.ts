import { buildAddressFieldOrigins, mapProviderOrigins } from '../apps/api/src/addresses/fieldOrigins';

describe('address field origins', () => {
  test('marks explicit manual changes as user entered', () => {
    const result = buildAddressFieldOrigins({
      body: { country: 'Armenia', city: 'Gyumri', street: 'Abovyan' },
      providerPlaceId: 'map:1',
      existing: { country: 'provider_confirmed', city: 'provider_confirmed', street: 'provider_confirmed' },
      explicitlyChangedFields: ['street'],
    });
    expect(result.street).toBe('user_entered');
    expect(result.city).toBe('provider_confirmed');
  });

  test('does not label fallback provider values as confirmed', () => {
    const result = mapProviderOrigins({ confirmed: ['street'], inferred: ['country', 'region', 'city'] });
    expect(result.street).toBe('provider_confirmed');
    expect(result.city).toBe('inferred');
  });

  test('rejects unrecognized origin values', () => {
    const result = buildAddressFieldOrigins({ body: { country: 'Armenia', fieldOrigins: { country: 'trusted' } } });
    expect(result.country).toBe('user_entered');
  });
});
