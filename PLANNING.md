# PLANNING.md — КачОК: контекст для AI-ассистентов

> Этот файл предназначен для передачи AI-ассистентам (Claude Code и др.) в начале каждой
> рабочей сессии. Он описывает видение продукта, текущее состояние и ближайший следующий шаг.
> Обновляй чекбоксы и раздел «Следующий шаг» после завершения каждой задачи.

---

## Видение продукта

Полноценная платформа для силовых атлетов и тренеров: от простого калькулятора коэффициентов
относительной силы — до персонального AI-тренера, который анализирует тренировки, предлагает
план прогрессии и учитывает питание и восстановление. Целевая аудитория: пауэрлифтеры-любители,
персональные тренеры и организаторы соревнований.

---

## Текущее состояние (что уже работает)

- Ввод данных нескольких атлетов (собственный вес, пол, три попытки)
- Расчёт коэффициентов: Wilks, IPF GL Points, DOTS, Schwartz/Malone
- Сводная таблица с сортировкой по лучшему коэффициенту
- Переиспользуемые UI-компоненты: Button, Input, Select, Table
- Типизация через TypeScript-интерфейсы (Athlete, Formula)
- Настроены ESLint (flat config, @typescript-eslint) и Prettier
- Docker + Compose (multi-stage build, non-root runner)
- PostgreSQL 17 в Docker: production (`docker-compose.yml`) + локальная разработка (`src/env/local/docker-compose.yml`)
- `.env.example` с документацией всех переменных
- Разделённые bind-mount тома (`.docker/postgres-data/`, `src/env/local/postgres-data/`)
- Drizzle ORM + drizzle-kit: схема в `src/db/schema/`, миграции в `src/db/migrations/`
- Схема на данный момент: только таблица `users` + enum `gender`; остальные таблицы будут добавлены по мере роста фич

---

## Принятые технические решения

| Решение | Технология | Причина |
|---|---|---|
| Фреймворк | Next.js 16, App Router | SSR для будущих API-роутов и SEO |
| UI-библиотека | React 19 | Последняя стабильная версия |
| Язык | TypeScript 5, strict mode | Надёжность типов во всём проекте |
| Стили | CSS Modules | Изоляция стилей без внешних зависимостей |
| ID генерация | nanoid | Лёгкая замена uuid, уже в проекте |
| Линтер | ESLint 9 flat config + @typescript-eslint | Современный конфиг, совместим с TS |
| Форматирование | Prettier 3 | Единый стиль кода |
| База данных | PostgreSQL 17 (Alpine) | Надёжная, хорошо поддерживается ORM, совместима с Docker |
| ORM | Drizzle ORM 0.45 + drizzle-kit 0.31, `postgres` драйвер | Лёгкий, type-safe, SQL-first, хорошо работает с App Router |
| Аутентификация | **NOT YET DECIDED** (Clerk или Auth.js) | — |
| Контейнеризация | Docker + Compose (multi-stage, node:20-alpine) | Лёгкий образ, безопасный non-root запуск, совместим с VPS nginx |
| MCP-сервер | **NOT YET DECIDED** (планируется в v2) | — |

---

## Дорожная карта

### Инфраструктура
- [x] Контейнеризировать приложение (Dockerfile + docker-compose)
- [x] Поднять PostgreSQL в Docker (production + local dev compose-файлы)
- [x] Выбрать и подключить ORM (Drizzle ORM + drizzle-kit + postgres driver)
- [x] Автоматический запуск миграций при старте контейнера (scripts/start.sh)
- [ ] Выбрать стратегию аутентификации (NOT YET DECIDED: Clerk или Auth.js)

### v1 — MVP
- [ ] Личный кабинет / страница профиля пользователя
- [ ] Журнал тренировок (mobile-first UI)
- [ ] Базовая статистика: тоннаж, регулярность

### v2 — AI
- [ ] Настройка MCP-сервера
- [ ] Интеграция чата с Claude
- [ ] Функция целей пользователя (похудение / набор массы / сила)

### v3 — Планирование
- [ ] Генерация тренировочных планов
- [ ] Автоматическая прогрессия рабочих весов
- [ ] Трекер восстановления (сон, RPE)

### v4 — Питание
- [ ] Дневник питания и КБЖУ
- [ ] Калькулятор макросов под цель
- [ ] AI-анализ питания в связке с тренировочными данными

---

## Выполнено в последней сессии

**Задача:** Автозапуск миграций в Docker — **ВЫПОЛНЕНО**

Создано/изменено:
- `scripts/start.sh` — запускает `npm run db:migrate`, затем `exec node server.js`; `set -e` гарантирует остановку контейнера при ошибке миграции
- `next.config.ts` — добавлен `output: 'standalone'`; генерирует `server.js` для запуска без `next` CLI
- `Dockerfile` runner-стейдж — переведён на standalone-output: копирует `.next/standalone/`, `.next/static`, `public/`, полный `node_modules` из builder (включая `drizzle-kit`), `src/db/migrations/`, `drizzle.config.ts`, `scripts/`; CMD заменён на `["scripts/start.sh"]`

---

**Задача:** Drizzle ORM — **ВЫПОЛНЕНО**

Создано/изменено:
- `drizzle.config.ts` — конфиг drizzle-kit: dialect postgresql, schema `src/db/schema/index.ts`, out `src/db/migrations/`
- `src/db/index.ts` — singleton drizzle-клиент на `postgres` драйвере, global-паттерн против утечек при hot reload
- `src/db/schema/users.ts` — таблица `users`, enum `gender`
- `src/db/schema/workouts.ts` — таблицы `workout_sessions` (enum `workout_type`), `exercises`, `session_sets`
- `src/db/schema/body.ts` — таблица `body_weight_logs`
- `src/db/schema/index.ts` — re-export всех схем
- `src/db/migrations/0000_skinny_wonder_man.sql` — первая миграция, применена локально
- `package.json` — добавлены скрипты `db:generate`, `db:migrate`, `db:studio`, `db:push`
- `.env` — исправлен `POSTGRES_HOST` и `DATABASE_URL` на `localhost` для локальной разработки

---

## Следующий шаг

**Задача:** Добавить аутентификацию через Clerk.

> Инфраструктура готова: БД поднята, миграции применяются автоматически, Next.js запускается через standalone-образ.

**Что значит «готово»:**
- Установлен `@clerk/nextjs`
- `CLERK_SECRET_KEY` и `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` добавлены в `.env.example` и `.env`
- `middleware.ts` настроен для защиты роутов
- `ClerkProvider` обёрнут вокруг layout
- Страницы `/sign-in` и `/sign-up` работают
- `userId` из Clerk используется как FK в таблице `users` (или через отдельный маппинг)

**Масштабирование и будущие сервисы:**
- Redis — раскомментировать блок в `docker-compose.yml`, добавить `REDIS_URL` в `.env.example`
- Фоновые задачи — добавить `Dockerfile.worker` и раскомментировать `worker` сервис
- Мониторинг — раскомментировать `monitoring` блок, добавить `prometheus.yml`

---

## Как использовать этот файл

В начале каждой сессии Claude Code передавай этот файл как контекст (`@PLANNING.md`).
После завершения задачи обнови чекбоксы в дорожной карте и раздел «Следующий шаг»
перед закрытием сессии — чтобы следующая итерация AI-ассистента начиналась с актуального состояния.
