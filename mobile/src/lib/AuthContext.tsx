import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as auth from './auth';
import { clearCloudCache } from './api';
import { startAutoSync, stopAutoSync } from './sync';

interface AuthState {
  token: string | null;
  user: auth.AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, org: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<auth.AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await auth.getToken();
      if (t) {
        setToken(t);
        setUser(await auth.fetchMe());
      }
      setLoading(false);
    })();
  }, []);

  // O auto-sync só faz sentido com sessão iniciada: sem token não há org nem
  // headers de autenticação, e cada tentativa seria um 401 garantido.
  useEffect(() => {
    if (token) startAutoSync();
    else stopAutoSync();
    return () => stopAutoSync();
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    await auth.login(email, password);
    setToken(await auth.getToken());
    setUser(await auth.fetchMe());
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, org: string) => {
      await auth.register(name, email, password, org);
      setToken(await auth.getToken());
      setUser(await auth.fetchMe());
    },
    [],
  );

  const logout = useCallback(async () => {
    await auth.clearToken();
    // O cache da nuvem é por organização, mas não deve sobreviver ao logout:
    // parar o auto-sync antes evita que um push em curso o volte a escrever.
    stopAutoSync();
    await clearCloudCache();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthCtx);
  if (!value) throw new Error('useAuth deve estar dentro de AuthProvider');
  return value;
}
