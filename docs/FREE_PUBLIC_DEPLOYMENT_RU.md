# Бесплатный публичный запуск LOUSA MOON

Этот вариант рассчитан на тестовый запуск без оплаты. Он не заменяет production-инфраструктуру с SLA, резервными копиями и круглосуточным мониторингом.

## Архитектура

- API: Koyeb Free, контейнер из `Dockerfile`.
- PostgreSQL: Supabase Free.
- Redis: Upstash Free по TLS (`rediss://`).
- Авторизация и push: существующий Firebase-проект `lousa-moon`.
- Карта: OpenFreeMap без ключа; MapTiler можно подключить позже.
- APK: только HTTPS-адрес Koyeb, без локального IP.

## 1. Приватный GitHub-репозиторий

Создайте приватный пустой репозиторий `lousa-moon-private`. Не загружайте `.env`, Firebase service account, пароли Supabase/Upstash, ключи подписи Android и папку `secrets`.

## 2. Supabase

1. Создайте бесплатный проект: https://database.new
2. В `Connect` скопируйте Transaction pooler URL (порт `6543`) в `DATABASE_URL`.
3. Скопируйте Session pooler URL (порт `5432`) в `MIGRATION_DATABASE_URL`.
4. В паролях внутри URL экранируйте специальные символы как URL-encoding.

## 3. Upstash

1. Создайте бесплатную Redis-базу: https://console.upstash.com/redis
2. Скопируйте TLS URL, начинающийся с `rediss://`, в `REDIS_URL`.
3. Не используйте HTTP REST URL вместо Redis URL.

## 4. Firebase Admin

1. Firebase Console -> Project settings -> Service accounts.
2. Создайте новый private key.
3. В Koyeb добавьте весь JSON одним секретом `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Файл JSON нельзя добавлять в Git или APK.

## 5. Koyeb

1. Создайте Web Service из приватного GitHub-репозитория.
2. Builder: Dockerfile, порт `8080`, health check `/health`.
3. Добавьте переменные из `.env.production.example` как Secrets.
4. Сгенерируйте разные JWT-секреты командами `openssl rand -base64 48`.
5. После первого запуска откройте `https://SERVICE.koyeb.app/health` и проверьте `ok: true`.

Koyeb Free может засыпать при отсутствии запросов, поэтому первый запрос после паузы бывает медленнее.

## 6. Сборка APK

В локальном `.env` установите:

```dotenv
EXPO_PUBLIC_APP_MODE=api
EXPO_PUBLIC_AUTH_PROVIDER=firebase
EXPO_PUBLIC_LOUSA_API_URL=https://SERVICE.koyeb.app
PUBLIC_API_URL=https://SERVICE.koyeb.app
```

Проверьте конфигурацию и соберите QA APK:

```bash
APP_ENV=production npm run verify:env
npm run android:apk:qa
```

## Обязательные проверки

1. `/health` отвечает через мобильный интернет, а не только Wi-Fi.
2. Регистрация email и вход Google создают одну и ту же серверную сессию.
3. После перезапуска приложения сессия восстанавливается.
4. Созданные записи цикла остаются после перезапуска API.
5. В APK отсутствуют строки `localhost`, `192.168.*` и service-account private key.
6. В Firebase добавлены SHA-1/SHA-256 сертификата фактически установленной сборки.

## Ограничения бесплатного контура

- Нет гарантированного SLA.
- Бесплатный API может засыпать.
- Supabase может приостанавливать неактивный проект.
- Firebase Phone Auth/SMS не является полностью бесплатным.
- Перед реальным запуском нужны мониторинг, резервное копирование, политика хранения чувствительных данных и юридическая проверка обработки данных о цикле.
