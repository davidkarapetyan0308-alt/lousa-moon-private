export type AddressFieldOrigin = 'provider_confirmed' | 'inferred' | 'user_entered' | 'unknown';
export type AddressFieldOrigins = Record<string, AddressFieldOrigin>;

const allowed = new Set<AddressFieldOrigin>(['provider_confirmed', 'inferred', 'user_entered', 'unknown']);
const trackedFields = ['country', 'region', 'city', 'district', 'street', 'house', 'postalCode'] as const;

function normalizedOrigin(value: unknown): AddressFieldOrigin | null {
  return allowed.has(value as AddressFieldOrigin) ? value as AddressFieldOrigin : null;
}

export function buildAddressFieldOrigins(input: {
  body: Record<string, unknown>;
  existing?: AddressFieldOrigins | null;
  providerPlaceId?: string | null;
  explicitlyChangedFields?: string[];
}): AddressFieldOrigins {
  const supplied = input.body.fieldOrigins && typeof input.body.fieldOrigins === 'object'
    ? input.body.fieldOrigins as Record<string, unknown>
    : {};
  const changed = new Set(input.explicitlyChangedFields || []);
  const result: AddressFieldOrigins = { ...(input.existing || {}) };

  for (const field of trackedFields) {
    const explicit = normalizedOrigin(supplied[field]);
    if (explicit) {
      result[field] = explicit;
      continue;
    }
    if (changed.has(field)) {
      result[field] = 'user_entered';
      continue;
    }
    const hasValue = String(input.body[field] ?? '').trim().length > 0;
    if (!hasValue) {
      result[field] = result[field] || 'unknown';
    } else if (input.providerPlaceId) {
      result[field] = result[field] || 'provider_confirmed';
    } else {
      result[field] = result[field] || 'user_entered';
    }
  }
  return result;
}

export function mapProviderOrigins(input: {
  confirmed: string[];
  inferred: string[];
}): AddressFieldOrigins {
  const result: AddressFieldOrigins = {};
  for (const field of input.confirmed) result[field] = 'provider_confirmed';
  for (const field of input.inferred) if (!result[field]) result[field] = 'inferred';
  return result;
}
