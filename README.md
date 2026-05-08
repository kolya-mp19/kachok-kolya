# КачОК — Аналитика силовых тренировок

Веб-приложение для атлетов, тренеров и организаторов соревнований по пауэрлифтингу.  
Позволяет сравнивать спортсменов разных весовых категорий через коэффициенты относительной силы,
а в будущем — вести дневник тренировок, анализировать прогресс и планировать нагрузку с помощью ИИ.

---

## Возможности (текущая версия)

- **Калькулятор коэффициентов**: Wilks, IPF GL Points, DOTS, Schwartz/Malone
- **Несколько атлетов**: добавляйте любое количество участников в одну сессию
- **Ввод данных**: собственный вес, пол, три попытки в каждом упражнении
- **Сводная таблица**: результаты автоматически сортируются по лучшему коэффициенту

---

## Дорожная карта

### v1 — MVP (дневник и статистика)
- Журнал тренировок с историей
- Личный кабинет пользователя
- Базовая статистика: объём нагрузки (тоннаж), регулярность

### v2 — AI-аналитика
- MCP-сервер для интеграции с ИИ
- Чат с Claude: анализ тренировок, советы по прогрессии
- Цели пользователя: похудение / набор массы / развитие силы

### v3 — Планирование
- Генерация тренировочных планов
- Автоматическая прогрессия рабочих весов
- Трекер восстановления: сон, RPE

### v4 — Питание
- Дневник питания и КБЖУ
- Расчёт макросов под цель
- ИИ-анализ питания в связке с тренировочными данными

---

## Технологии

| Слой | Технология |
|---|---|
| Фреймворк | Next.js 16 (App Router) |
| UI | React 19 |
| Язык | TypeScript 5 |
| Стили | CSS Modules |
| Линтер | ESLint 9 + @typescript-eslint |
| Форматирование | Prettier 3 |
| Утилиты | nanoid |
| База данных | PostgreSQL 17 |
| Контейнеризация | Docker + Compose |

---

## Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd kachok-kolya

# 2. Установить зависимости
npm install

# 3. Создать файл переменных окружения для локальной разработки
cp .env.example .env.local
# Отредактируй .env.local: поменяй POSTGRES_HOST на localhost
# и DATABASE_URL на postgresql://kachok:kachok_dev@localhost:5432/kachok

# 4. Запустить локальную базу данных
docker compose -f src/env/local/docker-compose.yml up -d

# 5. Запустить dev-сервер
npm run dev
```

Приложение будет доступно по адресу [http://localhost:3000](http://localhost:3000).

### Доступные команды

```bash
npm run dev          # dev-сервер с hot reload
npm run build        # production-сборка
npm run start        # запуск production-сервера
npm run lint         # проверка линтером
npm run lint:fix     # автоисправление ошибок линтера
npm run format       # форматирование кода Prettier
npm run format:check # проверка форматирования
```

### Переменные окружения

Шаблон находится в [`.env.example`](.env.example). Скопируй его и заполни реальными значениями:

| Переменная | Описание | Пример (локально) |
|---|---|---|
| `POSTGRES_HOST` | Хост БД | `localhost` (локально) / `postgres` (Docker) |
| `POSTGRES_PORT` | Порт PostgreSQL | `5432` |
| `POSTGRES_USER` | Пользователь БД | `kachok` |
| `POSTGRES_PASSWORD` | Пароль БД | `kachok_dev` |
| `POSTGRES_DB` | Имя базы данных | `kachok` |
| `DATABASE_URL` | Полная строка подключения для ORM | `postgresql://kachok:kachok_dev@localhost:5432/kachok` |

**Для локальной разработки** — создай `.env.local` (Next.js загружает его автоматически):

```bash
cp .env.example .env.local
# Измени POSTGRES_HOST=localhost и DATABASE_URL соответственно
```

**Для production** — создай `.env` на VPS (загружается через `env_file` в `docker-compose.yml`):

```bash
cp .env.example .env
# Установи надёжный пароль и правильный DATABASE_URL с хостом postgres
```

---

## База данных (PostgreSQL)

Проект использует **PostgreSQL 17**. Конфигурация разделена на два окружения:

| Окружение | Compose-файл | Запуск Next.js |
|---|---|---|
| Локальная разработка | `src/env/local/docker-compose.yml` | `npm run dev` (вне Docker) |
| Production (VPS) | `docker-compose.yml` (корень) | в Docker-контейнере |

### Локальная разработка с БД

