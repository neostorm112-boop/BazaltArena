# Basalt Arena

Платформа для разработчиков: каждый спринт — это задача из реального прода, открытое соревнование и приз победителю. Монорепозиторий содержит три приложения и общий BFF.

---

## Содержание

- [Что такое Basalt Arena](#что-такое-basalt-arena)
- [Структура репозитория](#структура-репозитория)
- [Технологический стек](#технологический-стек)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [Скрипты](#скрипты)
- [Архитектура](#архитектура)
- [Страницы клиента](#страницы-клиента)
- [Страницы админки](#страницы-админки)
- [BFF: маршруты и сервисы](#bff-маршруты-и-сервисы)
- [База данных](#база-данных)
- [Тесты](#тесты)
- [Деплой на сервер (Ubuntu / Lightsail)](#деплой-на-сервер-ubuntu--lightsail)
- [Обновление сервера после коммита](#обновление-сервера-после-коммита)
- [Синхронизация БД локально → сервер](#синхронизация-бд-локально--сервер)
- [Частые проблемы](#частые-проблемы)
- [DX: форматирование, линт, pre-commit](#dx-форматирование-линт-pre-commit)

---

## Что такое Basalt Arena

**Basalt Arena** — закрытая площадка для разработчиков. Администратор запускает спринт с задачей из реального прода, участники присылают решения, наставник принимает лучшее — его автор получает деньги и ачивки. Все решения публикуются, чтобы каждый мог учиться.

**Роли:**

- `ADMIN` — управляет спринтами, пользователями, ачивками, решениями.
- `USER` — участвует в спринтах, отправляет решения, ставит лайки.

---

## Структура репозитория

```
basalt-arena/
├── client/          # Публичная арена (React + Vite) — порт 5173
│   └── src/
│       ├── pages/   # Страницы: MainScreen, HallOfFame, Profile, Login, Docs
│       ├── components/
│       ├── auth/    # AuthProvider, ProtectedRoute
│       ├── api/     # basaltApi.js — обёртки над fetch
│       └── realtime/ # SocketSync.jsx — подписка на socket.io
│
├── admin/           # Панель администратора (React + Vite) — порт 5174 / :8080 на проде
│   └── src/
│       ├── pages/   # Страницы: Dashboard, Users, Sprints, Access, Submissions, Achievements, Logs
│       ├── components/ui/  # Button, Input, Sheet, ConfirmDialog, …
│       └── realtime/ # AdminSocketSync.jsx
│
├── bff/             # Backend-For-Frontend (Express + TypeScript) — порт 3001
│   ├── src/
│   │   ├── routes/       # Точки входа HTTP
│   │   ├── services/     # Бизнес-логика
│   │   ├── repositories/ # Prisma-запросы
│   │   ├── middleware/    # Auth, rate-limit, логирование, ошибки
│   │   ├── realtime/     # Socket.io — события арены
│   │   └── config/       # env.ts — валидация переменных при старте
│   ├── prisma/
│   │   ├── schema.prisma # Схема БД
│   │   ├── migrations/   # История миграций
│   │   └── seed.ts       # Начальные данные (admin + demo)
│   ├── openapi/
│   │   └── openapi.yaml  # OpenAPI 3.0 спецификация
│   ├── docs/
│   │   ├── adr-001-api-contract.md
│   │   ├── adr-002-auth-and-persistence.md
│   │   └── adr-003-sprint-access-and-admin.md
│   └── test/
│       ├── unit/         # Без Docker — быстрые
│       └── integration/  # testcontainers, нужен Docker
│
├── shared/          # Общие TypeScript-типы (client + bff)
│   └── types/
│
├── server/          # Legacy mock-сервер (не используется в основном флоу)
├── deploy/          # Скрипты деплоя и синхронизации БД
├── docker-compose.yml  # Postgres (5433) + Redis (6379)
├── .env.example
└── package.json     # Workspaces: client, admin, bff, server, shared
```

---

## Технологический стек

| Слой             | Технология                                                                              |
| ---------------- | --------------------------------------------------------------------------------------- |
| Клиент и Админка | React 18, Vite, TailwindCSS v4, React Query, React Router v6                            |
| BFF              | Node.js ≥20, Express 5, TypeScript, Prisma ORM, Pino (логи), Zod (валидация), socket.io |
| БД               | PostgreSQL 16 (схема `bff`), Redis 7                                                    |
| Инфраструктура   | Docker Compose (локально), systemd + nginx (сервер)                                     |
| Качество кода    | ESLint, Prettier, Husky + lint-staged, Vitest                                           |

---

## Быстрый старт

> **Требования:** Node.js ≥ 20, npm ≥ 10, Docker (для Postgres + Redis).

```bash
# 1. Клонировать
git clone https://github.com/neostorm112-boop/BazaltArena.git
cd BazaltArena

# 2. Установить зависимости и создать .env из примера
npm run setup
# Если .env уже есть — просто npm install && npm run prisma:generate -w bff

# 3. Поднять Postgres (порт 5433) и Redis (порт 6379)
docker compose up -d

# 4. Применить миграции БД + создать начальные данные
npm run db:migrate
npm run db:seed

# 5. Запустить всё (клиент + BFF + админка)
npm run dev:all
```

| Что            | URL                                 |
| -------------- | ----------------------------------- |
| Арена (клиент) | http://localhost:5173               |
| Админка        | http://localhost:5174               |
| BFF Health     | http://localhost:3001/api/v1/health |

**Логин по умолчанию после сида:**

| Роль      | Email             | Пароль                                                              |
| --------- | ----------------- | ------------------------------------------------------------------- |
| Admin     | admin@admin.com   | значение `SEED_ADMIN_PASSWORD` из `.env` (по умолчанию `admin1234`) |
| Demo user | demo@basalt.arena | значение `SEED_DEMO_PASSWORD` (по умолчанию `demo1234`)             |

---

## Переменные окружения

Полный список и комментарии в **[`.env.example`](.env.example)**. `npm run setup` копирует его в `.env` и `bff/.env`, если они ещё не существуют.

### Обязательные в production

| Переменная           | Описание                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Строка подключения Postgres. Локально: `postgresql://basalt:basalt@127.0.0.1:5433/basalt?schema=bff` |
| `REDIS_URL`          | Строка подключения Redis. Локально: `redis://127.0.0.1:6379`                                         |
| `JWT_ACCESS_SECRET`  | Секрет для access-токена, **≥ 32 символов**                                                          |
| `JWT_REFRESH_SECRET` | Секрет для refresh-токена, **≥ 32 символов** (отличается от access!)                                 |
| `CORS_ORIGINS`       | Разрешённые origins через запятую, например `http://52.76.208.250,http://52.76.208.250:8080`         |

### Необязательные

| Переменная                | По умолчанию  | Описание                                                                                                 |
| ------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| `PORT`                    | `3001`        | Порт BFF                                                                                                 |
| `NODE_ENV`                | `development` | `production` отключает dev-хелперы                                                                       |
| `LOG_LEVEL`               | `info`        | `fatal \| error \| warn \| info \| debug \| trace \| silent`                                             |
| `JWT_ACCESS_TTL_SECONDS`  | `900`         | Время жизни access-токена (15 мин)                                                                       |
| `JWT_REFRESH_TTL_SECONDS` | `2592000`     | Время жизни refresh-токена (30 дней)                                                                     |
| `DEV_REGISTER_KEY`        | —             | Если задан — самостоятельная регистрация требует заголовок `x-dev-register-key`                          |
| `RATE_LIMIT_DISABLED`     | `false`       | Только не-production; отключить rate-limit на dev                                                        |
| `MOCK_API_ENABLED`        | `true`        | Слой совместимости `/api/mock/v1` для внешнего конкурсного фронта; `false` — отключить                   |
| `VITE_API_BASE_URL`       | —             | Если пусто — Vite использует прокси `/api/v1` → `localhost:3001`. Задайте для указания на внешний сервер |
| `SEED_ADMIN_PASSWORD`     | `admin1234`   | Пароль admin-аккаунта при сиде                                                                           |
| `SEED_DEMO_PASSWORD`      | `demo1234`    | Пароль demo-аккаунта при сиде                                                                            |

---

## Скрипты

### Корень монорепо

| Команда                      | Что делает                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run setup`              | Копирует `.env.example` → `.env` и `bff/.env` (если нет), ставит зависимости, генерирует Prisma Client |
| `npm run db:migrate`         | `prisma migrate deploy` + нормализует enum `UserRole` в Postgres                                       |
| `npm run db:normalize-roles` | Только нормализация `UserRole` (если migrate уже был)                                                  |
| `npm run db:seed`            | Заполняет БД начальными данными (admin, demo, ачивки)                                                  |
| `npm run dev`                | Клиент + BFF                                                                                           |
| `npm run dev:all`            | Клиент + BFF + Админка                                                                                 |
| `npm run dev:mock`           | Клиент + legacy mock-сервер                                                                            |
| `npm run build:all`          | Сборка BFF → `bff/dist/`, клиента → `client/dist/`, админки → `admin/dist/`                            |
| `npm run build:client`       | Только клиент                                                                                          |
| `npm run build:admin`        | Только админка                                                                                         |
| `npm run build:bff`          | Только BFF                                                                                             |
| `npm run start`              | Запуск BFF из собранного `bff/dist/index.js`                                                           |
| `npm run test`               | Unit-тесты BFF (без Docker)                                                                            |
| `npm run test:integration`   | Integration-тесты BFF (нужен Docker)                                                                   |
| `npm run verify`             | Prettier check + ESLint + typecheck + unit-тесты                                                       |
| `npm run format`             | Авто-форматирование всего монорепо                                                                     |
| `npm run lint`               | ESLint для `bff`, `client`, `admin`                                                                    |

### Только `bff/`

| Команда                    | Что делает                                                |
| -------------------------- | --------------------------------------------------------- |
| `npm run dev`              | `tsx watch` — горячая перезагрузка                        |
| `npm run build`            | `tsc` → `dist/`                                           |
| `npm run db:migrate:dev`   | Создать новую миграцию в разработке (интерактивный режим) |
| `npm run test:unit`        | Unit-тесты                                                |
| `npm run test:integration` | Integration-тесты (testcontainers)                        |

---

## Архитектура

```
Браузер
  │
  ├── client (React, :5173 dev / :80 prod)
  │     └── /api/v1/* ──────────────────┐
  │                                      │
  └── admin  (React, :5174 dev / :8080 prod)
        └── /api/v1/* ──────────────────┤
                                         ▼
                                   BFF (Express, :3001)
                                    │         │
                             Postgres      Redis
                          (Prisma, :5433)  (:6379)
```

**Слои BFF:**

```
routes/ → middleware (auth, validate) → services/ → repositories/ → Prisma → Postgres
                                      ↘ Redis (сессии, rate-limit)
                                      ↘ realtime/ (socket.io → клиенту)
```

- **`routes/`** — только роутинг и маппинг HTTP ↔ сервис.
- **`services/`** — вся бизнес-логика без деталей хранилища.
- **`repositories/`** — Prisma-запросы, никакой логики.
- **`middleware/`** — JWT-аутентификация, Zod-валидация, rate-limit, единый обработчик ошибок.
- **`realtime/`** — socket.io: события `sprint:update`, `submission:new`, `like:update`, уведомления.
- **`config/env.ts`** — парсит и валидирует все env-переменные при старте; если что-то не так — процесс падает сразу.

**Единый формат ошибок:**

```json
{
  "code": "UNAUTHORIZED",
  "message": "Токен недействителен",
  "requestId": "a1b2c3d4"
}
```

---

## Страницы клиента

| Путь       | Страница            | Что делает                                                               |
| ---------- | ------------------- | ------------------------------------------------------------------------ |
| `/`        | **Активный спринт** | Таймер, описание задачи, форма отправки решения, лента решений с лайками |
| `/hall`    | **Зал славы**       | Рейтинг участников по баллам, победители прошлых спринтов                |
| `/profile` | **Профиль**         | Статистика, ачивки, история спринтов пользователя                        |
| `/docs`    | **Документация**    | Правила арены, как участвовать                                           |
| `/login`   | **Вход**            | Форма авторизации. Аккаунты только через администратора                  |

---

## Страницы админки

| Путь            | Страница         | Что делает                                                                                                                              |
| --------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | **Dashboard**    | Статистика: участников, решений, активный спринт, график активности                                                                     |
| `/users`        | **Пользователи** | Список, поиск, редактирование профиля, смена роли и пароля                                                                              |
| `/sprints`      | **Спринты**      | Создание и редактирование спринтов: дедлайн, задача, ресурсы, статус (запланирован / арена / завершён / архив). Прогресс-бар по времени |
| `/access`       | **Доступы**      | Управление списком допущенных к арене участников                                                                                        |
| `/submissions`  | **Решения**      | Просмотр всех сданных решений, статусы, принять/отклонить, ссылки                                                                       |
| `/achievements` | **Ачивки**       | Конструктор ачивок: иконка, название, описание. Массовая выдача по спринту                                                              |
| `/logs`         | **Логи**         | Аудит-лог действий администратора                                                                                                       |

---

## BFF: маршруты и сервисы

### Маршруты (`bff/src/routes/`)

| Файл                   | Prefix               | Описание                                                   |
| ---------------------- | -------------------- | ---------------------------------------------------------- |
| `auth.routes.ts`       | `/api/v1/auth`       | Вход, выход, refresh токена                                |
| `me.routes.ts`         | `/api/v1/me`         | Профиль текущего пользователя, уведомления                 |
| `sprint.routes.ts`     | `/api/v1/sprint`     | Активный спринт, задача, таймер                            |
| `submission.routes.ts` | `/api/v1/submission` | Отправка и просмотр решений, лайки                         |
| `hall.routes.ts`       | `/api/v1/hall`       | Публичный зал славы                                        |
| `meta.routes.ts`       | `/api/v1/meta`       | Публичные мета-данные (тизер спринта, маркетинг)           |
| `admin.routes.ts`      | `/api/v1/admin`      | Все CRUD-операции для админки (требует роль ADMIN)         |
| `mock.routes.ts`       | `/api/mock/v1`       | Слой совместимости с внешним конкурсным фронтом (см. ниже) |

### Сервисы (`bff/src/services/`)

| Файл                           | Что делает                                               |
| ------------------------------ | -------------------------------------------------------- |
| `authService.ts`               | Логин, logout, refresh, хеши паролей (bcrypt)            |
| `tokenService.ts`              | Создание и верификация JWT access/refresh                |
| `sessionStore.ts`              | Хранение refresh-токенов в Redis                         |
| `adminService.ts`              | CRUD пользователей, спринтов, доступов                   |
| `submissionService.ts`         | Приём решений, статусы, подсчёт баллов; триггеры granter |
| `likeService.ts`               | Лайки на решения с дедупликацией; триггер granter        |
| `sprintMetricsService.ts`      | Метрики активности по спринту                            |
| `achievementGranter.ts`        | Автовыдача ачивок по событиям (см. ниже)                 |
| `hallService.ts`               | Агрегация рейтинга для зала славы                        |
| `hallPublicFilter.ts`          | Фильтр и сортировка спринтов в публичном зале славы      |
| `metaService.ts`               | Публичные мета-данные (тизер спринта, маркетинг)         |
| `memberNotificationService.ts` | Создание уведомлений участникам                          |
| `profileService.ts`            | Профиль, история, ачивки пользователя                    |

---

## Совместимость с конкурсным фронтом (`/api/mock/v1`)

Бэкенд обслуживает **два фронта одновременно**, одной кодовой базой:

- `/api/v1/*` — собственный фронт и админка этого репозитория.
- `/api/mock/v1/*` — **слой-адаптер** (`bff/src/routes/mock.routes.ts`), который повторяет контракт исходного конкурсного фронта [UsmanGamidov/Basalt-Arena](https://github.com/UsmanGamidov/Basalt-Arena). Благодаря ему **неизменённый** оригинальный фронт заводится на этом бэке: вход, спринты, зал славы, профиль, отправка решений, лайки.

Адаптер переиспользует те же сервисы и middleware (auth, rate-limit, валидация), переводя ответы в формат, который читает оригинальный `client/src/api/basaltApi.js` (`normalizeMeFromV2`). Внутри:

- `/api/mock/v1/auth/*` — вход (`loginOrEmail` + один `accessToken`), регистрация (гейт по `x-dev-register-key`), выход.
- `/api/mock/v1/v2/*` — `meta`, `me`, `me/sprints`, `sprints`, `sprints/:id`, `sprints/:id/solutions` (голый массив), `submissions`, `submissions/active`, удаление, `solutions/:id/like` (toggle), профиль, уведомления.

Маппинг статусов решения: `PENDING/REVIEWED → pending_review`, `ACCEPTED → approved`, `REJECTED → deleted_by_admin`, отзыв пользователем → `deleted_by_user`.

**Включение:** адаптер смонтирован во всех окружениях по умолчанию; отключается переменной `MOCK_API_ENABLED=false`.

**Демо-доступы** (после `db:seed`): участник `demo@basalt.arena` / `demo1234`, админ `admin@admin.com` / `admin1234`.

> Покрыт golden path (пользовательские сценарии). Админ-контракт оригинала (`/api/mock/v1/admin/*`) пока не реализован — собственная админка работает через `/api/v1/admin`.

---

## Система ачивок

Ачивки делятся на **автоматические** (выдаются сервисом `achievementGranter` по событиям) и **кастомные** (создаются и выдаются администратором вручную через `/achievements` в админке).

### Автоматические ачивки

| Slug               | Название         | Триггер                    | Условие                                                              |
| ------------------ | ---------------- | -------------------------- | -------------------------------------------------------------------- |
| `first_submission` | Первый шаг       | `onSubmissionUpsert`       | Первый сабмишн пользователя за всю историю                           |
| `first_accepted`   | Принято          | `onSubmissionStatusChange` | Первое решение в статусе `ACCEPTED`                                  |
| `score_100`        | Сотка            | `onSubmissionStatusChange` | Принятое решение с `mentorScore ≥ 100`                               |
| `sprint_winner`    | Чемпион спринта  | `onSubmissionStatusChange` | Лучшее принятое решение в спринте (order: score → likes → createdAt) |
| `popular_solution` | Народный любимец | `onLikesChanged`           | Решение собрало 25+ лайков                                           |

`achievementGranter` подключается через `container.ts` и вызывается из `submissionService` (создание / смена статуса) и `likeService` (изменение счётчика лайков). Повторные выдачи защищены `upsert` по составному ключу `userId + achievementId`.

### Кастомные ачивки

Создаются на странице `/achievements` в админке: иконка из Material Icons, slug, название, описание. Выдаются конкретному пользователю или пакетно — всем участникам выбранного спринта.

> На production-сервере при первом деплое granter'а нужно один раз создать записи Achievement с slug'ами из таблицы выше. Полный `npm run db:seed` может упасть из-за уникального ограничения `Sprint.active` — используйте точечный upsert (см. `bff/prisma/seed.ts`, массив `AUTO_ACHIEVEMENTS`).

---

## База данных

Схема Prisma — **[`bff/prisma/schema.prisma`](bff/prisma/schema.prisma)**.
Миграции — **[`bff/prisma/migrations/`](bff/prisma/migrations/)**.

**Основные модели:**

| Модель            | Описание                                                      |
| ----------------- | ------------------------------------------------------------- |
| `User`            | Участник: handle, email, роль (`ADMIN`/`USER`), баллы, аватар |
| `Sprint`          | Спринт: название, задача, даты, статус (active, archived)     |
| `Submission`      | Решение: ссылка, статус, баллы, автор, спринт                 |
| `Like`            | Лайк решения (уникален по user + submission)                  |
| `Achievement`     | Описание ачивки: иконка, название                             |
| `UserAchievement` | Связь пользователь ↔ ачивка + момент выдачи                   |
| `AuditLog`        | Лог действий администратора                                   |
| `Notification`    | Уведомление для пользователя                                  |

**Локальные параметры Docker Compose:**

| Параметр                      | Значение                              |
| ----------------------------- | ------------------------------------- |
| Postgres host                 | `127.0.0.1`                           |
| Postgres port                 | `5433` (внешний) → `5432` (контейнер) |
| Postgres DB / User / Password | `basalt` / `basalt` / `basalt`        |
| Redis port                    | `6379`                                |

---

## Операционная зрелость

Бэк готов к работе в проде, а не только в локалке:

### Метрики и health-чеки

```bash
# Liveness — процесс жив, без проверки зависимостей
curl http://localhost:3001/api/v1/health
# → { "ok": true, "service": "basalt-bff", "version": "2.0.0" }

# Readiness — пингует Postgres + Redis. 200 если ok, 503 если что-то лежит.
# Используется k8s/Docker для авто-рестарта упавшего контейнера.
curl http://localhost:3001/api/v1/health/ready
# → { "ok": true, "deps": { "db": "ok", "redis": "ok" }, "uptimeSec": 1234 }

# Prometheus scrape endpoint — формат для Grafana/Prometheus.
# Метрики: http_requests_total{method,route,status},
# http_request_duration_seconds (гистограмма latency),
# default Node.js (CPU, heap, event loop lag, GC).
curl http://localhost:3001/metrics
```

Cardinality лейбла `route` ограничен шаблоном Express (`/api/v1/sprints/:id`),
а не конкретным URL — чтобы Prometheus не вырос на миллионах уникальных значений.

### Idempotency-Key (POST /submissions)

Защита от двойной отправки решения при ретрае на плохой сети:

```bash
curl -X POST http://localhost:3001/api/v1/sprints/<id>/submissions \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: 8f-uuid-from-client-side" \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/me/sub"}'

# Повтор с тем же ключом отдаст кэшированный ответ + заголовок Idempotent-Replay: true.
# Хранится в Redis 24 часа. 4xx кэшируются, 5xx нет.
```

### Redis-кэш для read-эндпоинтов

`/api/v1/meta` (статистика проекта) кэшируется в Redis на 60 секунд.
При write-операциях через админку кэш инвалидируется автоматически
(`invalidate(CacheKeys.metaPattern())`). В ответе заголовок `X-Cache-TTL: 60`.

### Live-обновления через Socket.io

При подключении сокет автоматически входит в комнату `user:<userId>`.
Это позволяет слать таргетированные события — например, при принятии решения
ментором владелец видит результат мгновенно, без F5:

| Событие                    | Когда отправляется                                   |
| -------------------------- | ---------------------------------------------------- |
| `submission:reviewed`      | Ментор изменил статус/score/комментарий              |
| `achievement:granted`      | Выдана новая ачивка                                  |
| `solution:liked`           | Кто-то лайкнул решение                               |
| `DATA_UPDATED` (broadcast) | Общие списки обновились (зал славы, метрики спринта) |

Клиент подключается так:

```js
import { io } from 'socket.io-client'
const socket = io('/', { auth: { token: accessToken } })
socket.on('submission:reviewed', (e) => {
  // e.status, e.mentorScore, e.mentorComment, e.at
})
```

---

## Тесты

```bash
# Unit (без Docker, быстро)
npm run test

# Integration (нужен Docker — testcontainers поднимает Postgres сам)
INTEGRATION=1 npm run test:integration -w bff
```

**Unit-тесты (57 тестов в 12 файлах):**
authService, likeService, errorHandler, sprintArenaSchedule, sort,
hallPublicFilter, memberAudit, **metrics** (Prometheus middleware),
**health** (readiness + dependency check), **idempotency** (Idempotency-Key),
**cache** (Redis-обёртка), **realtime** (socket.io targeted events).

**Integration-тесты (14 edge-case'ов):**
duplicate registration, 401/403/404/409/422 паттерны, само-лайк,
upsert submissions, auto-achievements end-to-end, PATCH /me.

ADR-документация по контрактам и инвариантам:

- [`bff/docs/adr-001-api-contract.md`](bff/docs/adr-001-api-contract.md)
- [`bff/docs/adr-002-auth-and-persistence.md`](bff/docs/adr-002-auth-and-persistence.md)
- [`bff/docs/adr-003-sprint-access-and-admin.md`](bff/docs/adr-003-sprint-access-and-admin.md)

---

## Деплой на сервер (Ubuntu / Lightsail)

Скрипт **[`deploy/ubuntu-bootstrap-once.sh`](deploy/ubuntu-bootstrap-once.sh)** — одноразовая полная установка на чистый Ubuntu.

**Что делает:**

1. Устанавливает Docker, Node.js 22, Nginx
2. Клонирует репозиторий в `~/bazalt-arena`
3. Поднимает Postgres + Redis через Docker Compose
4. Генерирует случайные JWT-секреты, создаёт `.env`
5. Устанавливает зависимости, применяет миграции, запускает сид
6. Собирает все три приложения (`build:all`)
7. Регистрирует systemd-сервис `basalt-bff`
8. Настраивает Nginx:
   - `:80` → `client/dist/` + прокси `/api/v1` → BFF
   - `:8080` → `admin/dist/` + прокси `/api/v1` → BFF

```bash
# На сервере (например, через SSH или Lightsail browser SSH):
export PUBLIC_ORIGIN=http://52.76.208.250
bash <(curl -fsSL https://raw.githubusercontent.com/neostorm112-boop/BazaltArena/main/deploy/ubuntu-bootstrap-once.sh)

# Или скопировать файл на сервер и запустить:
scp -i key.pem deploy/ubuntu-bootstrap-once.sh ubuntu@52.76.208.250:~
ssh -i key.pem ubuntu@52.76.208.250 "PUBLIC_ORIGIN=http://52.76.208.250 bash ubuntu-bootstrap-once.sh"
```

После установки пароль admin смотреть в `~/bazalt-arena/.env` → `SEED_ADMIN_PASSWORD`.

---

## Обновление сервера после коммита

После `git push` обновить сервер вручную через SSH:

```bash
ssh -i key.pem ubuntu@52.76.208.250

cd ~/bazalt-arena

# Обновить код из main
git pull origin main

# Если изменился BFF (TypeScript) — пересобрать и перезапустить
npm run build:bff
sudo systemctl restart basalt-bff

# Если изменился только клиент или админка — только пересобрать (Nginx отдаёт статику сразу)
npm run build:client
npm run build:admin

# Если добавились новые миграции
npm run db:migrate
```

> Nginx раздаёт `client/dist/` и `admin/dist/` напрямую. После пересборки фронта перезапуск Nginx **не нужен**.

---

## Синхронизация БД локально → сервер

Перенести всю схему `bff` (пользователи, спринты, решения) с локального Postgres на сервер:

```bash
export SSH_KEY=/path/to/LightsailKey.pem
export REMOTE_HOST=ubuntu@52.76.208.250
bash deploy/sync-bff-db-from-local-to-server.sh
```

Скрипт: останавливает BFF → делает `pg_dump` локально → загружает на сервер → восстанавливает → нормализует `UserRole` → запускает BFF.

---

## Частые проблемы

| Симптом                                      | Решение                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **BFF не стартует: `env validation failed`** | Проверьте `.env` и `bff/.env` — все обязательные поля заполнены?                                                         |
| **503 / `DATABASE_UNAVAILABLE`**             | Контейнер Postgres запущен? `docker compose ps`. Порт `5433` в `DATABASE_URL`?                                           |
| **503 / `«MEMBER» UserRole`**                | Старая версия enum в БД. Запустите `npm run db:normalize-roles` при поднятом compose                                     |
| **401 в клиенте или админке**                | Протух токен. Просто залогиньтесь заново. На сервере — после смены `JWT_*` нужен `sudo systemctl restart basalt-bff`     |
| **`docker compose` not found**               | Установите [Docker Compose V2](https://docs.docker.com/compose/) или используйте `docker-compose`                        |
| **EACCES при `npm ci` на сервере**           | Не запускайте npm под `root` в каталоге приложения: `sudo chown -R ubuntu:ubuntu ~/bazalt-arena`                         |
| **Nginx 403 на сервере**                     | Скрипт выставляет `chmod o+x $HOME`, но если `$HOME` изменился — повторите вручную: `chmod o+x ~`                        |
| **Клиент не видит API**                      | `VITE_API_BASE_URL` должен указывать на BFF. В dev — оставить пустым (Vite прокси). В prod — задать `http://ВАШ_IP:3001` |

---

## DX: форматирование, линт, pre-commit

- **Prettier** — форматирует весь монорепо (JS/TS/JSX/JSON/YAML/MD). Конфиг в корне.
- **ESLint** — `bff`, `client`, `admin`. Конфиг `eslint.config.js` в корне.
- **Husky** — перед каждым коммитом: `lint-staged` (prettier + eslint на staged), typecheck BFF, unit-тесты BFF. Упадёт — коммит не пройдёт.

```bash
npm run format        # Авто-форматирование
npm run lint          # Проверка линтером
npm run verify        # Всё вместе: format:check + lint + typecheck + unit
```

---

## API

OpenAPI 3.0 спецификация: **[`bff/openapi/openapi.yaml`](bff/openapi/openapi.yaml)**

Все ответы об ошибках в едином формате:

```json
{
  "code": "FORBIDDEN",
  "message": "Недостаточно прав",
  "requestId": "a1b2-c3d4-..."
}
```
