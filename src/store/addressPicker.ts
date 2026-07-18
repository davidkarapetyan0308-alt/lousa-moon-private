import { create } from 'zustand';

import type { GeocodedAddress } from '../services/maps';

export interface AddressPickerSeed {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

interface AddressPickerState {
  seed: AddressPickerSeed | null;
  confirmedSelection: GeocodedAddress | null;
  openWith: (seed: AddressPickerSeed) => void;
  confirm: (selection: GeocodedAddress) => void;
  clearConfirmed: () => void;
}

export const useAddressPickerStore = create<AddressPickerState>((set) => ({
  seed: null,
  confirmedSelection: null,
  openWith: (seed) => set({ seed, confirmedSelection: null }),
  confirm: (confirmedSelection) => set({ confirmedSelection }),
  clearConfirmed: () => set({ confirmedSelection: null }),
}));
