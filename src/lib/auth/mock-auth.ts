'use client';

// TODO: Chapter 6 — replace mock with real API calls

import React, { createContext, useContext, useState, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  function logout() {
    setUser(null);
  }

  // React.createElement avoids JSX in a .ts file (no .tsx extension needed).
  return React.createElement(
    AuthContext.Provider,
    { value: { user, isLoading: false, logout } },
    children,
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
