import { encryptedJsonStore } from '../security/encryptedStateStorage';
import type { DeliveryAddress } from '../domain/models';

const KEY = 'lousa-address-draft-v2';

export type AddressDraft<T extends object = Partial<DeliveryAddress>> = T & { savedAt: string };

export async function saveAddressDraft<T extends object>(draft: T) {
  const value: AddressDraft<T> = { ...draft, savedAt: new Date().toISOString() };
  await encryptedJsonStore.set(KEY, value);
}

export async function loadAddressDraft<T extends object = Partial<DeliveryAddress>>(): Promise<AddressDraft<T> | null> {
  return encryptedJsonStore.get<AddressDraft<T>>(KEY);
}

export async function clearAddressDraft() {
  await encryptedJsonStore.remove(KEY);
}

export async function clearAddressDraftForUser() {
  await encryptedJsonStore.remove(KEY);
}

// Explicit names used by the delivery flow.
export const loadDeliveryAddressDraft = loadAddressDraft;
export const saveDeliveryAddressDraft = saveAddressDraft;
export const clearDeliveryAddressDraft = clearAddressDraft;
