# Бесплатный публичный запуск LOUSA MOON

Этот контур предназначен для тестового запуска без оплаты. Он не заменяет production-инфраструктуру с SLA, резервными копиями и круглосуточным мониторингом.

## Архитектура

- API: Render Free, Docker-образ из `Dockerfile`.
- PostgreSQL: Supabase Free.
- Redis: Upstash Free по TLS (`rediss://`).
- Авторизация и push: Firebase-проект `lousa-moon`.
- Карта: OpenFreeMap без ключа; MapTiler можно подключить позже.
- APK: публичный HTTPS-адрес Render, без `localhost` и локального IP.

## 1. GitHub

Исходный код размещается в приватном репозитории. В Git нельзя добавлять `.env`, Firebase service account, пароли Supabase/Upstash, Android keystore и папку `secrets`.

## 2. Supabase

1. Создайте бесплатный проект: https://database.new
2. В разделе `Connect` скопируйте Transaction pooler URL с портом `6543` в `DATABASE_URL`.
3. Скопируйте Session pooler URL с портом `5432` в `MIGRATION_DATABASE_URL`.
4. Специальные символы пароля внутри URL должны быть URL-encoded.

## 3. Upstash

1. Создайте бесплатную Redis-базу: https://console.upstash.com/redis
2. Скопируйте TLS URL, начинающийся с `rediss://`, в `REDIS_URL`.
3. Не используйте HTTP REST URL вместо Redis URL.

## 4. Firebase Admin

1. Откройте Firebase Console -> Project settings -> Service accounts.
2. Создайте новый private key.
3. В Render передайте весь JSON одним секретом `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. Файл JSON нельзя добавлять в Git или APK.

## 5. Render

1. Откройте Blueprint по адресу:
   `https://render.com/deploy?repo=https://github.com/davidkarapetyan0308-alt/lousa-moon-private`
2. Войдите через GitHub и разрешите Render доступ только к репозиторию `lousa-moon-private`.
3. Blueprint прочитает `render.yaml` и создаст бесплатный Web Service `lousa-moon-api` во Франкфурте.
4. Заполните три секретных значения: `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `REDIS_URL` и JSON `FIREBASE_SERVICE_ACCOUNT_JSON`.
5. JWT-секреты Render создаст автоматически.
6. После запуска откройте `https://ИМЯ-СЕРВИСА.onrender.com/health` и проверьте `ok: true`.

Render автоматически задаёт `RENDER_EXTERNAL_HOSTNAME`; API преобразует его в публичный HTTPS URL. Поэтому `PUBLIC_API_URL` в Render вручную добавлять не нужно.

## 6. Сборка APK

В локальном `.env` установите:

```dotenv
EXPO_PUBLIC_APP_MODE=api
EXPO_PUBLIC_AUTH_PROVIDER=firebase
EXPO_PUBLIC_LOUSA_API_URL=https://ИМЯ-СЕРВИСА.onrender.com
PUBLIC_API_URL=https://ИМЯ-СЕРВИСА.onrender.com
```

Проверьте конфигурацию и соберите QA APK:

```bash
APP_ENV=production npm run verify:env
npm run android:apk:qa
```

## Обязательные проверки

1. `/health` отвечает через мобильный интернет, а не только Wi-Fi.
2. Регистрация email и вход Google создают серверную сессию.
3. После перезапуска приложения сессия восстанавливается.
4. Записи цикла остаются после перезапуска API.
5. В APK отсутствуют `localhost`, `192.168.*` и service-account private key.
6. В Firebase добавлены SHA-1/SHA-256 сертификата установленной сборки.

## Ограничения бесплатного контура

- Render Free засыпает после 15 минут без запросов; первый запрос после сна может занять около минуты.
- Бесплатный контур не гарантирует SLA.
- Supabase может приостанавливать неактивный проект.
- Firebase Phone Auth/SMS не является полностью бесплатным.
- Перед реальным запуском нужны мониторинг, резервные копии и юридическая проверка обработки данных о цикле.
