# Auth Architecture

## Overview

Stateless JWT authentication with two tokens — a short-lived **access token** and a
long-lived **refresh token** — stored as `httpOnly` cookies. No server-side sessions,
no Auth.js / NextAuth, no Passport.

Two login paths are supported:

- **Email + password** — classic credential flow with bcrypt.
- **OAuth 2.0** — Yandex and VKontakte. The server exchanges the provider code for a
  user profile, then issues the same JWT pair. No third-party session is kept.

The architecture is intentionally boring: two signed JWTs, two DB columns, seven API
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
| `password_hash` | `text` | nullable — NULL for OAuth-only accounts |
| `provider` | `text` | nullable (`'yandex'` \| `'vk'`) |
| `provider_id` | `text` | nullable — user ID from the OAuth provider |
| `gender` | `gender` enum | nullable (`'male' \| 'female'`) |
| `created_at` | `timestamp` | `DEFAULT now()` |

A partial unique index on `(provider, provider_id) WHERE provider IS NOT NULL` prevents
duplicate OAuth accounts while allowing multiple email+password users (where both
columns are NULL).

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
        text password_hash "nullable"
        text provider "nullable"
        text provider_id "nullable"
        gender gender "nullable"
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
    S->>S: registerBodySchema.safeParse(body) — Zod validation
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
    S->>S: loginBodySchema.safeParse(body) — Zod validation
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

### OAuth Login (Yandex / VK)

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant R as GET /api/auth/{provider}
    participant P as OAuth Provider
    participant CB as GET /api/auth/{provider}/callback
    participant DB as PostgreSQL

    U->>R: Click "Войти через Яндекс / ВКонтакте"
    R->>R: generateState() — nanoid(32)
    R-->>U: 302 → provider /authorize?...&state=<s><br>Set-Cookie: oauth_state=<s>; httpOnly; maxAge=600

    U->>P: Follow redirect (user logs in / consents)
    P-->>U: 302 → /api/auth/{provider}/callback?code=<c>&state=<s>

    U->>CB: GET /callback?code=<c>&state=<s><br>Cookie: oauth_state=<s>
    CB->>CB: Verify state === cookie — reject if mismatch (CSRF guard)
    CB->>P: POST /token — exchange code → access_token
    CB->>P: GET /userinfo — fetch id, name, email
    CB->>DB: SELECT * FROM users WHERE provider=? AND provider_id=?
    alt User exists
        DB-->>CB: existing user row
    else Email already registered (different login method)
        CB->>DB: UPDATE users SET provider, provider_id WHERE email=?
    else New user
        CB->>DB: INSERT INTO users (email, name, provider, provider_id)
    end
    CB->>CB: signAccessToken + signRefreshToken
    CB->>DB: INSERT INTO refresh_tokens
    CB-->>U: 302 → /<br>Set-Cookie: access_token + refresh_token<br>Delete-Cookie: oauth_state
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
    "createdAt": "2024-01-15T10:00:00.000Z",
    "provider": null
  }
}
```

`passwordHash` is never returned. `provider` is `null` for email+password accounts, or `"yandex"` / `"vk"` for OAuth accounts.

**Error codes**

| Status | `code` | Reason |
|---|---|---|
| 401 | `NO_TOKEN` | Cookie absent |
| 401 | `INVALID_TOKEN` | JWT expired or signature invalid |
| 500 | — | Unexpected server error |

---

### `PATCH /api/auth/me`

Updates the authenticated user's profile. Requires `access_token` cookie.

**Request body**

```json
{
  "name": "Alice",
  "gender": "female",
  "password": "newpassword",
  "confirmPassword": "newpassword"
}
```

`gender` is optional (pass `null` to clear). `password` + `confirmPassword` are optional and only
processed for users without a provider (`provider === null`). Minimum password length: 8. Both
fields must match.

**Validation:** `updateProfileBodySchema` (Zod) — `name` must be non-empty.

**Response `200`**

```json
{
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "name": "Alice",
    "gender": "female",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "provider": null
  }
}
```

**Error codes**

| Status | `code` | Reason |
|---|---|---|
| 400 | — | Validation error (empty name, password mismatch, etc.) |
| 401 | `NO_TOKEN` | Cookie absent |
| 401 | `INVALID_TOKEN` | JWT expired or signature invalid |
| 404 | — | User not found |
| 500 | — | Unexpected server error |

---

### `GET /api/auth/yandex`

Initiates the Yandex OAuth 2.0 flow. Generates a `state` token, stores it in an
`httpOnly` cookie, and redirects the browser to Yandex's authorization endpoint.

**Request:** none (browser navigation).

**Response:** `302` redirect to `https://oauth.yandex.ru/authorize`.

