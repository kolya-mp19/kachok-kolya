# Validation

The project uses **Zod v4** for runtime validation at all API boundaries.

---

## Where Zod is used

| Boundary | What is validated |
|---|---|
| API route request bodies | Every `POST` / `PATCH` handler parses its input through a schema before any business logic runs |
| (future) External API responses | OAuth profile payloads, third-party integrations |
| (future) `localStorage` reads | Any data read from storage that crosses a trust boundary |

Zod is **not** used for internal function arguments or derived in-memory state — TypeScript
types are sufficient there.

---

## Schema location

All schemas live in `src/schemas/`. Each file groups schemas by domain:

```
src/schemas/
└── auth.ts    — registerBodySchema, loginBodySchema, updateProfileBodySchema, genderSchema
```

### Naming convention

`<domain><Purpose>Schema` — e.g. `registerBodySchema`, `updateProfileBodySchema`.

---

## How to write a route handler with Zod

```ts
import { mySchema } from '@/schemas/my-domain';

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = mySchema.safeParse(rawBody);
  if (!parsed.success) {
    const { message } = parsed.error.issues[0];   // Zod v4: .issues not .errors
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { field1, field2 } = parsed.data;   // fully typed, no casts
  // ... business logic
}
```

Key points:
- Always use `safeParse` (never `parse`) — thrown `ZodError` would bypass the standard error
  response shape.
- Report only the first issue message as the HTTP error string. The full `.issues` array is
  available if richer error reporting is needed later.
- Zod v4: error details are at `parsed.error.issues`, not `.errors`.

---

## Types from schemas

Types are always inferred — never duplicated with a parallel interface:

```ts
// src/schemas/auth.ts
export const registerBodySchema = z.object({ ... });
export type RegisterBody = z.infer<typeof registerBodySchema>;
```

Consuming code imports the type, not a hand-written interface:

```ts
import type { RegisterBody } from '@/schemas/auth';
```

The `import type` ensures Zod is tree-shaken out of client bundles.

---

## Zod v4 compatibility notes

Zod v4 (installed) has minor breaking changes from v3:

| v3 | v4 |
|---|---|
| `zodError.errors` | `zodError.issues` |
| `z.string().email()` default message | slightly different wording |
| `z.ZodError` | same, but `issues` is the canonical array |

No `z.object().strict()` usage exists yet — use it in future schemas if unexpected keys
should be rejected.

---

## Adding a new schema

1. Add the schema to the appropriate file in `src/schemas/` (or create a new file for a new domain).
2. Export an inferred type with `z.infer<>`.
3. Import the schema in the route handler and use `safeParse`.
4. Update `src/schemas/AGENTS.md` to list the new schema.
