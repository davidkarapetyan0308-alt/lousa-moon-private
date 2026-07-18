import * as Location from 'expo-location';

import type { DeliveryAddress, SupportedLanguage } from '../domain/models';
import { normalizeBackendDeliveryZoneCheck, type DeliveryZoneTruth } from './deliveryZoneLocal';
import { assertApiEnvironmentReady } from './apiEnvironment';
import { secureStorage } from './security/secureStorage';


export interface AddressPrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

export interface GeocodedAddress {
  provider: 'google' | 'maptiler' | 'device';
  providerPlaceId: string | null;
  formattedAddress: string;
  country: string;
  region: string;
  city: string;
  district: string;
  street: string;
  house: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

interface ApiErrorEnvelope {
  error?: { code?: string; message?: string };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = assertApiEnvironmentReady();
  const accessToken = await secureStorage.get('accessToken');
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const envelope = (payload || {}) as ApiErrorEnvelope;
    const error = new Error(envelope.error?.message || `Map request failed (${response.status})`);
    (error as Error & { code?: string }).code = envelope.error?.code || `HTTP_${response.status}`;
    throw error;
  }
  return payload as T;
}

export async function searchRealAddresses(
  input: string,
  language: SupportedLanguage,
  sessionToken: string,
): Promise<AddressPrediction[]> {
  if (input.trim().length < 3) return [];
  const query = new URLSearchParams({ input: input.trim(), language, sessionToken, country: 'AM', components: 'country:am' });
  const result = await apiRequest<{ items: Array<AddressPrediction & { description?: string; mainText?: string }> }>(`/v1/maps/autocomplete?${query.toString()}`);
  return result.items.map((item) => ({
    placeId: item.placeId,
    primaryText: item.primaryText || item.mainText || item.fullText || item.description || '',
    secondaryText: item.secondaryText || '',
    fullText: item.fullText || item.description || [item.primaryText || item.mainText, item.secondaryText].filter(Boolean).join(', '),
  }));
}

export async function getRealPlaceDetails(
  placeId: string,
  language: SupportedLanguage,
  sessionToken: string,
): Promise<GeocodedAddress> {
  const query = new URLSearchParams({ placeId, language, sessionToken });
  return apiRequest<GeocodedAddress>(`/v1/maps/place-details?${query.toString()}`);
}

export async function reverseGeocodeRealCoordinate(
  latitude: number,
  longitude: number,
  language: SupportedLanguage,
): Promise<GeocodedAddress> {
  const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), language });
  try {
    return await apiRequest<GeocodedAddress>(`/v1/maps/reverse-geocode?${query.toString()}`);
  } catch (error) {
    const native = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = native[0];
    if (!first) throw error;
    const street = first.street || first.name || '';
    const house = first.streetNumber || '';
    const formattedAddress = [street, house, first.city || first.subregion, first.region, first.country]
      .filter(Boolean)
      .join(', ');
    return {
      provider: 'device',
      providerPlaceId: null,
      formattedAddress: formattedAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      country: first.country || '',
      region: first.region || '',
      city: first.city || first.subregion || '',
      district: first.district || '',
      street,
      house,
      postalCode: first.postalCode || '',
      latitude,
      longitude,
    };
  }
}

export async function checkRealDeliveryZone(latitude: number, longitude: number): Promise<DeliveryZoneTruth> {
  const payload = await apiRequest<any>('/v1/delivery/check-zone', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  });
  return normalizeBackendDeliveryZoneCheck(payload);
}


export async function saveDeliveryAddressRemote(address: DeliveryAddress, updateExisting = false): Promise<DeliveryAddress> {
  const path = updateExisting ? `/v1/delivery-addresses/${encodeURIComponent(address.id)}` : '/v1/delivery-addresses';
  return apiRequest<DeliveryAddress>(path, {
    method: updateExisting ? 'PATCH' : 'POST',
    body: JSON.stringify(address),
  });
}

export async function requestCurrentDeviceLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    const blocked = permission.canAskAgain === false;
    const error = new Error(blocked ? 'LOCATION_PERMISSION_BLOCKED' : 'LOCATION_PERMISSION_DENIED');
    (error as Error & { code?: string }).code = blocked ? 'LOCATION_PERMISSION_BLOCKED' : 'LOCATION_PERMISSION_DENIED';
    throw error;
  }

  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) {
    const error = new Error('LOCATION_SERVICES_DISABLED');
    (error as Error & { code?: string }).code = 'LOCATION_SERVICES_DISABLED';
    throw error;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
}