---

### `GET /api/auth/yandex/callback`

Handles the redirect back from Yandex. Verifies the `state` parameter, exchanges the
authorization code for a Yandex access token, fetches the user profile from
`https://login.yandex.ru/info`, and issues app session cookies.

**Query params (set by Yandex):** `code`, `state`

**Success response:** `302` redirect to `/` with `access_token` + `refresh_token` cookies set.

**Error responses:** `302` redirect to `/?auth_error=<reason>`

| `auth_error` | Reason |
|---|---|
| `invalid_state` | `state` mismatch or cookie absent — possible CSRF attempt |
| `yandex_failed` | Token exchange or user-info request failed |

---

### `GET /api/auth/vk`

Initiates the VKontakte OAuth 2.0 flow. Requests the `email` scope. Generates a `state`
token, stores it in an `httpOnly` cookie, and redirects to VK's authorization endpoint.

**Request:** none (browser navigation).

**Response:** `302` redirect to `https://oauth.vk.com/authorize`.

---

### `GET /api/auth/vk/callback`

Handles the redirect back from VK. Verifies `state`, exchanges the code for a VK access
token (which also carries the email if the user granted it), fetches the user's name via
`https://api.vk.com/method/users.get`, and issues app session cookies.

If VK does not return an email (user denied the permission), the account is stored with
a stable placeholder address `vk_<user_id>@vk.placeholder.local`.

**Query params (set by VK):** `code`, `state`

**Success response:** `302` redirect to `/` with `access_token` + `refresh_token` cookies set.

**Error responses:** `302` redirect to `/?auth_error=<reason>`

| `auth_error` | Reason |
|---|---|
| `invalid_state` | `state` mismatch or cookie absent |
| `vk_failed` | Token exchange or user-info request failed |

---

## File Structure

```
src/
├── middleware.ts                    # Edge middleware: JWT check, redirects /profile and /dashboard to / on failure
│
├── schemas/
│   └── auth.ts                      # Zod schemas: registerBodySchema, loginBodySchema, updateProfileBodySchema
│                                    # All API body types are inferred from these with z.infer<>
│
├── lib/
│   └── auth/
│       ├── jwt.ts                   # signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, JwtPayload
│       ├── cookies.ts               # setAuthCookies, clearAuthCookies, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE
│       ├── hash.ts                  # hashToken, compareToken — SHA-256 pre-hash + bcrypt for refresh token storage
│       └── oauth.ts                 # findOrCreateOAuthUser, issueSessionForUser, generateState, setStateCookie
│
├── db/
│   ├── index.ts                     # Drizzle singleton instance (postgres-js driver)
│   └── schema/
│       ├── index.ts                 # Re-exports all tables
│       ├── users.ts                 # users table + genderEnum (password_hash nullable, provider/provider_id added)
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
            ├── me/
            │   └── route.ts         # GET — verify access token, return user (id, email, name, gender, createdAt, provider)
            │                        # PATCH — update name, gender; change password (own-account users only)
            ├── yandex/
            │   ├── route.ts         # GET — generate state, redirect to oauth.yandex.ru/authorize
            │   └── callback/
            │       └── route.ts     # GET — verify state, exchange code, upsert user, issue tokens
            └── vk/
                ├── route.ts         # GET — generate state, redirect to oauth.vk.com/authorize
                └── callback/
                    └── route.ts     # GET — verify state, exchange code, upsert user, issue tokens
```

---

## Environment Variables

### Core

| Variable | Description | Example value | Required |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | HMAC-SHA256 signing key for access tokens. Generate: `openssl rand -base64 32` | `v3ryS3cr3t...` | Yes |
| `JWT_REFRESH_SECRET` | HMAC-SHA256 signing key for refresh tokens. Must differ from access secret. | `an0th3rS3cr3t...` | Yes |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL — jose duration string | `15m` | Yes |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL — jose duration string | `7d` | Yes |
| `DATABASE_URL` | PostgreSQL connection URL used by Drizzle + postgres-js | `postgresql://user:pass@host:5432/db` | Yes |
| `APP_URL` | Full base URL of the app — used to build OAuth callback redirect URIs | `http://localhost:3000` | Yes |

