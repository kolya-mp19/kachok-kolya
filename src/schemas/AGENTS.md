# Zod schemas

Zod validation schemas corresponding to API request/response contracts.
Types are inferred from schemas with `z.infer<>` — never duplicated manually.

## Current schemas

### `auth.ts`

| Export | Used by |
|---|---|
| `registerBodySchema` | `POST /api/auth/register` |
| `loginBodySchema` | `POST /api/auth/login` |
| `updateProfileBodySchema` | `PATCH /api/auth/me` |
| `genderSchema` | shared across all three above |
| `RegisterBody`, `LoginBody`, `UpdateProfileBody` | inferred types, re-exported for consumers |

## Rules

- Schema name mirrors the domain + purpose: `registerBodySchema`, `updateProfileBodySchema`.
- Always infer TypeScript types with `z.infer<typeof xSchema>` — never write parallel interfaces.
- Use `safeParse` in route handlers. Report `parsed.error.issues[0].message` as the error string.
- Add schemas here only for runtime validation boundaries: API request bodies, external API
  responses, `localStorage` reads. Do not validate internal function arguments with Zod.
- Zod v4 uses `.issues` (not `.errors`) on `ZodError`. Use `safeParse` to avoid this entirely.
- Client-side imports must use `import type` so Zod stays out of the client bundle:
  ```ts
  import type { UpdateProfileBody } from '@/schemas/auth';
  ```
