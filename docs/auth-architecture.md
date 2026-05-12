# Auth Architecture

## Overview

Stateless JWT authentication with two tokens — a short-lived **access token** and a
long-lived **refresh token** — stored as `httpOnly` cookies. No server-side sessions,
no Auth.js / NextAuth, no Passport.

The architecture is intentionally boring: two signed JWTs, two DB columns, five API
routes. Every decision is explicit in code; nothing is hidden in a framework.

**Why this design for a Next.js AI-assisted project:**

- All auth logic is in plain TypeScript files with no framework magic, making every
  behaviour traceable and editable by an AI coding assistant.
- The Edge-compatible `jose` library means the same JWT verification runs in Node.js,
  Next.js Middleware (Edge Runtime), and Vercel Edge Functions without configuration.
- No opaque session store means horizontal scaling requires no shared state beyond
  the two JWT secrets.

---

## Database Schema

### Tables

#### `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` |
| `email` | `text` | UNIQUE, NOT NULL |
| `name` | `text` | NOT NULL |
| `password_hash` | `text` | NOT NULL |
| `gender` | `gender` enum | nullable (`'male' \| 'female'`) |
| `created_at` | `timestamp` | `DEFAULT now()` |

#### `refresh_tokens`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE |
| `token_hash` | `text` | NOT NULL |
| `expires_at` | `timestamp` | NOT NULL |
| `created_at` | `timestamp` | `DEFAULT now()` |

The raw refresh JWT is **never stored**. Only its SHA-256 + bcrypt hash is persisted.
`ON DELETE CASCADE` ensures all token records are removed when a user is deleted.

