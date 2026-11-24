import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as auth from './auth';
import { clearCloudCache } from './api';
import { startAutoSync, stopAutoSync } from './sync';
import { trackCloud } from './activity';

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
        // reloadMe (não só fetchMe): quem foi aprovado, removido ou mudou de
        // organização com a app FECHADA abre já com o token certo. Antes ficava
        // «Member» com o token antigo e tudo dava 403 até voltar ao 1.º plano.
        await reloadMe();
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

  // Só usa setters de estado (estáveis), por isso a 1.ª versão serve sempre.
  const reloadMe = async () => {
    let me = await auth.fetchMe();
    if (me) {
      // O token tem de trazer a organização ATUAL. Difere quando a pessoa foi
      // aprovada (token sem org), criou uma, saiu ou foi removida (token ainda
      // com a antiga) ou mudou de organização. Sem isto: 403 em tudo e o
      // rebanho em cache da organização antiga (revisão do PR #113).
      const tokenOrg = ((await auth.getOrganizationId()) || '').toLowerCase();
      const current = me.membershipStatus === 'active' ? (me.organizationId || '').toLowerCase() : '';
      if (tokenOrg !== current) {
        await clearCloudCache();
        try {
          await auth.refreshToken();
          setToken(await auth.getToken());
          me = (await auth.fetchMe()) ?? me;
        } catch {
          // Sem rede: tenta outra vez na próxima verificação. A cache já foi limpa.
        }
      }
    }
    setUser(me);
    return me;
  };

  // Acende o anel do avatar enquanto relê a conta.
  const refreshMe = useCallback(() => trackCloud(reloadMe()), []); // eslint-disable-line react-hooks/exhaustive-deps

  // À espera de aprovação: a pessoa usa a app (scans ficam no telemóvel) e esta
  // verificação corre em fundo. Quando o Líder aprova, o refreshMe troca o token,
  // o estado passa a `active`, o sync liga-se e envia os scans guardados.
  const isPending = user?.membershipStatus === 'pending';
  useEffect(() => {
    if (!isPending) return;
    const id = setInterval(() => { void refreshMe(); }, 30_000);
    return () => clearInterval(id);
  }, [isPending, refreshMe]);

  // Para TODOS com sessão: ao voltar ao 1.º plano, relê o /me. Assim quem foi
  // removido (ou mudou de papel) vê a mudança e perde a cache da organização,
  // em vez de continuar a ver o rebanho antigo guardado no telemóvel.
  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void refreshMe(); });
    return () => sub.remove();
  }, [token, refreshMe]);

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
    // O cache da nuvem é por organização, mas não deve sobreviver ao logout:
    // parar o auto-sync antes evita que um push em curso o volte a escrever.
    stopAutoSync();
    try {
      await auth.clearToken();
      await clearCloudCache();
    } finally {
      // Sai SEMPRE do ecrã da app, mesmo que limpar o armazenamento falhe.
      setToken(null);
      setUser(null);
    }
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
