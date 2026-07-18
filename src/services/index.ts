import Constants from 'expo-constants';
import { apiServices } from './api';
import { localServices } from './local';
import { firebaseAuthService } from './firebase';

export type ServiceMode = 'demo' | 'api';
export type AuthProviderMode = 'legacy' | 'firebase';

export type StartupConfigIssue = {
  code: 'INVALID_APP_MODE' | 'MISSING_API_URL' | 'DEMO_IN_RELEASE' | 'FIREBASE_AUTH_NOT_CONFIGURED' | 'LEGACY_AUTH_FORBIDDEN';
  title: string;
  message: string;
  action: string;
  details: string;
};

const APP_MODE = process.env.EXPO_PUBLIC_APP_MODE || 'api';
const API_URL = process.env.EXPO_PUBLIC_LOUSA_API_URL || '';
const AUTH_PROVIDER = (process.env.EXPO_PUBLIC_AUTH_PROVIDER || 'firebase') as AuthProviderMode;
const FIREBASE_PROJECT_ID = String(Constants.expoConfig?.extra?.firebaseProjectId || '');
const FIREBASE_APP_ID = String(Constants.expoConfig?.extra?.firebaseAppId || '');
const IS_RELEASE = process.env.EXPO_PUBLIC_RELEASE_BUILD === 'true';

/**
 * Returns the configured runtime mode without throwing during module import.
 *
 * Previous V9 builds threw here when EXPO_PUBLIC_LOUSA_API_URL was missing.
 * Because RootLayout imports services before it can hide the native splash screen,
 * that crash left Android forever on the native splash logo. Runtime config issues
 * are now surfaced through getStartupConfigIssue() so the UI can render a clear
 * setup screen instead of freezing.
 */
export function getServiceMode(): ServiceMode {
  return APP_MODE === 'demo' ? 'demo' : 'api';
}

export function getAuthProviderMode(): AuthProviderMode {
  return AUTH_PROVIDER === 'legacy' ? 'legacy' : 'firebase';
}

export function getStartupConfigIssue(): StartupConfigIssue | null {
  if (APP_MODE !== 'api' && APP_MODE !== 'demo') {
    return {
      code: 'INVALID_APP_MODE',
      title: 'Неверный режим приложения',
      message: 'LOUSA MOON собрана с неизвестным режимом запуска.',
      action: 'Пересобери приложение с EXPO_PUBLIC_APP_MODE=api или EXPO_PUBLIC_APP_MODE=demo.',
      details: `EXPO_PUBLIC_APP_MODE=${APP_MODE}`,
    };
  }

  // Only the explicit release flag blocks demo mode. NODE_ENV is production for normal
  // Android release bundles as well, including local QA builds, so relying on
  // NODE_ENV here made test APKs unusable.
  if (IS_RELEASE && APP_MODE === 'demo') {
    return {
      code: 'DEMO_IN_RELEASE',
      title: 'Demo-режим запрещён для release',
      message: 'Эта сборка отмечена как release, но включён demo-режим.',
      action: 'Пересобери release с EXPO_PUBLIC_APP_MODE=api и настоящим EXPO_PUBLIC_LOUSA_API_URL.',
      details: 'Release build cannot run in demo mode.',
    };
  }

  if (IS_RELEASE && AUTH_PROVIDER === 'legacy') {
    return {
      code: 'LEGACY_AUTH_FORBIDDEN',
      title: 'Старая авторизация запрещена',
      message: 'Release LOUSA MOON должен использовать Firebase Auth, а не старую самописную авторизацию.',
      action: 'Удалите EXPO_PUBLIC_AUTH_PROVIDER=legacy и пересоберите приложение.',
      details: 'Release build cannot use legacy auth.',
    };
  }

  if (APP_MODE === 'api' && !API_URL) {
    return {
      code: 'MISSING_API_URL',
      title: 'Не указан backend API',
      message: 'Приложение собрано в API-режиме, но без адреса сервера. Поэтому вход, письма, заказы и карта не смогут работать.',
      action: 'Пересобери APK с EXPO_PUBLIC_LOUSA_API_URL=http://IP_ТВОЕГО_MAC:4100 для локального теста или с HTTPS-адресом production API.',
      details: 'Missing EXPO_PUBLIC_LOUSA_API_URL.',
    };
  }


  if (APP_MODE === 'api' && AUTH_PROVIDER === 'firebase' && (!FIREBASE_PROJECT_ID || !FIREBASE_APP_ID)) {
    return {
      code: 'FIREBASE_AUTH_NOT_CONFIGURED',
      title: 'Firebase Auth не настроен',
      message: 'Эта сборка выбрала EXPO_PUBLIC_AUTH_PROVIDER=firebase, но не содержит Firebase project/app config.',
      action: 'Проверьте google-services.json и app.config.js, затем пересоберите APK.',
      details: 'Firebase project/app data was not embedded by Expo config.',
    };
  }

  return null;
}

export function isStartupConfigValid() {
  return getStartupConfigIssue() === null;
}

const apiRuntimeServices = getAuthProviderMode() === 'firebase'
  ? { ...apiServices, auth: firebaseAuthService }
  : apiServices;

export const services = getServiceMode() === 'api'
  ? { ...localServices, ...apiRuntimeServices }
  : localServices;

export { localServices } from './local';
export { apiServices } from './api';

export * from './engagement';
export * from './productAnalytics';
