import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getBackendUrl } from './api';
import { setServerUnavailable, trackServerRequest } from './serverWake';
import { TOKEN_KEY, webToken } from './session';

// iPhone: token no Keychain (expo-secure-store). Web: não há Keychain; o token fica no
// sessionStorage (acaba com a sessão do browser) ou, com «Keep me signed in», no
// localStorage — sempre sujeito à saída por inatividade (lib/session.ts).
// A passagem para cookie httpOnly está planeada para a 0.14.0.
const WEB = Platform.OS === 'web';

export type MembershipStatus = 'active' | 'pending' | 'none';
export type OrgRole = 'leader' | 'member';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /** `active` = membro de uma organização · `pending` = pediu entrada · `none` = ainda não escolheu. */
  membershipStatus: MembershipStatus;
  /** null quando não é membro ativo, ou num backend antigo que ainda não devolve o papel. */
  role: OrgRole | null;
  organizationId: string | null;
  organizationName: string;
  pendingOrganizationId: string | null;
  pendingOrganizationName: string | null;
}

/** O backend anterior a 21/10/2026 não devolve membershipStatus nem role:
 * aí, ter organização = membro ativo, papel desconhecido. */
function normalizeMe(raw: any): AuthUser {
  const organizationId = raw?.organizationId || null;
  const status: MembershipStatus =
    raw?.membershipStatus ?? (organizationId ? 'active' : 'none');
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? ''),
    email: String(raw?.email ?? ''),
    membershipStatus: status,
    role: raw?.role === 'leader' || raw?.role === 'member' ? raw.role : null,
    organizationId,
    organizationName: String(raw?.organizationName ?? ''),
    pendingOrganizationId: raw?.pendingOrganizationId ?? null,
    pendingOrganizationName: raw?.pendingOrganizationName ?? null,
  };
}

export async function getToken(): Promise<string | null> {
  if (WEB) return webToken.get();
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}

/** Web: `remember` decide sessionStorage (false) ou localStorage (true); sem ele, fica onde estava. */
export async function setToken(t: string, remember?: boolean): Promise<void> {
  if (WEB) { webToken.set(t, remember ?? webToken.remembered()); return; }
  await SecureStore.setItemAsync(TOKEN_KEY, t);
}

export async function clearToken(): Promise<void> {
  if (WEB) { webToken.clear(); return; }
  // Nunca lança: se o Keychain recusar apagar, o logout tem de sair na mesma.
  // Nesse caso sobrescreve com vazio, que o getToken() lê como sem sessão.
  try { await SecureStore.deleteItemAsync(TOKEN_KEY); }
  catch { try { await SecureStore.setItemAsync(TOKEN_KEY, ''); } catch {} }
}

