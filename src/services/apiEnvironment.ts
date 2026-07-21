import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type ApiEnvironmentStatus = 'ready' | 'missing_api_url' | 'localhost_forbidden' | 'invalid_protocol' | 'insecure_release_api';

export interface ApiEnvironmentCheck {
  status: ApiEnvironmentStatus;
  apiUrl: string | null;
  isUsableOnDevice: boolean;
  message: string | null;
}

const EXTRA = Constants.expoConfig?.extra || {};
const RAW_API_URL = String(EXTRA.publicApiUrl || process.env.EXPO_PUBLIC_LOUSA_API_URL || '').trim();
const RELEASE_BUILD =
  EXTRA.releaseBuild === true ||
  process.env.EXPO_PUBLIC_RELEASE_BUILD === 'true' ||
  EXTRA.buildChannel === 'production' ||
  process.env.EXPO_PUBLIC_BUILD_CHANNEL === 'production';

export function getConfiguredApiUrl() {
  return RAW_API_URL.replace(/\/$/, '');
}

export function checkApiEnvironment(): ApiEnvironmentCheck {
  const apiUrl = getConfiguredApiUrl();
  if (!apiUrl) {
    return {
      status: 'missing_api_url',
      apiUrl: null,
      isUsableOnDevice: false,
      message: 'Backend API не настроен для этой сборки. Укажите EXPO_PUBLIC_LOUSA_API_URL.',
    };
  }
  if (!/^https?:\/\//i.test(apiUrl)) {
    return {
      status: 'invalid_protocol',
      apiUrl,
      isUsableOnDevice: false,
      message: 'Адрес backend API должен начинаться с http:// или https://.',
    };
  }
  const isLocalhost = /(^https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiUrl);
  if (isLocalhost && (Platform.OS === 'android' || RELEASE_BUILD)) {
    return {
      status: 'localhost_forbidden',
      apiUrl,
      isUsableOnDevice: false,
      message: 'На Android localhost указывает на телефон, а не на Mac. Используйте IP компьютера или HTTPS backend.',
    };
  }
  if (RELEASE_BUILD && !/^https:\/\//i.test(apiUrl)) {
    return {
      status: 'insecure_release_api',
      apiUrl,
      isUsableOnDevice: false,
      message: 'Production-сборка LOUSA работает только с HTTPS backend API.',
    };
  }
  return { status: 'ready', apiUrl, isUsableOnDevice: true, message: null };
}

export function assertApiEnvironmentReady() {
  const check = checkApiEnvironment();
  if (!check.isUsableOnDevice || !check.apiUrl) {
    const error = new Error(check.message || 'Backend API не настроен.');
    (error as Error & { code?: string }).code =
      check.status === 'localhost_forbidden'
        ? 'LOCALHOST_API_FORBIDDEN'
        : check.status === 'insecure_release_api'
          ? 'INSECURE_RELEASE_API'
          : 'MISSING_API_URL';
    throw error;
  }
  return check.apiUrl;
}
