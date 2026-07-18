# LOUSA API Sandbox

Это реально запускаемый локальный HTTP API для разработки мобильного приложения.

Он использует память процесса и тестовые данные. После перезапуска данные исчезают.
Это **не production backend** и не заменяет PostgreSQL, Redis, очередь задач, полноценную авторизацию, webhook платежей и аудит.

Запуск из корня проекта:

```bash
npm run api:dev
```

Демо-вход:

- `demo@lousa.app`
- `Lousa2026`

Health check:

```text
GET http://localhost:4100/health
```
