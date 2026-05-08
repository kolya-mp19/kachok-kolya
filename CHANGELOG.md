# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [0.4.0] — 2026-05-08

### Added
- `scripts/start.sh` — container entrypoint: runs `npm run db:migrate` then `exec node server.js`; `set -e` ensures the container exits if migrations fail, preventing a broken-schema app from starting
- `next.config.ts` — `output: 'standalone'` enabled; produces a self-contained `server.js` so the container no longer depends on the `next` CLI at runtime

### Changed
- `Dockerfile` runner stage — switched from `npm run start` (Next.js CLI) to `scripts/start.sh` (migration → standalone server)
  - Copies `.next/standalone/` (contains `server.js`) + `.next/static/` + `public/`
  - Copies full `node_modules` from `builder` stage instead of production-only `deps` — required because `drizzle-kit` is a devDependency needed at runtime for migrations
  - Copies `src/db/migrations/` and `drizzle.config.ts` into the image
  - `CMD` changed to `["scripts/start.sh"]`

---

## [0.3.1] — 2026-05-08

### Removed
- `src/db/schema/workouts.ts` and `src/db/schema/body.ts` — premature schema; tables will be added when the feature work begins
- Migration `0001` drops `workout_sessions`, `exercises`, `session_sets`, `body_weight_logs` tables and `workout_type` enum from the database

### Changed
- `src/db/schema/index.ts` — now exports only `users`

---

## [0.3.0] — 2026-05-08

### Added
- **Drizzle ORM integration** (`drizzle-orm` 0.45, `drizzle-kit` 0.31, `postgres` driver)
- `drizzle.config.ts` — drizzle-kit config pointing to `src/db/schema/index.ts` and `src/db/migrations/`
- `src/db/index.ts` — singleton Drizzle client; global pattern prevents connection exhaustion during Next.js hot reload
- `src/db/schema/users.ts` — `users` table, `gender` enum (`male` | `female`)
- `src/db/schema/workouts.ts` — `workout_sessions` table with `workout_type` enum (`back` | `shoulders_arms` | `legs`), `exercises` table, `session_sets` table
- `src/db/schema/body.ts` — `body_weight_logs` table
- `src/db/schema/index.ts` — barrel re-export for all schema modules
- `src/db/migrations/0000_skinny_wonder_man.sql` — initial migration: 2 enums + 5 tables with FK constraints
- npm scripts: `db:generate`, `db:migrate`, `db:studio`, `db:push`

### Fixed
- `.env` `DATABASE_URL` and `POSTGRES_HOST` corrected from `postgres` (Docker-only DNS) to `localhost` for local development workflow

---

## [0.2.0] — 2026-05-08

### Added
- PostgreSQL 17 (Alpine) in Docker
- `docker-compose.yml` — production stack: postgres + Next.js app with healthcheck-gated startup
- `src/env/local/docker-compose.yml` — local dev: postgres-only container, Next.js runs via `npm run dev`
- `.env.example` — environment variable template documenting local vs production values
- `.env` — local development env file (gitignored)
- Bind-mount volumes: `.docker/postgres-data/` (production), `src/env/local/postgres-data/` (local)
- README: PostgreSQL setup, backup, troubleshooting sections

### Changed
- `.gitignore` — added volume directories and `!.env.example` whitelist
- `.dockerignore` — added `src/env/` and `.docker/`

---

## [0.1.0] — 2026-05-08

### Added
- Next.js 16 App Router project scaffold
- Strength coefficient calculator: Wilks, IPF GL Points, DOTS, Schwartz/Malone
- Multi-athlete session support with per-athlete results table
- Reusable UI components: Button, Input, Select, Table
- TypeScript strict mode, ESLint 9 flat config, Prettier 3
- `Dockerfile` — 3-stage multi-stage build (`deps` → `builder` → `runner`), non-root user
- `docker-compose.yml` initial scaffold
- `.dockerignore`
