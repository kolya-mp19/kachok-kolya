<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Project Agent Guide

## Scope

- This repository is a client-side strength coefficient calculator built on Next.js App Router.
- Core page is `src/app/page.tsx`, styles are in `src/app/page.module.css`.

## Product Expectations

- UI language is Russian by default.
- Ranking updates immediately after input changes.
- Athlete ranking is based on computed score from best valid attempt.
- Users can select calculation formula (Wilks, IPF GL, DOTS, Schwartz/Malone).

## Coding Rules

- All folder names must be lowercase. Multi-word folder names use kebab-case (words separated by hyphens).
  Examples: `athlete-card/`, `form-fields/`, `use-athletes/`
  Wrong: `AthleteCard/`, `athleteCard/`, `FormFields/`, `form_fields/`
  This rule applies to every folder in the project without exception, including inside `src/`, `public/`, and any future directories.
- Prefer focused, minimal edits over large refactors.
- Keep business logic in small typed helper functions.
- Avoid `any`; keep strict TypeScript-friendly updates.
- Do not add dependencies unless clearly necessary.
- Keep naming explicit:
  - `camelCase` for variables/functions
  - `PascalCase` for types/components
  - boolean flags start with `is/has/can` where applicable.
- Prefer `type` aliases for local domain structures used in UI state.
- Avoid duplicated logic; extract shared calculations into pure functions.
- **SVG icons must never be inlined in component files.** Every SVG is a `.tsx` file in
  `src/components/ui/icon/` that default-exports a zero-prop React function named
  `[Name]Icon` (e.g. `CloseIcon`, `YandexIcon`). Import the component wherever the icon
  is needed. See `src/components/ui/icon/ProgressionIcon.tsx` as the canonical example.

## Form and Validation Rules

- Numeric fields must accept both comma and dot decimals.
- Treat empty/invalid/non-positive values as missing data.
- Keep incomplete athletes visible in table with placeholders rather than crashing logic.
- When changing data model fields, update:
  - initial state,
  - add/remove/update handlers,
  - derived calculations (`useMemo`),
  - table rendering.

## Styling Rules

- Reuse existing CSS module patterns and color palette.
- Keep control styles consistent across `input` and `select`.
- Maintain responsive behavior for mobile (`max-width: 768px`).
- New UI controls must match existing button/select/input visual language.
- Keep layout changes mobile-safe; avoid horizontal overflow in forms.
- Prefer adding classes over inline styles.

## UX Rules

- Do not hide important actions behind hover-only interactions.
- Collapsible content must keep entered data intact.
- Sorting/ranking behavior must remain predictable after UI changes.
- Text labels should be concise and user-facing (no technical wording).

## UI rules — STRICT, never violate

- Mobile-first is mandatory. Every component starts with mobile layout.
  Desktop styles are always additions via media queries in CSS modules, never the base.
- Never write a layout without checking it at 375px width first.
- CSS Modules media query order: base styles (mobile) → min-width: 640px → min-width: 768px → min-width: 1024px
  Never start with max-width queries — that is desktop-first.

  Correct:
  .button { width: 100%; }
  @media (min-width: 768px) { .button { width: auto; } }

  Wrong:
  .button { width: auto; }
  @media (max-width: 768px) { .button { width: 100%; } }

- Touch targets minimum 44×44px on all interactive elements.
- Font sizes: minimum 16px for body text and inputs — prevents iOS auto-zoom on focus.
- Spacing: minimum 12px padding inside tap areas, minimum 8px gap between interactive elements.
- Forms in the gym are filled with one thumb. Input fields must be large: minimum height 48px.
- Never use hover-only interactions. Every hover state must have an equivalent active/focus state.
- Test mentally at 375px (iPhone SE) before suggesting any layout.
- All colors must be defined as CSS custom properties in `src/styles/variables.css`.
  Never use hardcoded color values in CSS modules — always reference a variable.
  Variables are loaded globally via `globals.css`; no extra import needed in modules.
  Use semantic names that describe PURPOSE, not appearance:
  - Correct: `--color-text-heading`, `--color-primary`, `--color-border-input`
  - Wrong: `--color-blue-500`, `--gray`, `--hex-111827`

Full UI reference with examples: `docs/ui-rules.md`

## Testing and Verification

- After substantive edits, check lints for changed files.
- If dev server is running, verify affected flows manually:
  - add athlete,
  - edit bodyweight and attempts,
  - change formula,
  - collapse/expand athlete card,
  - confirm ranking updates correctly.
- If something cannot be verified locally, state it explicitly in the final report.

## Commit Message Convention

- Use concise, intention-first messages.
- Recommended format:
  - `feat: ...` for new capabilities
  - `fix: ...` for bug fixes/regressions
  - `refactor: ...` for internal cleanups without behavior changes
  - `style: ...` for visual-only changes
- Keep subject line in imperative mood and under ~72 chars when possible.

## Docker & Infrastructure

