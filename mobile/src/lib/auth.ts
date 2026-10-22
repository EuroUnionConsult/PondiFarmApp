import * as SecureStore from 'expo-secure-store';
import { getBackendUrl } from './api';

// Token no iOS Keychain (armazenamento seguro nativo) via expo-secure-store.
// Chave do SecureStore só aceita [A-Za-z0-9._-].
const TOKEN_KEY = 'pondifarm_auth_token';

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
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}

async function setToken(t: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, t);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
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

async function postJson(path: string, body: unknown): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${await base()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function login(email: string, password: string): Promise<void> {
  const data = await postJson('/api/v1/auth/login', { email: email.trim(), password });
  if (!data?.accessToken) throw new Error('Resposta sem token');
  await setToken(data.accessToken);
}

/** Cria a conta SEM organização: a seguir a pessoa cria uma ou pede entrada. */
export async function register(name: string, email: string, password: string): Promise<void> {
  const data = await postJson('/api/v1/auth/register', {
    name: name.trim(),
    email: email.trim(),
    password,
  });
  if (!data?.accessToken) throw new Error('Resposta sem token');
  await setToken(data.accessToken);
}

export async function fetchMe(): Promise<AuthUser | null> {
  const headers = await authHeaders();
  if (!headers.Authorization) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${await base()}/api/v1/auth/me`, {
      headers: { ...headers, 'bypass-tunnel-reminder': 'true' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return normalizeMe(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Novo token com a organização atual — depois de criar uma organização ou de
 * o pedido de entrada ser aprovado (o token antigo não traz a organização). */
export async function refreshToken(): Promise<void> {
  const headers = await authHeaders();
  if (!headers.Authorization) return;
  const res = await fetch(`${await base()}/api/v1/auth/token/refresh`, {
    method: 'POST',
    headers: { ...headers, 'bypass-tunnel-reminder': 'true' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.accessToken) await setToken(data.accessToken);
}