### ER Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        text email UK
        text name
        text password_hash
        gender gender
        timestamp created_at
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        text token_hash
        timestamp expires_at
        timestamp created_at
    }
    users ||--o{ refresh_tokens : "owns"
```

---

## Token Strategy

| Property | Access Token | Refresh Token |
|---|---|---|
| Algorithm | HS256 | HS256 |
| Signing secret | `JWT_ACCESS_SECRET` | `JWT_REFRESH_SECRET` |
| TTL | `JWT_ACCESS_EXPIRES_IN` (default `15m`) | `JWT_REFRESH_EXPIRES_IN` (default `7d`) |
| Cookie name | `access_token` | `refresh_token` |
| Cookie path | `/` | `/api/auth/refresh` |
| `httpOnly` | yes | yes |
| `sameSite` | `lax` | `lax` |
| `secure` | production only | production only |
| Stored in DB | no | hashed |

**Access token payload:**

```json
{
  "sub": "<userId>",
  "email": "<user@example.com>",
  "jti": "<uuid>",
  "iat": 1700000000,
  "exp": 1700000900
}
```

**Refresh token payload:**

```json
{
  "sub": "<userId>",
  "jti": "<uuid>",
  "iat": 1700000000,
  "exp": 1700604800
}
```

---

## Token Flow Diagrams

### Register

```mermaid
sequenceDiagram
    participant C as Client
    participant S as POST /api/auth/register
    participant DB as PostgreSQL

    C->>S: { email, password, name, gender? }
    S->>S: Validate input (type checks, email regex, min-length)
    S->>DB: SELECT id FROM users WHERE email = ?
    DB-->>S: null
    S->>S: bcrypt.hash(password, rounds=12)
    S->>DB: INSERT INTO users → { id, email, name }
    S->>S: signAccessToken({ userId, email })
    S->>S: signRefreshToken({ userId })
    S->>S: SHA-256(refreshToken) → bcrypt.hash(digest, rounds=10)
    S->>DB: INSERT INTO refresh_tokens { userId, tokenHash, expiresAt }
    S-->>C: 201 { user: { id, email, name } }<br>Set-Cookie: access_token (path=/)<br>Set-Cookie: refresh_token (path=/api/auth/refresh)
```

### Login

```mermaid
sequenceDiagram
    participant C as Client
    participant S as POST /api/auth/login
    participant DB as PostgreSQL

    C->>S: { email, password }
    S->>DB: SELECT * FROM users WHERE email = ?
    DB-->>S: user | null
    note over S: Always runs bcrypt.compare — uses DUMMY_HASH<br>if user not found to prevent timing oracle
    S->>S: bcrypt.compare(password, user.passwordHash | DUMMY_HASH)
    alt invalid credentials (no user OR wrong password)
        S-->>C: 401 { error: "Invalid credentials" }
    else valid
        S->>S: signAccessToken + signRefreshToken
        S->>S: SHA-256 + bcrypt.hash(refreshToken, 10)
        S->>DB: INSERT INTO refresh_tokens
        S-->>C: 200 { user: { id, email, name } } + Set-Cookie
    end
```

### Authenticated Request (access token valid)

```mermaid
sequenceDiagram
    participant C as Client
    participant M as src/middleware.ts (Edge)
    participant R as Route Handler

    C->>M: Request to /profile or /dashboard/*<br>Cookie: access_token=<jwt>
    M->>M: verifyAccessToken(token) via jose
    alt token valid
        M->>R: NextResponse.next()
        R-->>C: 200 response
    else token missing or invalid / expired
        M-->>C: 302 redirect → /
    end
```

### Silent Refresh (access token expired)

```mermaid
sequenceDiagram
    participant C as Client
    participant M as src/middleware.ts (Edge)
    participant RP as POST /api/auth/refresh
    participant DB as PostgreSQL

    C->>M: Request to /profile (access_token expired)
    M-->>C: 302 redirect → /
    note over C: Client-side code detects redirect / expired state<br>and calls the refresh endpoint
    C->>RP: POST /api/auth/refresh<br>Cookie: refresh_token=<jwt> (browser sends — path matches)
    RP->>RP: verifyRefreshToken(token) — checks JWT signature + exp
    RP->>DB: SELECT * FROM users WHERE id = payload.sub
    RP->>DB: SELECT * FROM refresh_tokens WHERE user_id = payload.sub
    RP->>RP: bcrypt.compare(rawToken, record.tokenHash) for each record
    alt match found and expiresAt in future
        RP->>DB: BEGIN TRANSACTION
        DB->>DB: DELETE FROM refresh_tokens WHERE id = matched.id
        DB->>DB: INSERT INTO refresh_tokens (new record)
        DB->>RP: COMMIT
        RP->>RP: sign new access + refresh tokens
        RP-->>C: 200 { success: true } + Set-Cookie (new tokens)
        C->>M: Retry original request
        M-->>C: 200 response
    else no match or expired
        RP-->>C: 401 { error, code }
        note over C: Redirect to / or show login UI
    end
```

### Logout

```mermaid
sequenceDiagram
    participant C as Client
    participant S as POST /api/auth/logout
    participant DB as PostgreSQL

    C->>S: POST /api/auth/logout<br>Cookie: access_token=<jwt>
    note over S: refresh_token cookie has path=/api/auth/refresh<br>so the browser does NOT send it here
    S->>S: verifyAccessToken(token) → { sub: userId }
    S->>DB: DELETE FROM refresh_tokens WHERE user_id = userId
    note over DB: Deletes ALL sessions for this user (all devices)
    S-->>C: 200 { success: true }<br>Set-Cookie: access_token=; MaxAge=0<br>Set-Cookie: refresh_token=; MaxAge=0; Path=/api/auth/refresh
```

---

## API Reference

All error responses follow the shape `{ error: string, code?: string }`.

---

### `POST /api/auth/register`

Creates a new user account and issues tokens.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "name": "Alice",
  "gender": "female"
}
```

`gender` is optional. `password` minimum length: 8.

**Response `201`**

```json
{
  "user": { "id": "<uuid>", "email": "user@example.com", "name": "Alice" }
}
```

Sets `access_token` and `refresh_token` cookies.

**Error codes**

| Status | `code` | Reason |
|---|---|---|
| 400 | — | Missing / invalid field |
| 409 | `EMAIL_TAKEN` | Email already registered |
| 500 | — | Unexpected server error |

---

### `POST /api/auth/login`

Authenticates an existing user and issues tokens.

**Request body**

```json
{ "email": "user@example.com", "password": "secret" }
```

**Response `200`**

```json
{
  "user": { "id": "<uuid>", "email": "user@example.com", "name": "Alice" }
}
```

Sets `access_token` and `refresh_token` cookies.

**Error codes**

| Status | `code` | Reason |
|---|---|---|
| 400 | — | Missing field |
| 401 | — | Wrong email or password |
| 500 | — | Unexpected server error |

---

### `POST /api/auth/refresh`

Rotates the refresh token and issues a new access token. Requires the `refresh_token`
cookie (automatically sent by the browser because the request path matches
`/api/auth/refresh`).

**Request body:** none

**Response `200`**

```json
{ "success": true }
```

Sets new `access_token` and `refresh_token` cookies.

**Error codes**

| Status | `code` | Reason |
|---|---|---|
| 401 | `NO_TOKEN` | Cookie absent |
| 401 | `INVALID_TOKEN` | JWT signature invalid or token not in DB |
| 401 | `TOKEN_EXPIRED` | DB record `expires_at` in the past |
| 500 | — | Unexpected server error |

---

### `POST /api/auth/logout`

Invalidates all refresh tokens for the user and clears cookies.

**Request body:** none

**Response `200`**

```json
{ "success": true }
```

Always succeeds (even if access token is missing or invalid — cookies are cleared
regardless).

| Status | Reason |
|---|---|
| 500 | Unexpected server error |

---

### `GET /api/auth/me`

Returns the authenticated user's profile. Does not attempt a token refresh.

**Request body:** none — requires `access_token` cookie.

**Response `200`**

```json
{
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "name": "Alice",
    "gender": "female",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

`passwordHash` is never returned.

**Error codes**

| Status | `code` | Reason |
|---|---|---|
| 401 | `NO_TOKEN` | Cookie absent |
| 401 | `INVALID_TOKEN` | JWT expired or signature invalid |
| 500 | — | Unexpected server error |

---

## File Structure

```
src/
├── middleware.ts                    # Edge middleware: JWT check, redirects /profile and /dashboard to / on failure
│
├── lib/
│   └── auth/
│       ├── jwt.ts                   # signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, JwtPayload
│       ├── cookies.ts               # setAuthCookies, clearAuthCookies, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE
│       └── hash.ts                  # hashToken, compareToken — SHA-256 pre-hash + bcrypt for refresh token storage
│
├── db/
│   ├── index.ts                     # Drizzle singleton instance (postgres-js driver)
│   └── schema/
│       ├── index.ts                 # Re-exports all tables
│       ├── users.ts                 # users table + genderEnum
│       └── refresh-tokens.ts       # refresh_tokens table with FK → users.id CASCADE
│
└── app/
    └── api/
        └── auth/
            ├── register/
            │   └── route.ts         # POST — validate, hash password, insert user, issue tokens
            ├── login/
            │   └── route.ts         # POST — verify credentials (constant-time), issue tokens
            ├── refresh/
            │   └── route.ts         # POST — verify JWT, find+compare DB record, rotate token pair
            ├── logout/
            │   └── route.ts         # POST — delete all user refresh tokens, clear cookies
            └── me/
                └── route.ts         # GET — verify access token, return user without passwordHash
```

---

## Environment Variables

| Variable | Description | Example value | Required |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | HMAC-SHA256 signing key for access tokens. Generate: `openssl rand -base64 32` | `v3ryS3cr3t...` | Yes |
| `JWT_REFRESH_SECRET` | HMAC-SHA256 signing key for refresh tokens. Must differ from access secret. | `an0th3rS3cr3t...` | Yes |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL — jose duration string | `15m` | Yes |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL — jose duration string | `7d` | Yes |
| `DATABASE_URL` | PostgreSQL connection URL used by Drizzle + postgres-js | `postgresql://user:pass@host:5432/db` | Yes |

jose duration string format: `<number><unit>` where unit is `s` (seconds), `m` (minutes),
`h` (hours), `d` (days). Example: `15m`, `1h`, `7d`.

---

## Security Decisions

### httpOnly cookies over localStorage

LocalStorage is readable by any JavaScript on the page. A single XSS vulnerability
exposes every stored token. `httpOnly` cookies are inaccessible to JavaScript entirely —
the browser attaches them automatically and only the server can read them.

`sameSite: lax` blocks CSRF on cross-origin POST requests while still allowing
top-level navigations (e.g. OAuth redirects). `secure` is enforced in production to
prevent token transmission over plain HTTP.

### Refresh token hashed in DB

If the database is compromised, plaintext refresh tokens become immediately usable
credentials. A bcrypt hash (with per-value salt via SHA-256 pre-digest) renders them
computationally infeasible to reverse or use directly.

SHA-256 pre-hashing is required because bcryptjs silently truncates inputs longer than
72 bytes. JWTs are typically 200–400 bytes, and their signature — the uniquely random
portion — starts well past byte 72. Without the digest step, two distinct JWTs could
produce the same stored hash.

### Token rotation on refresh

After each successful refresh, the old DB record is deleted and a new one is inserted
in a single transaction. This means a stolen refresh token becomes invalid as soon as
the legitimate client uses it first. The delete + insert is atomic via
`db.transaction()` — no window where both the old and new token are simultaneously
valid.

### `jose` over `jsonwebtoken`

`jsonwebtoken` depends on the Node.js `crypto` bindings, which are unavailable in the
Edge Runtime. `jose` is built entirely on the Web Crypto API (`SubtleCrypto`), which is
available in Node.js 18+, Next.js Middleware, Vercel Edge Functions, and Cloudflare
Workers. Using `jose` means `verifyAccessToken` can be called directly in
`src/middleware.ts` without switching the middleware to the Node.js runtime.

### No token refresh in middleware

Middleware runs on every matching request. Refreshing there would require a DB round
trip, making every request to a protected route slower. It would also complicate the
response — the middleware would need to set new cookies while forwarding the request to
the route handler. Instead, middleware does only a fast in-memory JWT signature check
(`< 1 ms`) and redirects to `/` on failure. The client is responsible for detecting the
redirect and calling `POST /api/auth/refresh` before retrying.

### bcrypt rounds: 12 for passwords, 10 for tokens

OWASP recommends a minimum of 10 rounds for bcrypt in 2024. 12 rounds is the common
production baseline (~250 ms on typical hardware), giving meaningful resistance to
offline brute force while keeping login latency acceptable.

Refresh token hashing uses 10 rounds because the input is already a
cryptographically random JWT (not a user-chosen weak password). The hash's purpose is
preventing DB-dump reuse, not slowing brute force on a known weak input.

---

## Known Limitations and Future Improvements

### Refresh token family tracking (reuse detection)

If a refresh token is stolen and the attacker uses it before the legitimate client,
the legitimate client's next refresh attempt will fail (the old record has been
rotated). However, the attacker continues undetected with the new token.

Full family tracking would group tokens by a `familyId` column. Any use of an
already-rotated token in a family immediately revokes the entire family (all sessions
for that device). This requires adding `familyId uuid` to the `refresh_tokens` table.

### Single-session logout

Logout currently deletes **all** refresh tokens for the user because the `refresh_token`
cookie is scoped to `path: /api/auth/refresh` and the browser does not send it to
`/api/auth/logout`. The effect is sign-out from all devices.

To enable per-session logout: either (a) widen the refresh cookie path to `/` and
delete only the matching record in logout, or (b) accept the current behaviour and
expose a separate "sessions" management endpoint.

### Access token invalidation

Issued access tokens remain valid until expiry (default 15 minutes) even after logout.
There is no blacklist. An attacker who captures an access token can use it for up to
15 minutes after the user has logged out.

Mitigations: keep the access token TTL short (current default is already 15 minutes),
and add a token blacklist backed by Redis or a DB table if stricter invalidation is
required.

### No rate limiting

Auth endpoints have no rate limiting. Brute-force attacks against `/api/auth/login` and
`/api/auth/refresh` are currently unrestricted. Recommended next step: add rate limiting
middleware using a sliding-window counter in Redis or a provider-level WAF rule.

### No account lockout

There is no mechanism to lock an account after repeated failed login attempts.

### No device management UI

Users cannot view or selectively revoke individual sessions. All tokens can be revoked
only by logging out (which clears all sessions).
