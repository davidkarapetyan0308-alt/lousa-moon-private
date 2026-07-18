import type { ServiceError } from './contracts';

const USER_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.',
  GOOGLE_AUTH_NOT_CONFIGURED: 'Google-вход не настроен для этой сборки. Проверьте OAuth client ID, package name и SHA-1.',
  GOOGLE_TOKEN_INVALID: 'Не удалось подтвердить Google-аккаунт на сервере.',
  GOOGLE_TOKEN_REQUIRED: 'Google не вернул токен входа. Попробуйте ещё раз.',
  PHONE_INVALID: 'Введите номер телефона в международном формате, например +374XXXXXXXX.',
  SMS_PROVIDER_REQUIRED: 'SMS-вход не настроен для этой сборки. Используйте email или настройте SMS_PROVIDER.',
  SMS_DELIVERY_FAILED: 'Не удалось отправить SMS-код. Попробуйте позже.',
  INVALID_PHONE_OTP: 'SMS-код неверный или истёк.',
  OTP_ATTEMPTS_EXCEEDED: 'Слишком много попыток. Запросите новый код позже.',
  UNKNOWN_ERROR: 'Что-то пошло не так. Попробуйте ещё раз.',
  EMAIL_DELIVERY_FAILED: 'Не удалось отправить письмо. Попробуйте позже или проверьте настройки email-сервиса.',
  EMAIL_PROVIDER_NOT_CONFIGURED: 'Email-отправка пока не настроена. В dev-режиме код выводится в консоль backend API.',
  EMAIL_EXISTS: 'Пользователь с такой почтой уже существует. Войдите или восстановите пароль.',
  INVALID_EMAIL: 'Введите корректный email.',
  INVALID_CREDENTIALS: 'Почта или пароль указаны неверно.',
  INVALID_OTP: 'Код неверный или истёк.',
  OTP_EXPIRED: 'Код истёк. Запросите новый код.',
  RATE_LIMITED: 'Слишком много попыток. Подождите немного и попробуйте снова.',
  MAP_PROVIDER_UNAVAILABLE: 'Карта временно недоступна. Вы можете ввести адрес вручную.',
  ADDRESS_OUT_OF_ZONE: 'Этот адрес пока вне зоны доставки LOUSA.',
  AUTH_SESSION_EXPIRED: 'Сессия истекла. Войдите снова.',
  MISSING_API_URL: 'Не указан адрес backend API. Для теста на телефоне используйте IP компьютера или HTTPS-сервер.',
  LOCALHOST_API_FORBIDDEN: 'На Android localhost не работает как адрес backend. Используйте IP компьютера или HTTPS API.',
  INSECURE_RELEASE_API: 'Production-сборка LOUSA подключается только к защищённому HTTPS backend API.',
  MAP_PROVIDER_NOT_CONFIGURED: 'Карта не настроена для этой сборки. Введите адрес вручную.',
  MAP_DEMO_STYLE_FORBIDDEN: 'Demo-карта запрещена для LOUSA. Настройте MapTiler или фирменный style URL.',
  FIREBASE_AUTH_NOT_CONFIGURED: 'Firebase Auth не настроен для этой сборки. Добавьте google-services.json, Firebase project config и пересоберите APK.',
  FIREBASE_NATIVE_SDK_MISSING: 'Firebase SDK не входит в эту сборку. Нужен dev/release APK, Expo Go не подойдёт.',
  FIREBASE_ADMIN_NOT_CONFIGURED: 'Backend не может проверить Firebase token. Настройте Firebase Admin service account.',
  FIREBASE_ID_TOKEN_INVALID: 'Firebase-сессия не подтверждена. Войдите снова.',
  FIREBASE_ID_TOKEN_REQUIRED: 'Firebase token не был передан на backend.',
  FIREBASE_EMAIL_NOT_VERIFIED: 'Подтвердите email по ссылке из письма Firebase, затем вернитесь в приложение.',
  FIREBASE_EMAIL_VERIFICATION_SEND_FAILED: 'Не удалось отправить письмо подтверждения Firebase. Попробуйте позже.',
  FIREBASE_USER_MISSING: 'Сессия регистрации не найдена. Войдите снова.',
  FIREBASE_DEVELOPER_ERROR: 'Google-вход отклонён из-за несовпадения package name или SHA-1/SHA-256 этой APK.',
  LEGACY_AUTH_DISABLED: 'Старая авторизация отключена. Используйте Firebase Auth.',
  LEGACY_AUTH_FORBIDDEN: 'Release-сборка не может использовать старую авторизацию.',
  FIREBASE_EMAIL_SIGNUP_FAILED: 'Не удалось создать аккаунт через Firebase. Проверьте настройки Email/Password provider.',
  FIREBASE_EMAIL_ALREADY_IN_USE: 'Аккаунт с такой электронной почтой уже существует. Войдите в существующий аккаунт.',
  FIREBASE_EMAIL_SIGNIN_FAILED: 'Не удалось войти через Firebase. Проверьте почту и пароль.',
  FIREBASE_GOOGLE_SIGNIN_FAILED: 'Не удалось войти через Google через Firebase. Проверьте Google provider и SHA-1/SHA-256.',
  FIREBASE_PHONE_START_FAILED: 'Не удалось отправить SMS через Firebase. Проверьте Phone provider и SMS region policy.',
  FIREBASE_PHONE_UNAVAILABLE: 'Вход по номеру пока недоступен в вашем регионе. Используйте email или попробуйте позже.',
  FIREBASE_PHONE_RATE_LIMITED: 'Слишком много запросов SMS. Подождите немного и попробуйте снова.',
  FIREBASE_PHONE_INVALID_NUMBER: 'Проверьте номер телефона и введите его в международном формате, например +374XXXXXXXX.',
  FIREBASE_OPERATION_NOT_ALLOWED: 'Этот способ входа пока не включён в Firebase. Используйте другой способ входа.',
  FIREBASE_TOO_MANY_REQUESTS: 'Слишком много попыток. Подождите немного и попробуйте снова.',
  FIREBASE_PHONE_VERIFY_FAILED: 'SMS-код Firebase неверный или истёк.',
  FIREBASE_PHONE_CONFIRMATION_MISSING: 'Сначала запросите SMS-код ещё раз.',
  FIREBASE_PASSWORD_RESET_LINK_REQUIRED: 'Firebase отправляет ссылку восстановления на почту. Откройте письмо и задайте новый пароль.',
};

export function getUserFacingErrorMessage(
  error: Pick<ServiceError, 'code' | 'message'> | null | undefined,
  fallback = 'Что-то пошло не так. Попробуйте ещё раз.',
) {
  if (!error) return fallback;
  if (USER_MESSAGES[error.code]) return USER_MESSAGES[error.code];

  const message = (error.message || '').trim();
  const blockedFragments = [
    'Network request failed',
    'TypeError',
    'undefined',
    'null',
    'EXPO_PUBLIC_LOUSA_API_URL',
    '500',
    'stack',
  ];
  if (!message || blockedFragments.some((fragment) => message.includes(fragment))) {
    return fallback;
  }

  return message;
}

export function isProviderSetupError(code?: string) {
  return code === 'EMAIL_PROVIDER_NOT_CONFIGURED' || code === 'EMAIL_DELIVERY_FAILED';
}
