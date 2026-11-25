import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as auth from './auth';
import { clearCloudCache } from './api';
import { startAutoSync, stopAutoSync } from './sync';
import { trackCloud } from './activity';
import { setServerUnavailable } from './serverWake';
import { showToast } from '../components/Toast';
import {
  answerTokenRequests, clearActivity, clearWebOrgData, idleLabel, markActivity, onSession,
  postSession, requestTokenFromOtherTabs, sessionExpired, webToken,
} from './session';

const WEB = Platform.OS === 'web';

/**
 * Ligação ao servidor no arranque (e depois de entrar):
 * - `ok`: a conta foi lida (ou o iPhone segue offline).
 * - `connecting`: o servidor ainda não respondeu (base a acordar) — ecrã de espera.
 * - `failed`: ao fim de ~2 min continua sem resposta — «Can't reach the server · Retry».
 */
export type Connection = 'ok' | 'connecting' | 'failed';

export type LogoutReason = 'user' | 'idle' | 'expired' | 'unauthorized' | 'remote';

interface AuthState {
  token: string | null;
  user: auth.AuthUser | null;
  /** true até se saber quem é a pessoa (ou até desistir de esperar pelo servidor). */
  loading: boolean;
  connection: Connection;
  /** «Retry» do ecrã «Can't reach the server». */
  retryConnect: () => void;
  /** iPhone: entrar sem esperar pelo servidor (os scans ficam no telemóvel). */
  continueOffline?: () => void;
  /** `remember` (web) = «Keep me signed in on this computer». */
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string, remember?: boolean) => Promise<void>;
  logout: (reason?: LogoutReason) => Promise<void>;
  /** Relê o /me. Se a conta passou a membro ativo (criou organização ou foi
   * aprovada), troca primeiro o token por um que já traz a organização. */
  refreshMe: () => Promise<auth.AuthUser | null>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

