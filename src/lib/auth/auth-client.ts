export type Gender = 'male' | 'female';

export interface User {
  id: string;
  email: string;
  name: string;
  gender?: Gender;
  createdAt?: string;
  provider?: string | null;
}

export class AuthError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(opts: { message: string; status: number; code?: string }) {
    super(opts.message);
    this.name = 'AuthError';
    this.status = opts.status;
    this.code = opts.code;
  }
}

// Undefined until AuthProvider configures it after the initial session check.
// This prevents the initial getMe() 401 from triggering a redirect.
let _onUnauthenticated: (() => void) | undefined;

export function configureAuthClient(opts: { onUnauthenticated: () => void }): void {
  _onUnauthenticated = opts.onUnauthenticated;
}

async function parseErrorBody(res: Response): Promise<AuthError> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return new AuthError({
    message: body.error ?? res.statusText,
    code: body.code,
    status: res.status,
  });
}

// Module-level promise deduplicates concurrent refresh attempts.
let _refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

interface AuthFetchInit extends RequestInit {
  // Prevents a 401 from triggering refresh — use for login/register where 401 = bad credentials.
  skipRefresh?: boolean;
}

async function doFetch(
  input: RequestInfo,
  init: RequestInit,
  skipRefresh: boolean,
  isRetry: boolean,
): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' });

  if (res.status === 401 && !skipRefresh && !isRetry) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      return doFetch(input, init, skipRefresh, true);
    }
    _onUnauthenticated?.();
    throw new AuthError({ message: 'Session expired', status: 401, code: 'SESSION_EXPIRED' });
  }

  return res;
}

export async function authFetch(
  input: RequestInfo,
  { skipRefresh = false, ...init }: AuthFetchInit = {},
): Promise<Response> {
  return doFetch(input, init, skipRefresh, false);
}

// ── Named methods ───────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<User> {
  const res = await authFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    skipRefresh: true,
  });
  if (!res.ok) throw await parseErrorBody(res);
  const { user } = (await res.json()) as { user: User };
  return user;
}

export async function register(
  email: string,
  password: string,
  name: string,
  gender?: Gender,
): Promise<User> {
  const res = await authFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, ...(gender ? { gender } : {}) }),
    skipRefresh: true,
  });
  if (!res.ok) throw await parseErrorBody(res);
  const { user } = (await res.json()) as { user: User };
  return user;
}

export async function logout(): Promise<void> {
  await authFetch('/api/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<User> {
  const res = await authFetch('/api/auth/me');
  if (!res.ok) throw await parseErrorBody(res);
  const { user } = (await res.json()) as { user: User };
  return user;
}

export interface UpdateProfilePayload {
  name: string;
  gender?: Gender | null;
  password?: string;
  confirmPassword?: string;
}

export async function updateProfile(data: UpdateProfilePayload): Promise<User> {
  const res = await authFetch('/api/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await parseErrorBody(res);
  const { user } = (await res.json()) as { user: User };
  return user;
}
