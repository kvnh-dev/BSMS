'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Persona } from '@bsms/shared';
import { api, ApiError, setAccessToken } from './api-client';

interface CurrentUser {
  id: string;
  name: string;
  phone: string;
  personas: Persona[];
}

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPersona: (...personas: Persona[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // On load there's no access token yet — try the refresh cookie to
    // silently resume a session (see api-client.ts's apiFetch 401 retry).
    api
      .post<{ accessToken: string; user: CurrentUser }>('/auth/refresh')
      .then((res) => {
        setAccessToken(res.accessToken);
        setUser(res.user);
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(phone: string, password: string) {
    const res = await api.post<{ accessToken: string; user: CurrentUser }>('/auth/login', {
      phone,
      password,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  }

  function hasPersona(...personas: Persona[]) {
    if (!user) return false;
    return personas.some((p) => user.personas.includes(p));
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPersona }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
