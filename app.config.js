const fs = require('node:fs');
const path = require('node:path');

const PRODUCTION_ANDROID_PACKAGE = 'com.lousa.moon';
const QA_ANDROID_PACKAGE = 'com.lousa.moon.qa';

function readFirebaseAndroidConfig(relativeOrAbsolutePath, androidPackage) {
  const resolvedPath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(process.cwd(), relativeOrAbsolutePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`[LOUSA Firebase] Missing ${relativeOrAbsolutePath}. Download google-services.json for ${androidPackage}.`);
  }

  const payload = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const client = payload.client?.find(
    (item) => item.client_info?.android_client_info?.package_name === androidPackage,
  );
  if (!client) {
    throw new Error(`[LOUSA Firebase] google-services.json does not contain Android package ${androidPackage}.`);
  }

  const projectId = payload.project_info?.project_id;
  const appId = client.client_info?.mobilesdk_app_id;
  const apiKey = client.api_key?.[0]?.current_key;
  const webClientId = client.oauth_client?.find((item) => item.client_type === 3)?.client_id;
  if (!projectId || !appId || !apiKey) {
    throw new Error('[LOUSA Firebase] google-services.json is incomplete: project_id, mobilesdk_app_id or api_key is missing.');
  }

  return { projectId, appId, apiKey, webClientId: webClientId || '' };
}

module.exports = ({ config }) => {
  const buildVariant = process.env.LOUSA_BUILD_VARIANT === 'qa' ? 'qa' : 'production';
  const androidPackage =
    process.env.LOUSA_ANDROID_PACKAGE ||
    (buildVariant === 'qa' ? QA_ANDROID_PACKAGE : PRODUCTION_ANDROID_PACKAGE);
  if (![PRODUCTION_ANDROID_PACKAGE, QA_ANDROID_PACKAGE].includes(androidPackage)) {
    throw new Error(`[LOUSA Android] Unsupported package ${androidPackage}.`);
  }

  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON_PATH ||
    config.android?.googleServicesFile ||
    './google-services.json';
  const firebase = readFirebaseAndroidConfig(googleServicesFile, androidPackage);
  const androidMapsKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY_ANDROID ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ||
    '';
  const iosMapsKey =
    process.env.GOOGLE_MAPS_IOS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY_IOS ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS ||
    androidMapsKey;

  return {
    ...config,
    name: 'LOUSA MOON',
    version: '1.18.22',
    extra: {
      ...(config.extra || {}),
      firebaseProjectId: firebase.projectId,
      firebaseAppId: firebase.appId,
      firebaseWebClientId: firebase.webClientId,
      firebaseAndroidPackage: androidPackage,
      buildVariant,
      appMode: process.env.EXPO_PUBLIC_APP_MODE || 'api',
      authProvider: process.env.EXPO_PUBLIC_AUTH_PROVIDER || 'firebase',
      publicApiUrl: process.env.EXPO_PUBLIC_LOUSA_API_URL || '',
      firebaseAuthActionUrl: process.env.EXPO_PUBLIC_FIREBASE_AUTH_ACTION_URL || '',
      releaseBuild: process.env.EXPO_PUBLIC_RELEASE_BUILD === 'true',
      buildChannel: process.env.EXPO_PUBLIC_BUILD_CHANNEL || buildVariant,
    },
    scheme: Array.from(new Set([...(Array.isArray(config.scheme) ? config.scheme : [config.scheme].filter(Boolean)), androidPackage])),
    android: {
      ...config.android,
      package: androidPackage,
      versionCode: 133,
      googleServicesFile,
      config: {
        ...(config.android?.config || {}),
        googleMaps: androidMapsKey ? { apiKey: androidMapsKey } : undefined,
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: iosMapsKey || undefined,
      },
    },
  };
};