/** Cabeçalho Authorization se houver token (para anexar em requests autenticados). */
export async function authHeaders(): Promise<Record<string, string>> {
  const t = await getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Decodifica o payload de um JWT (base64url) sem dependência externa. */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    // global.atob existe no Hermes (RN 0.76 / SDK 54).
    const json = decodeURIComponent(
      Array.from(atob(b64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Dono da sessão atual (claims `sub` e `org` do token). Marca os scans locais com quem os fez. */
export async function getSessionOwner(): Promise<{ userId: string | null; orgId: string | null }> {
  const t = await getToken();
  const p = t ? decodeJwtPayload(t) : null;
  return { userId: p?.sub ? String(p.sub) : null, orgId: p?.org ? String(p.org).toLowerCase() : null };
}

/** Org do usuário logado, derivada do claim `org` do token (multi-tenant). */
export async function getOrganizationId(): Promise<string | null> {
  const t = await getToken();
  if (!t) return null;
  return decodeJwtPayload(t)?.org ?? null;
}

async function base(): Promise<string> {
  return (await getBackendUrl()).trim().replace(/\/+$/, '');
}

/** fetch com prazo (AbortController: `AbortSignal.timeout()` não existe no Hermes). */
async function fetchWithin(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Segundos do cabeçalho Retry-After (só a forma em segundos), em ms. */
export function retryAfterMs(res: Response): number | undefined {
  const n = Number(res.headers.get('Retry-After'));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120) * 1000 : undefined;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Mensagem para o ecrã de login quando a base ainda está a acordar. */
export const WAKING_MESSAGE = 'The server is starting up. This can take up to a minute after a quiet period — please try again.';

// Prazo total do login/registo enquanto a base acorda (503 «database_waking»).
const AUTH_WAKE_BUDGET_MS = 90_000;

async function postJson(path: string, body: unknown): Promise<any> {
  const started = Date.now();
  for (;;) {
    // 60 s: depois de uma hora parada, a base serverless leva 30–60 s a acordar e
    // o login é muitas vezes o 1.º pedido do dia (com 20 s falhava a meio).
    const res = await trackServerRequest(fetchWithin(`${await base()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
      body: JSON.stringify(body),
    }, 60000));
    const data = await res.json().catch(() => ({}));
    if (res.status === 503) {
      // A base está a acordar: espera o que o servidor pede e tenta outra vez, dentro do prazo.
      setServerUnavailable(true);
      const wait = retryAfterMs(res) ?? 5000;
      if (Date.now() - started + wait < AUTH_WAKE_BUDGET_MS) { await sleep(wait); continue; }
      throw new Error(WAKING_MESSAGE);
    }
    setServerUnavailable(false);
    if (!res.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${res.status}`);
    }
    return data;
  }
}

/** Web: `remember` = «Keep me signed in on this computer» (localStorage em vez de sessionStorage). */
export async function login(email: string, password: string, remember = false): Promise<void> {
  const data = await postJson('/api/v1/auth/login', { email: email.trim(), password });
  if (!data?.accessToken) throw new Error('Resposta sem token');
  await setToken(data.accessToken, remember);
}

/** Cria a conta SEM organização: a seguir a pessoa cria uma ou pede entrada. */
export async function register(name: string, email: string, password: string, remember = false): Promise<void> {
  const data = await postJson('/api/v1/auth/register', {
    name: name.trim(),
    email: email.trim(),
    password,
  });
  if (!data?.accessToken) throw new Error('Resposta sem token');
  await setToken(data.accessToken, remember);
}

/**
 * Resultado do /me. Antes era `AuthUser | null` para tudo (401, 5xx, sem rede), e a app
 * tratava uma base a acordar como «sem utilizador»: avatar «?», «Organization —» e o
 * rebanho em cache como se fosse atual.
 * - `ok`: conta lida.
 * - `unauthorized`: token inválido/expirado (ou sem token) → sair.
 * - `unavailable`: servidor a acordar (503), erro 5xx, timeout ou sem rede → tentar outra vez.
 *   `network` = nem chegou ao servidor (o iPhone segue offline).
 */
export type MeResult =
  | { status: 'ok'; user: AuthUser }
  | { status: 'unauthorized' }
  | { status: 'unavailable'; retryAfterMs?: number; network: boolean };

export async function fetchMeResult(): Promise<MeResult> {
  const headers = await authHeaders();
  if (!headers.Authorization) return { status: 'unauthorized' };
  let res: Response;
  try {
    res = await trackServerRequest(fetchWithin(`${await base()}/api/v1/auth/me`, {
      headers: { ...headers, 'bypass-tunnel-reminder': 'true' },
    }, 20000));
  } catch (e: any) {
    // AbortError = o servidor não respondeu a tempo (a acordar); TypeError = sem rede/CORS.
    return { status: 'unavailable', network: e?.name !== 'AbortError' };
  }
  if (res.ok) {
    try {
      const user = normalizeMe(await res.json());
      setServerUnavailable(false);
      return { status: 'ok', user };
    } catch {
      return { status: 'unavailable', network: false };
    }
  }
  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    if (res.status === 503) setServerUnavailable(true);
    return { status: 'unavailable', retryAfterMs: retryAfterMs(res), network: false };
  }
  // 401 (token inválido/expirado) e qualquer outro 4xx: a sessão não serve.
  return { status: 'unauthorized' };
}

/** Compatível com o código antigo: a conta, ou null se não foi possível lê-la. */
export async function fetchMe(): Promise<AuthUser | null> {
  const r = await fetchMeResult();
  return r.status === 'ok' ? r.user : null;
}

/** Novo token com a organização atual — depois de criar uma organização ou de
 * o pedido de entrada ser aprovado (o token antigo não traz a organização).
 * Com prazo: antes podia ficar pendurado para sempre com a base a acordar. */
export async function refreshToken(): Promise<void> {
  const headers = await authHeaders();
  if (!headers.Authorization) return;
  const res = await trackServerRequest(fetchWithin(`${await base()}/api/v1/auth/token/refresh`, {
    method: 'POST',
    headers: { ...headers, 'bypass-tunnel-reminder': 'true' },
  }, 30000));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.accessToken) await setToken(data.accessToken);
}