```bash
# Запустить только PostgreSQL в Docker
docker compose -f src/env/local/docker-compose.yml up -d

# Подключиться к БД из консоли
docker compose -f src/env/local/docker-compose.yml exec postgres \
  psql -U kachok -d kachok

# Остановить (данные сохраняются в src/env/local/postgres-data/)
docker compose -f src/env/local/docker-compose.yml down

# Полный сброс с удалением данных
docker compose -f src/env/local/docker-compose.yml down -v
rm -rf src/env/local/postgres-data/
```

Данные хранятся в `src/env/local/postgres-data/` — директория создаётся автоматически и **не коммитится**.

### Данные и тома (Volumes)

| Окружение | Путь на хосте | Статус |
|---|---|---|
| Локальная разработка | `src/env/local/postgres-data/` | gitignored, создаётся автоматически |
| Production (VPS) | `.docker/postgres-data/` | gitignored, создаётся автоматически |

> **Важно:** Никогда не удаляй `.docker/postgres-data/` на VPS без предварительного бэкапа.

### Резервное копирование (Backup)

```bash
# На VPS: создать дамп базы данных
docker compose exec postgres \
  pg_dump -U kachok -d kachok --format=custom > backup_$(date +%Y%m%d_%H%M%S).dump

# Восстановить из дампа
docker compose exec -T postgres \
  pg_restore -U kachok -d kachok --clean < backup_YYYYMMDD_HHMMSS.dump
```

Рекомендуется настроить ежедневный cron-бэкап на VPS и хранить дампы в отдельной директории или S3.

---

## Запуск через Docker

### Production-стек (app + PostgreSQL)

```bash
# Убедись, что .env создан из .env.example с реальными значениями
cp .env.example .env && nano .env

# Запустить весь стек (PostgreSQL → Next.js)
docker compose up --build -d

# Проверить статус
docker compose ps

# Логи
docker compose logs -f app
docker compose logs -f postgres
```

### Деплой на VPS

```bash
# 1. Подключиться к серверу
ssh user@kachok-kolya.duckdns.org

# 2. Перейти в директорию проекта
cd /path/to/kachok-kolya

# 3. Получить последние изменения
git pull

# 4. Пересобрать и перезапустить (PostgreSQL не пересоздаётся — данные сохраняются)
docker compose up --build -d

# 5. Проверить, что всё запустилось
docker compose ps
docker compose logs app --tail=50
```

Nginx на VPS уже настроен проксировать `kachok-kolya.duckdns.org → http://127.0.0.1:3000`.
Порт контейнера намеренно привязан к `127.0.0.1` — прямой доступ к Node.js снаружи закрыт.

### Полезные Docker-команды

```bash
docker compose logs -f app              # потоковые логи приложения
docker compose logs -f postgres         # потоковые логи БД
docker compose exec app sh              # shell в контейнере приложения
docker compose exec postgres psql -U kachok -d kachok  # psql в контейнере БД
docker compose restart app             # перезапустить приложение без сборки
docker image prune -f                  # удалить устаревшие образы
```

---

## Troubleshooting

**Приложение не запускается, ошибка подключения к БД**

```bash
# Проверить статус и healthcheck postgres
docker compose ps
docker compose logs postgres --tail=30
```

**PostgreSQL не проходит healthcheck**

```bash
# Зайти в контейнер и проверить вручную
docker compose exec postgres pg_isready -U kachok -d kachok
```

**Порт 5432 уже занят на хосте**

```bash
# Найти процесс
sudo lsof -i :5432
# или
sudo ss -tlnp | grep 5432
```

**Сбросить все данные локальной БД**

```bash
docker compose -f src/env/local/docker-compose.yml down
rm -rf src/env/local/postgres-data/
docker compose -f src/env/local/docker-compose.yml up -d
```

---

## Структура проекта

```
src/
├── app/               # Next.js App Router: страницы и layout
├── components/
│   ├── athlete/       # Карточка атлета (ввод данных)
│   ├── table/         # Сводная таблица коэффициентов
│   └── ui/            # Переиспользуемые UI-компоненты (Button, Input, Select, Table)
├── hooks/             # React-хуки: управление атлетами и расчёт результатов
├── lib/
│   ├── calculations/  # Формулы: Wilks, IPF GL, DOTS, Schwartz/Malone
│   ├── constants/     # Константы и метки формул
│   └── utils/         # Вспомогательные функции (парсинг чисел и др.)
├── schemas/           # Схемы валидации (Zod — планируется)
└── types/             # TypeScript-типы: Athlete, Formula и др.
```