jose duration string format: `<number><unit>` where unit is `s` (seconds), `m` (minutes),
`h` (hours), `d` (days). Example: `15m`, `1h`, `7d`.

### OAuth Providers

| Variable | Description | Required |
|---|---|---|
| `YANDEX_CLIENT_ID` | OAuth app client ID from [oauth.yandex.ru](https://oauth.yandex.ru/client/new) | Yes (for Yandex login) |
| `YANDEX_CLIENT_SECRET` | OAuth app client secret from Yandex | Yes (for Yandex login) |
| `VK_CLIENT_ID` | App ID from [vk.com/editapp](https://vk.com/editapp?act=create) | Yes (for VK login) |
| `VK_CLIENT_SECRET` | Secure key from the VK app settings | Yes (for VK login) |

#### Registering OAuth apps

**Yandex** — [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new)

1. Create a new app, choose "Web services".
2. Under **Callback URIs** add: `{APP_URL}/api/auth/yandex/callback`
3. Under **Data access** enable: **Email address** (`login:email`), **Username, name** (`login:info`).
4. Copy the **ClientID** → `YANDEX_CLIENT_ID` and **Client secret** → `YANDEX_CLIENT_SECRET`.

**VK** — [vk.com/editapp?act=create](https://vk.com/editapp?act=create)

1. Create a new app, type **Website**.
2. Set **Base domain** to your domain (e.g. `localhost` for dev).
3. Set **Authorized redirect URI** to: `{APP_URL}/api/auth/vk/callback`
4. Go to **Settings** tab. Copy **App ID** → `VK_CLIENT_ID` and **Secure key** → `VK_CLIENT_SECRET`.
5. The `email` scope is requested at runtime; no extra setting is needed in the app dashboard.

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

### OAuth state parameter (CSRF protection)

Before redirecting to the provider, the server generates a `nanoid(32)` state token,
sets it as an `httpOnly; sameSite=lax` cookie with a 10-minute expiry, and passes it as
the `state` query parameter in the authorization URL. The callback route compares the
`state` query param against the cookie value and aborts with a redirect to
`/?auth_error=invalid_state` if they differ or the cookie is absent.

This prevents cross-site request forgery attacks where a malicious page could craft a
callback URL with a valid provider code but trick the victim's browser into completing
the login.

`sameSite: lax` is sufficient here: the callback is a top-level GET navigation
(triggered by the provider's redirect), which browsers permit under `lax`. A CSRF
request from a third-party site would be a cross-origin non-navigation request and
would not carry the `lax` cookie.

### Account linking on first OAuth login

When a user logs in via OAuth for the first time, `findOrCreateOAuthUser` checks:

1. Does a row with `(provider, provider_id)` already exist? → return it.
2. Does a row with the same email exist (e.g. the user registered via email+password)?
   → attach `provider`/`provider_id` to that row and return it. The user now has both
   login methods on the same account.
3. Neither → insert a new user row without a `password_hash`.

This means a user who registered with `alice@example.com` and later clicks
"Войти через Яндекс" (where Yandex also returns `alice@example.com`) will be
transparently linked — no duplicate account is created.

### VK users without an email

VK returns the email as part of the token response only when the user grants the
`email` scope during authorization. If they deny it (or the scope is not available),
the callback generates a stable placeholder address of the form
`vk_<user_id>@vk.placeholder.local`. This address satisfies the NOT NULL / UNIQUE
constraint on `users.email` while being clearly synthetic. The user is still uniquely
identified by `(provider='vk', provider_id='<user_id>')` and the account links
correctly on subsequent logins.

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

### No PKCE for OAuth

The OAuth flow uses a random `state` parameter for CSRF protection but does not
implement PKCE (Proof Key for Code Exchange). PKCE is recommended for public clients
(SPAs, mobile apps) where the client secret cannot be kept confidential. Here the code
exchange happens server-side (the client secret is only on the server), so PKCE is not
strictly required — but adding it would provide defense-in-depth against authorization
code interception.

### No per-provider account unlinking

Once a provider is linked to an account (`provider`/`provider_id` set), there is no
endpoint to unlink it. A user who wants to switch from OAuth-only to email+password (or
vice versa) must be handled manually at the database level. An account settings page
with an unlink flow would require a dedicated endpoint.

### OAuth tokens are not stored

The provider access token returned during the OAuth callback is used once to fetch the
user profile and then discarded. If future features need to call provider APIs on behalf
of the user (e.g. posting to VK), the token would need to be persisted — ideally in a
separate `oauth_tokens` table with encrypted storage.
