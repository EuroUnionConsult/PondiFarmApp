import * as SecureStore from 'expo-secure-store';
import { getBackendUrl } from './api';

// Token no iOS Keychain (armazenamento seguro nativo) via expo-secure-store.
// Chave do SecureStore só aceita [A-Za-z0-9._-].
const TOKEN_KEY = 'pondifarm_auth_token';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
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

export async function register(
  name: string,
  email: string,
  password: string,
  organizationName: string,
): Promise<void> {
  const data = await postJson('/api/v1/auth/register', {
    name: name.trim(),
    email: email.trim(),
    password,
    organizationName: organizationName.trim(),
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
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