### Compose file layout

| File                               | Purpose                          | When to use       |
| ---------------------------------- | -------------------------------- | ----------------- |
| `docker-compose.yml` (root)        | Production stack: app + postgres | VPS deployment    |
| `src/env/local/docker-compose.yml` | Local DB only                    | Local development |

**Key rule:** local development runs Next.js with `npm run dev` outside Docker.
Only the database runs in Docker locally. This gives fast hot-reload without
sacrificing a consistent database environment.

### Container architecture (Next.js image)

The application is containerized with a 3-stage Dockerfile:

| Stage     | Base           | Purpose                                       |
| --------- | -------------- | --------------------------------------------- |
| `deps`    | node:20-alpine | Install production `node_modules` only        |
| `builder` | node:20-alpine | Install all deps, run `npm run build`         |
| `runner`  | node:20-alpine | Copy artifacts, run as non-root `nextjs` user |

The final image contains only production dependencies and the `.next` build output.
No source files, no dev dependencies, no secrets.

### Environment files

| File           | Committed | Loaded by                       | Purpose                           |
| -------------- | --------- | ------------------------------- | --------------------------------- |
| `.env.example` | **yes**   | —                               | Template; documents all variables |
| `.env`         | no        | `docker-compose.yml` (env_file) | Production secrets on VPS         |
| `.env.local`   | no        | Next.js dev server              | Local dev secrets                 |

Rules:

- **Never** commit `.env` or `.env.local`.
- **Always** update `.env.example` when adding a new environment variable.
- The `DATABASE_URL` host differs: `postgres` (Docker network) vs `localhost` (local dev).

### Database volumes

| Environment | Host path                      | gitignored |
| ----------- | ------------------------------ | ---------- |
| Production  | `.docker/postgres-data/`       | yes        |
| Local dev   | `src/env/local/postgres-data/` | yes        |

Both are bind-mounts. Docker creates the directories automatically on first run.
**Never delete `.docker/postgres-data/` on the VPS without taking a backup first.**

### Local development workflow

```bash
# Start the database
docker compose -f src/env/local/docker-compose.yml up -d

# Run Next.js outside Docker (fast hot-reload)
npm run dev

# Stop the database (data persists in src/env/local/postgres-data/)
docker compose -f src/env/local/docker-compose.yml down

# Wipe local database completely
docker compose -f src/env/local/docker-compose.yml down
rm -rf src/env/local/postgres-data/
```

### Production deployment workflow

```bash
# On VPS
git pull
docker compose up --build -d   # rebuilds app image; postgres container is reused
docker compose ps               # verify all services are healthy
docker compose logs app --tail=50
```

### Port binding rules

- **All** ports on production VPS are bound to `127.0.0.1` (localhost-only).
- nginx proxies `kachok-kolya.duckdns.org → http://127.0.0.1:3000`.
- PostgreSQL is at `127.0.0.1:5432` — accessible for admin tools, not the internet.
- **Never** change a binding to `0.0.0.0` on production.

### Startup order (production)

```
postgres (healthcheck: pg_isready)
    └─► app (depends_on: postgres, condition: service_healthy)
```

The `app` container will not start until `postgres` passes its healthcheck.
`start_period: 30s` gives PostgreSQL time to initialize on first boot.

### Adding future services

`docker-compose.yml` contains commented-out blocks ready to activate:

| Service           | Block label   | What to also do                                                              |
| ----------------- | ------------- | ---------------------------------------------------------------------------- |
| Redis             | `redis:`      | Add `REDIS_URL` to `.env.example`; update `depends_on` in `app` and `worker` |
| Background worker | `worker:`     | Create `Dockerfile.worker`; add `depends_on` postgres + redis                |
| Monitoring        | `monitoring:` | Create `monitoring/prometheus.yml`                                           |

Steps to activate any service:

1. Uncomment the block in `docker-compose.yml`.
2. Add env vars to `.env.example` (with placeholder) and to `.env` on VPS.
3. Update `depends_on` in services that need it.
4. Run `docker compose up -d` (no rebuild needed for new services without a build step).

### Infrastructure rules for AI agents

- Always keep `README.md`, `PLANNING.md`, and `AGENTS.md` in sync with every infra change.
- Never commit `.env` or `.env.local`; only commit `.env.example`.
- When adding any environment variable: add it to `.env.example` with a comment explaining its purpose and the difference between local and production values.
- Use `127.0.0.1` bindings for all ports on production VPS.
- After every infrastructure change, update the **Следующий шаг** section in `PLANNING.md`.
- When activating a commented-out service, move its documentation from "future" to "active" in this file.

## Delivery Checklist

- Run lint diagnostics for changed files after substantive edits.
- Preserve existing features unless explicitly asked to remove them.
- Keep UI state durable (e.g., collapse toggles should not clear form data).
- After infrastructure changes: update `README.md`, `PLANNING.md`, and `AGENTS.md`.
