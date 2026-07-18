import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export type AvatarPickResult = { uri: string } | null;

const COPY = {
  ru: {
    deniedTitle: 'Нет доступа к фотографиям', deniedBody: 'Разреши доступ в настройках телефона, чтобы выбрать аватар.', cancel: 'Отмена', settings: 'Открыть настройки', errorTitle: 'Не удалось выбрать фото', errorBody: 'Попробуй другое изображение или повтори позже.',
  },
  en: {
    deniedTitle: 'Photo access is off', deniedBody: 'Allow access in phone settings to choose an avatar.', cancel: 'Cancel', settings: 'Open settings', errorTitle: 'Could not choose photo', errorBody: 'Try another image or try again later.',
  },
  hy: {
    deniedTitle: 'Լուսանկարների հասանելիությունն անջատված է', deniedBody: 'Թույլատրիր հասանելիությունը հեռախոսի կարգավորումներում՝ ավատար ընտրելու համար։', cancel: 'Չեղարկել', settings: 'Բացել կարգավորումները', errorTitle: 'Չհաջողվեց ընտրել լուսանկարը', errorBody: 'Փորձիր մեկ այլ նկար կամ կրկին փորձիր ավելի ուշ։',
  },
} as const;

async function ensureIosPermission(language: 'ru' | 'en' | 'hy'): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted || current.accessPrivileges === 'limited') return true;
  const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (result.granted || result.accessPrivileges === 'limited') return true;
  const copy = COPY[language];
  Alert.alert(copy.deniedTitle, copy.deniedBody, [
    { text: copy.cancel, style: 'cancel' },
    { text: copy.settings, onPress: () => Linking.openSettings().catch(() => {}) },
  ]);
  return false;
}

export async function deleteStoredAvatar(uri?: string | null): Promise<void> {
  if (!uri || !FileSystem.documentDirectory) return;
  const profileDirectory = `${FileSystem.documentDirectory}profile/`;
  if (!uri.startsWith(profileDirectory)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

async function persistAvatar(sourceUri: string): Promise<string> {
  const normalized = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG }
  );

  if (!FileSystem.documentDirectory) {
    if (Platform.OS === 'web' && normalized.uri.startsWith('data:')) {
      const blob = await (await fetch(normalized.uri)).blob();
      return URL.createObjectURL(blob);
    }
    return normalized.uri;
  }

  const directory = `${FileSystem.documentDirectory}profile/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => {});
  const target = `${directory}avatar-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: normalized.uri, to: target });
  return target;
}

export async function pickAvatar(
  language: 'ru' | 'en' | 'hy',
  previousUri?: string | null
): Promise<AvatarPickResult> {
  const copy = COPY[language];
  try {
    if (!(await ensureIosPermission(language))) return null;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.72,
      base64: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return null;
    const uri = await persistAvatar(result.assets[0].uri);
    await deleteStoredAvatar(previousUri);
    return { uri };
  } catch {
    Alert.alert(copy.errorTitle, copy.errorBody);
    return null;
  }
}
