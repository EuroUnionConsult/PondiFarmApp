import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as auth from './auth';
import { clearCloudCache } from './api';
import { startAutoSync, stopAutoSync } from './sync';

interface AuthState {
  token: string | null;
  user: auth.AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Relê o /me. Se a conta passou a membro ativo (criou organização ou foi
   * aprovada), troca primeiro o token por um que já traz a organização. */
  refreshMe: () => Promise<auth.AuthUser | null>;
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

  // O auto-sync só faz sentido para um membro ATIVO: sem organização (ou à
  // espera de aprovação) cada tentativa seria um 403 garantido. Offline, sem
  // /me, mantém-se o comportamento antigo: com token, sincroniza quando puder.
  const canSync = !!token && (user === null || user.membershipStatus === 'active');
  useEffect(() => {
    if (canSync) startAutoSync();
    else stopAutoSync();
    return () => stopAutoSync();
  }, [canSync]);

  const refreshMe = useCallback(async () => {
    let me = await auth.fetchMe();
    if (me?.membershipStatus === 'active') {
      const tokenOrg = await auth.getOrganizationId();
      if (!tokenOrg) {
        await auth.refreshToken();
        setToken(await auth.getToken());
        me = await auth.fetchMe();
      }
    }
    setUser(me);
    return me;
  }, []);

  // À espera de aprovação: a pessoa usa a app (scans ficam no telemóvel) e esta
  // verificação corre em fundo. Quando o Líder aprova, o refreshMe troca o token,
  // o estado passa a `active`, o sync liga-se e envia os scans guardados.
  const isPending = user?.membershipStatus === 'pending';
  useEffect(() => {
    if (!isPending) return;
    const id = setInterval(() => { void refreshMe(); }, 30_000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void refreshMe(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [isPending, refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    await auth.login(email, password);
    setToken(await auth.getToken());
    setUser(await auth.fetchMe());
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await auth.register(name, email, password);
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
    <AuthCtx.Provider value={{ token, user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthCtx);
  if (!value) throw new Error('useAuth deve estar dentro de AuthProvider');
  return value;
}
