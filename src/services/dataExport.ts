import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  useBoxStore,
  useCycleStore,
  useEngagementStore,
  useNotificationStore,
  useUserStore,
  useWellnessStore,
} from '../store';

export interface LousaExportEnvelope {
  schemaVersion: 7;
  exportedAt: string;
  disclaimer: string;
  user: {
    name: string;
    language: string;
    isPremium: boolean;
    isDemoMode: boolean;
    communicationStyle: string;
  };
  cycle: ReturnType<typeof useCycleStore.getState> extends infer T ? Partial<T> : never;
  wellness: ReturnType<typeof useWellnessStore.getState> extends infer T ? Partial<T> : never;
  box: ReturnType<typeof useBoxStore.getState> extends infer T ? Partial<T> : never;
  notifications: ReturnType<typeof useNotificationStore.getState> extends infer T ? Partial<T> : never;
  engagement: ReturnType<typeof useEngagementStore.getState> extends infer T ? Partial<T> : never;
}

function stripFunctions<T extends object>(state: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(state as Record<string, unknown>).filter(([, value]) => typeof value !== 'function')
  ) as Partial<T>;
}

export function createLocalExport(): LousaExportEnvelope {
  const user = useUserStore.getState();
  return {
    schemaVersion: 7,
    exportedAt: new Date().toISOString(),
    disclaimer: 'This export is for personal reference and is not a medical diagnosis.',
    user: {
      name: user.name,
      language: user.language,
      isPremium: user.isPremium,
      isDemoMode: user.isDemoMode,
      communicationStyle: user.communicationStyle,
    },
    cycle: stripFunctions(useCycleStore.getState()) as LousaExportEnvelope['cycle'],
    wellness: stripFunctions(useWellnessStore.getState()) as LousaExportEnvelope['wellness'],
    box: stripFunctions(useBoxStore.getState()) as LousaExportEnvelope['box'],
    notifications: stripFunctions(useNotificationStore.getState()) as LousaExportEnvelope['notifications'],
    engagement: stripFunctions(useEngagementStore.getState()) as LousaExportEnvelope['engagement'],
  };
}

export async function exportLocalData(): Promise<{ uri: string | null; shared: boolean }> {
  const payload = JSON.stringify(createLocalExport(), null, 2);

  if (Platform.OS === 'web') {
    const blob = new Blob([payload], { type: 'application/json' });
    const uri = URL.createObjectURL(blob);
    return { uri, shared: false };
  }

  if (!FileSystem.cacheDirectory) return { uri: null, shared: false };
  const uri = `${FileSystem.cacheDirectory}lousa-export-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'LOUSA MOON data export',
      UTI: 'public.json',
    });
  }
  return { uri, shared: available };
}