/** Espera entre tentativas de ler a conta enquanto o servidor acorda. */
const CONNECT_BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];
/** Ao fim disto sem resposta: ecrã «Can't reach the server». */
const CONNECT_GIVE_UP_MS = 120_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<auth.AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<Connection>('ok');
  // Cada ciclo de ligação tem um número: logout, «Retry» ou «Continue offline» cancelam o anterior.
  const gen = useRef(0);
  const userRef = useRef<auth.AuthUser | null>(null);
  userRef.current = user;

  const logout = useCallback(async (reason: LogoutReason = 'user') => {
    gen.current += 1;
    // O cache da nuvem é por organização, mas não deve sobreviver ao logout:
    // parar o auto-sync antes evita que um push em curso o volte a escrever.
    stopAutoSync();
    try {
      await auth.clearToken();
      await clearCloudCache();
      if (WEB) { clearWebOrgData(); clearActivity(); }
    } finally {
      // Sai SEMPRE do ecrã da app, mesmo que limpar o armazenamento falhe.
      setToken(null);
      setUser(null);
      setConnection('ok');
      setLoading(false);
      setServerUnavailable(false);
    }
    // Web: os outros separadores saem também (menos quando a ordem veio de lá).
    if (WEB && reason !== 'remote') postSession({ type: 'logout', reason: reason === 'unauthorized' ? 'unauthorized' : reason });
    if (reason === 'idle' || reason === 'expired') {
      showToast({ tone: 'warning', title: `Signed out after ${idleLabel()} of inactivity`, detail: 'Sign in again to continue.', durationMs: 8000 });
    }
  }, []);

  /** Lê a conta. Nunca troca uma conta boa por null quando a releitura falha. */
  const reloadMe = useCallback(async (): Promise<auth.MeResult> => {
    let r = await auth.fetchMeResult();
    if (r.status === 'ok') {
      // O token tem de trazer a organização ATUAL. Difere quando a pessoa foi
      // aprovada (token sem org), criou uma, saiu ou foi removida (token ainda
      // com a antiga) ou mudou de organização. Sem isto: 403 em tudo e o
      // rebanho em cache da organização antiga (revisão do PR #113).
      const me = r.user;
      const tokenOrg = ((await auth.getOrganizationId()) || '').toLowerCase();
      const current = me.membershipStatus === 'active' ? (me.organizationId || '').toLowerCase() : '';
      if (tokenOrg !== current) {
        await clearCloudCache();
        try {
          await auth.refreshToken();
          setToken(await auth.getToken());
          const again = await auth.fetchMeResult();
          if (again.status === 'ok') r = again;
        } catch {
          // Sem rede: tenta outra vez na próxima verificação. A cache já foi limpa.
        }
      }
      setUser(r.status === 'ok' ? r.user : me);
    }
    return r;
  }, []);

  /**
   * Arranque / depois de entrar: lê a conta com espera crescente (2/4/8/16/30 s, ou o
   * Retry-After do servidor) até ~2 min. 401 → sai. iPhone sem rede → segue offline
   * (uso no campo); com o servidor a acordar mostra «Connecting to the server…».
   */
  const establish = useCallback(async () => {
    const my = ++gen.current;
    const started = Date.now();
    let step = 0;
    setLoading(true);
    for (;;) {
      const r = await reloadMe();
      if (gen.current !== my) return;
      if (r.status === 'ok') { setConnection('ok'); setLoading(false); return; }
      if (r.status === 'unauthorized') { await logout('unauthorized'); return; }
      if (!WEB && r.network) {
        // iPhone offline-first: sem rede entra na app; o /me volta a ser lido ao voltar ao 1.º plano.
        setConnection('ok'); setLoading(false); return;
      }
      setConnection('connecting');
      const elapsed = Date.now() - started;
      if (elapsed >= CONNECT_GIVE_UP_MS) { setConnection('failed'); return; }
      const wait = Math.min(
        Math.max(CONNECT_BACKOFF_MS[Math.min(step, CONNECT_BACKOFF_MS.length - 1)], r.retryAfterMs ?? 0),
        CONNECT_GIVE_UP_MS - elapsed,
      );
      step += 1;
      await new Promise((res) => setTimeout(res, wait));
      if (gen.current !== my) return;
    }
  }, [reloadMe, logout]);

  useEffect(() => {
    (async () => {
      let t = await auth.getToken();
      if (WEB) {
        // Separador novo sem token próprio: pede-o a um separador aberto do mesmo site.
        if (!t) {
          const shared = await requestTokenFromOtherTabs();
          if (shared) { webToken.set(shared, false); t = shared; }
        }
        // Sessão parada há mais de 30 min (+ aviso): não abre sem novo login.
        if (t && sessionExpired()) { await logout('expired'); return; }
        // Sem sessão: nada da organização fica no browser antes do login.
        if (!t) clearWebOrgData();
        else markActivity(true);
      }
      if (t) {
        setToken(t);
        // reloadMe (não só fetchMe): quem foi aprovado, removido ou mudou de
        // organização com a app FECHADA abre já com o token certo. Antes ficava
        // «Member» com o token antigo e tudo dava 403 até voltar ao 1.º plano.
        await establish();
      } else {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Web: logout noutro separador sai aqui também; separadores novos pedem o token.
  useEffect(() => {
    if (!WEB) return;
    const offAnswer = answerTokenRequests();
    const offLogout = onSession((m) => {
      if (m.type !== 'logout') return;
      void logout('remote').then(() => {
        if (m.reason === 'idle' || m.reason === 'expired') {
          showToast({ tone: 'warning', title: `Signed out after ${idleLabel()} of inactivity`, detail: 'Sign in again to continue.', durationMs: 8000 });
        }
      });
    });
    return () => { offAnswer(); offLogout(); };
  }, [logout]);

  // O auto-sync só faz sentido para um membro ATIVO: sem organização (ou à
  // espera de aprovação) cada tentativa seria um 403 garantido. Offline, sem
  // /me, mantém-se o comportamento antigo: com token, sincroniza quando puder.
  const canSync = !!token && !loading && (user === null || user.membershipStatus === 'active');
  useEffect(() => {
    if (canSync) startAutoSync();
    else stopAutoSync();
    return () => stopAutoSync();
  }, [canSync]);

  // Acende o anel do avatar enquanto relê a conta. Uma falha não apaga a conta já lida;
  // só um 401 faz sair.
  const refreshMe = useCallback(() => trackCloud((async () => {
    const r = await reloadMe();
    if (r.status === 'unauthorized') { await logout('unauthorized'); return null; }
    return r.status === 'ok' ? r.user : userRef.current;
  })()), [reloadMe, logout]);

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
    if (!token || loading) return;
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void refreshMe(); });
    return () => sub.remove();
  }, [token, loading, refreshMe]);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    await auth.login(email, password, remember);
    if (WEB) markActivity(true);
    setToken(await auth.getToken());
    await establish();
  }, [establish]);

  const register = useCallback(
    async (name: string, email: string, password: string, remember = false) => {
      await auth.register(name, email, password, remember);
      if (WEB) markActivity(true);
      setToken(await auth.getToken());
      await establish();
    },
    [establish],
  );

  const retryConnect = useCallback(() => { void establish(); }, [establish]);
  const continueOffline = useCallback(() => {
    gen.current += 1;
    setConnection('ok');
    setLoading(false);
  }, []);

  return (
    <AuthCtx.Provider value={{
      token, user, loading, connection, retryConnect,
      continueOffline: WEB ? undefined : continueOffline,
      login, register, logout, refreshMe,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthCtx);
  if (!value) throw new Error('useAuth deve estar dentro de AuthProvider');
  return value;
}
