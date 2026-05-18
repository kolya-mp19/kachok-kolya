'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  AuthError,
  configureAuthClient,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type Gender,
  type User,
} from './auth-client';

export type { Gender, User };
export { AuthError };

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, gender?: Gender) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount, then arm the redirect callback.
  // _onUnauthenticated is undefined during this call, so a 401
  // means "not logged in" — no redirect fires.
  useEffect(() => {
    let active = true;

    getMe()
      .then((u) => { if (active) setUser(u); })
      .catch((err: unknown) => {
        if (active && !(err instanceof AuthError && err.status === 401)) {
          console.warn('[auth] Failed to restore session:', err);
        }
        if (active) setUser(null);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
        // Arm the callback only after the initial check — subsequent 401s mean "expired".
        configureAuthClient({
          onUnauthenticated: () => {
            setUser(null);
            router.replace('/');
          },
        });
      });

    return () => { active = false; };
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const u = await apiLogin(email, password);
      setUser(u);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string, gender?: Gender) => {
      setError(null);
      setIsLoading(true);
      try {
        const u = await apiRegister(email, password, name, gender);
        setUser(u);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Registration failed';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setIsLoading(false);
      router.replace('/');
    }
  }, [router]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthState>(
    () => ({ user, isLoading, error, login, register, logout, clearError }),
    [user, isLoading, error, login, register, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
