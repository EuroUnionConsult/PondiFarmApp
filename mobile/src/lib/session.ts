import { Platform } from 'react-native';

// Sessão no SITE (aprovado pelo Talys, 25/11/2026: «o sistema não pode abrir sem ter
// feito login»). No iPhone nada disto se aplica: a sessão fica no Keychain e não há
// saída por inatividade (uso no campo).
//
// - Sem «Keep me signed in»: o token fica no sessionStorage e acaba com a sessão do browser.
// - Com «Keep me signed in»: localStorage, mas sujeito na mesma à inatividade.
// - 30 min sem interação → aviso de 60 s → sai. A última atividade é partilhada por todos
//   os separadores (localStorage) e o logout vai a todos (BroadcastChannel).

const WEB = Platform.OS === 'web';

function seconds(v: string | undefined, fallback: number, min: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/**
 * Fonte única dos prazos da sessão web. Para testes manuais, o build pode encurtá-los com
 * EXPO_PUBLIC_IDLE_TIMEOUT_S / EXPO_PUBLIC_IDLE_WARNING_S (mínimos 10 s e 5 s).
 */
export const SESSION_TIMEOUTS = {
  /** Sem interação durante isto → aparece o aviso. */
  idleMs: seconds(process.env.EXPO_PUBLIC_IDLE_TIMEOUT_S, 30 * 60, 10) * 1000,
  /** Contagem do aviso até sair. */
  warnMs: seconds(process.env.EXPO_PUBLIC_IDLE_WARNING_S, 60, 5) * 1000,
} as const;

/** «30 minutes» / «20 seconds» para os textos (segue o prazo configurado). */
export function idleLabel(): string {
  const s = Math.round(SESSION_TIMEOUTS.idleMs / 1000);
  if (s % 60 === 0) { const m = s / 60; return `${m} minute${m === 1 ? '' : 's'}`; }
  return `${s} seconds`;
}

export const TOKEN_KEY = 'pondifarm_auth_token';
export const LAST_ACTIVITY_KEY = 'pondifarm_last_activity';
const CHANNEL = 'pondifarm-session';

function ls(): Storage | null { try { return WEB ? window.localStorage : null; } catch { return null; } }
function ss(): Storage | null { try { return WEB ? window.sessionStorage : null; } catch { return null; } }

// ---- token (web) ----

export const webToken = {
  get(): string | null {
    try { return ss()?.getItem(TOKEN_KEY) || ls()?.getItem(TOKEN_KEY) || null; } catch { return null; }
  },
  /** Onde o token atual está guardado (para o refresh do token manter o mesmo sítio). */
  remembered(): boolean {
    try { return !ss()?.getItem(TOKEN_KEY) && !!ls()?.getItem(TOKEN_KEY); } catch { return false; }
  },
  set(token: string, remember: boolean): void {
    try {
      if (remember) { ls()?.setItem(TOKEN_KEY, token); ss()?.removeItem(TOKEN_KEY); }
      else { ss()?.setItem(TOKEN_KEY, token); ls()?.removeItem(TOKEN_KEY); }
    } catch { /* armazenamento bloqueado: a sessão fica só nesta página */ }
  },
  clear(): void {
    try { ss()?.removeItem(TOKEN_KEY); } catch {}
    try { ls()?.removeItem(TOKEN_KEY); } catch {}
  },
};

// ---- última atividade (partilhada pelos separadores) ----

let lastWrite = 0;
/** Regista interação. Escreve no máximo de 5 em 5 s (`force` escreve já). */
export function markActivity(force = false): void {
  const now = Date.now();
  if (!force && now - lastWrite < 5000) return;
  lastWrite = now;
  try { ls()?.setItem(LAST_ACTIVITY_KEY, String(now)); } catch {}
}

export function lastActivity(): number | null {
  try {
    const n = Number(ls()?.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

/** Há quanto tempo ninguém mexe no site (em qualquer separador). Sem registo = sessão antiga, expirada. */
export function idleFor(): number {
  const last = lastActivity();
  return last === null ? Number.POSITIVE_INFINITY : Math.max(0, Date.now() - last);
}

export function sessionExpired(): boolean {
  return idleFor() >= SESSION_TIMEOUTS.idleMs + SESSION_TIMEOUTS.warnMs;
}

export function clearActivity(): void {
  lastWrite = 0;
  try { ls()?.removeItem(LAST_ACTIVITY_KEY); } catch {}
}

// ---- dados da organização em cache no browser ----

const ORG_DATA_PREFIXES = ['@pondifarm:cloudCache', '@pondifarm:weather', 'pondifarm.profile.', '@boviscan:scans'];

/** Web: apaga o rebanho, o tempo e os nomes guardados, para nada aparecer antes do login. */
export function clearWebOrgData(): void {
  const store = ls();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k) keys.push(k); }
    for (const k of keys) if (ORG_DATA_PREFIXES.some((p) => k.startsWith(p))) store.removeItem(k);
  } catch {}
}

// ---- mensagens entre separadores ----

export type SessionMessage =
  | { type: 'logout'; reason: 'user' | 'idle' | 'expired' | 'unauthorized' }
  | { type: 'token-request'; id: string }
  | { type: 'token-reply'; id: string; token: string };

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (!WEB || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) { try { channel = new BroadcastChannel(CHANNEL); } catch { return null; } }
  return channel;
}

export function postSession(msg: SessionMessage): void {
  try { getChannel()?.postMessage(msg); } catch {}
}

export function onSession(cb: (msg: SessionMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const h = (e: MessageEvent) => { if (e.data && typeof e.data.type === 'string') cb(e.data as SessionMessage); };
  ch.addEventListener('message', h);
  return () => ch.removeEventListener('message', h);
}

/**
 * Um separador novo não tem o sessionStorage dos outros: pede o token a um separador
 * aberto do mesmo site (BroadcastChannel só fala com a mesma origem). null ao fim de `ms`.
 */
export function requestTokenFromOtherTabs(ms = 250): Promise<string | null> {
  const ch = getChannel();
  if (!ch) return Promise.resolve(null);
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const off = onSession((m) => { if (m.type === 'token-reply' && m.id === id) { off(); clearTimeout(t); resolve(m.token); } });
    const t = setTimeout(() => { off(); resolve(null); }, ms);
    postSession({ type: 'token-request', id });
  });
}

/** Responde aos pedidos de token dos separadores novos (só com uma sessão válida). */
export function answerTokenRequests(): () => void {
  return onSession((m) => {
    if (m.type !== 'token-request') return;
    const token = webToken.get();
    if (token && !sessionExpired()) postSession({ type: 'token-reply', id: m.id, token });
  });
}
