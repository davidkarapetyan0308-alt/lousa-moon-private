import type { ServiceError } from './contracts';

const USER_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.',
  SERVER_ERROR: 'Не удалось войти. Попробуйте ещё раз через минуту.',
  BACKEND_READY_TIMEOUT: 'Сервис временно недоступен. Данные на телефоне сохранены — попробуйте ещё раз позже.',
  BACKEND_NOT_READY: 'Сервис временно недоступен. Данные на телефоне сохранены.',
  BACKEND_SESSION_TIMEOUT: 'Вход подтверждён, но сервис не ответил вовремя. Повторите попытку — выбирать аккаунт заново не нужно.',
  GOOGLE_DEVELOPER_ERROR: 'Вход через Google временно недоступен. Используйте другой способ или попробуйте позже.',
  AUTH_DATABASE_UNAVAILABLE: 'Вход временно недоступен. Попробуйте ещё раз через минуту.',
  AUTH_ACCOUNT_LINK_REQUIRED: 'Аккаунт с этой почтой уже существует. Войдите прежним способом, затем привяжите Google в настройках аккаунта.',
  GOOGLE_AUTH_NOT_CONFIGURED: 'Вход через Google временно недоступен. Используйте другой способ входа.',
  GOOGLE_TOKEN_INVALID: 'Не удалось подтвердить Google-аккаунт. Попробуйте ещё раз.',
  GOOGLE_TOKEN_REQUIRED: 'Google не вернул токен входа. Попробуйте ещё раз.',
  PHONE_INVALID: 'Введите номер телефона в международном формате, например +374XXXXXXXX.',
  SMS_PROVIDER_REQUIRED: 'Вход по номеру сейчас недоступен. Используйте email или попробуйте позже.',
  SMS_DELIVERY_FAILED: 'Не удалось отправить SMS-код. Попробуйте позже.',
  INVALID_PHONE_OTP: 'SMS-код неверный или истёк.',
  OTP_ATTEMPTS_EXCEEDED: 'Слишком много попыток. Запросите новый код позже.',
  UNKNOWN_ERROR: 'Что-то пошло не так. Попробуйте ещё раз.',
  EMAIL_DELIVERY_FAILED: 'Не удалось отправить письмо. Попробуйте позже или проверьте настройки email-сервиса.',
  EMAIL_PROVIDER_NOT_CONFIGURED: 'Отправка писем временно недоступна. Используйте другой способ входа или попробуйте позже.',
  EMAIL_EXISTS: 'Пользователь с такой почтой уже существует. Войдите или восстановите пароль.',
  INVALID_EMAIL: 'Введите корректный email.',
  INVALID_CREDENTIALS: 'Почта или пароль указаны неверно.',
  INVALID_OTP: 'Код неверный или истёк.',
  OTP_EXPIRED: 'Код истёк. Запросите новый код.',
  RATE_LIMITED: 'Слишком много попыток. Подождите немного и попробуйте снова.',
  MAP_PROVIDER_UNAVAILABLE: 'Карта временно недоступна. Вы можете ввести адрес вручную.',
  ADDRESS_OUT_OF_ZONE: 'Этот адрес пока вне зоны доставки LOUSA.',
  AUTH_SESSION_EXPIRED: 'Сессия истекла. Войдите снова.',
  GUEST_ACCOUNT_REQUIRED: 'Для этой функции нужен аккаунт LOUSA. Локальные данные гостя останутся на устройстве.',
  MISSING_API_URL: 'Сервис временно недоступен. Данные на телефоне сохранены.',
  LOCALHOST_API_FORBIDDEN: 'Сервис временно недоступен. Данные на телефоне сохранены.',
  INSECURE_RELEASE_API: 'Не удалось подключиться к сервису. Проверьте интернет и попробуйте ещё раз.',
  MAP_PROVIDER_NOT_CONFIGURED: 'Карта временно недоступна. Введите адрес вручную.',
  MAP_DEMO_STYLE_FORBIDDEN: 'Карта временно недоступна. Введите адрес вручную.',
  FIREBASE_AUTH_NOT_CONFIGURED: 'Этот способ входа временно недоступен. Используйте другой способ.',
  FIREBASE_NATIVE_SDK_MISSING: 'Этот способ входа недоступен в текущей версии приложения.',
  FIREBASE_ADMIN_NOT_CONFIGURED: 'Вход временно недоступен на сервере. Закройте приложение и попробуйте ещё раз.',
  FIREBASE_AUTH_BACKEND_UNAVAILABLE: 'Вход временно недоступен на сервере. Закройте приложение и попробуйте ещё раз.',
  FIREBASE_ID_TOKEN_INVALID: 'Сессия не подтверждена. Войдите снова.',
  FIREBASE_ID_TOKEN_REQUIRED: 'Не удалось подтвердить сессию. Войдите снова.',
  FIREBASE_EMAIL_NOT_VERIFIED: 'Подтвердите email по ссылке из письма, затем вернитесь в приложение.',
  FIREBASE_EMAIL_VERIFICATION_SEND_FAILED: 'Не удалось отправить письмо подтверждения. Попробуйте позже.',
  FIREBASE_USER_MISSING: 'Сессия регистрации не найдена. Войдите снова.',
  FIREBASE_DEVELOPER_ERROR: 'Вход через Google временно недоступен. Используйте другой способ.',
  LEGACY_AUTH_DISABLED: 'Этот способ входа больше не поддерживается. Используйте доступный вариант.',
  LEGACY_AUTH_FORBIDDEN: 'Этот способ входа больше не поддерживается.',
  FIREBASE_EMAIL_SIGNUP_FAILED: 'Не удалось создать аккаунт. Попробуйте ещё раз или используйте другой способ.',
  FIREBASE_EMAIL_ALREADY_IN_USE: 'Аккаунт с такой электронной почтой уже существует. Войдите в существующий аккаунт.',
  FIREBASE_EMAIL_SIGNIN_FAILED: 'Не удалось войти. Проверьте почту и пароль.',
  FIREBASE_GOOGLE_SIGNIN_FAILED: 'Не удалось войти через Google. Попробуйте ещё раз или используйте другой способ.',
  FIREBASE_OPERATION_TIMEOUT: 'Сервис не ответил вовремя. Проверьте интернет и попробуйте ещё раз.',
  FIREBASE_PHONE_START_FAILED: 'Не удалось отправить SMS. Попробуйте позже или используйте другой способ входа.',
  FIREBASE_PHONE_UNAVAILABLE: 'Вход по номеру пока недоступен в вашем регионе. Используйте email или попробуйте позже.',
  FIREBASE_PHONE_RATE_LIMITED: 'Слишком много запросов SMS. Подождите немного и попробуйте снова.',
  FIREBASE_PHONE_INVALID_NUMBER: 'Проверьте номер телефона и введите его в международном формате, например +374XXXXXXXX.',
  FIREBASE_OPERATION_NOT_ALLOWED: 'Этот способ входа сейчас недоступен. Используйте другой способ.',
  FIREBASE_TOO_MANY_REQUESTS: 'Слишком много попыток. Подождите немного и попробуйте снова.',
  FIREBASE_PHONE_VERIFY_FAILED: 'SMS-код неверный или истёк.',
  FIREBASE_PHONE_CONFIRMATION_MISSING: 'Сначала запросите SMS-код ещё раз.',
  FIREBASE_PASSWORD_RESET_LINK_REQUIRED: 'Ссылка восстановления отправлена на почту. Откройте письмо и задайте новый пароль.',
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
