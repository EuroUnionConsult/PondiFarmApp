import AsyncStorage from '@react-native-async-storage/async-storage';
import { authHeaders, getOrganizationId } from './auth';
import { DEFAULT_BACKEND_URL, DEV_SERVER_KEY, CLOUD_SYNC_KEY, CLOUD_CACHE_KEY } from './config';

const DEFAULT_HEADERS = { 'bypass-tunnel-reminder': 'true' } as const;

/** Sincronização com a nuvem ligada? (default: sim). Preferência do usuário. */
export async function isCloudSyncEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(CLOUD_SYNC_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export async function setCloudSyncEnabled(enabled: boolean): Promise<void> {
  try { await AsyncStorage.setItem(CLOUD_SYNC_KEY, enabled ? '1' : '0'); } catch {}
}

/** Override de URL só para dev (__DEV__). Vazio => usa a URL padrão do app. */
export async function getDevServerUrl(): Promise<string> {
  try { return (await AsyncStorage.getItem(DEV_SERVER_KEY)) ?? ''; } catch { return ''; }
}

export async function setDevServerUrl(url: string): Promise<void> {
  try { await AsyncStorage.setItem(DEV_SERVER_KEY, url.trim()); } catch {}
}

/**
 * fetch com timeout via AbortController.
 * `AbortSignal.timeout()` não existe no runtime Hermes desta versão do RN,
 * então usamos AbortController + setTimeout (compatível).
 */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const auth = await authHeaders();
    return await fetch(url, { headers: { ...DEFAULT_HEADERS, ...auth }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getBackendUrl(): Promise<string> {
  // A URL do backend NÃO é digitada pelo usuário: vem da config do app (fonte única).
  // Em builds de dev, um override opcional permite trocar o IP sem recompilar.
  if (__DEV__) {
    const dev = (await getDevServerUrl()).trim();
    if (dev) return dev.replace(/\/+$/, '');
  }
  return DEFAULT_BACKEND_URL.trim().replace(/\/+$/, '');
}

export async function checkHealth(urlOverride?: string): Promise<boolean> {
  try {
    const baseUrl = urlOverride ?? await getBackendUrl();
    const url = baseUrl.trim().replace(/\/+$/, '');
    const res = await fetchWithTimeout(`${url}/health`, 15000);
    return res.ok;
  } catch {
    return false;
  }
}

export interface CloudAnimal {
  id: string;
  name: string;
  breed: string;
  tagCode: string | null;
  weightKg: number | null;
  bodyLengthCm: number | null;
  withersHeightCm: number | null;
  notes: string | null;
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Busca os animais da org no backend + o peso do scan mais recente de cada um. */
export async function fetchCloudAnimals(): Promise<CloudAnimal[]> {
  // Sync desligado pelo usuário => opera 100% local, não toca no backend.
  if (!(await isCloudSyncEnabled())) return [];
  // Org do usuário logado (do token) — isolamento multi-tenant.
  const orgId = await getOrganizationId();
  if (!orgId) return [];
  const base = (await getBackendUrl()).trim().replace(/\/+$/, '');

  const res = await fetchWithTimeout(
    `${base}/api/v1/organizations/${orgId}/animals?limit=100`,
    20000,
  );
  if (!res.ok) throw new Error(`animals HTTP ${res.status}`);
  const animals = (await res.json()) as any[];

  const result = await Promise.all(
    animals.map(async (a) => {
      let weightKg: number | null = null;
      let bodyLengthCm: number | null = null;
      let withersHeightCm: number | null = null;
      try {
        const sr = await fetchWithTimeout(`${base}/api/v1/animals/${a.id}/scans`, 20000);
        if (sr.ok) {
          const body = await sr.json();
          const list: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? []);
          const s = list[0];
          if (s) {
            weightKg = numOrNull(s.estimatedWeight);
            bodyLengthCm = numOrNull(s.bodyLength);
            withersHeightCm = numOrNull(s.withersHeight);
          }
        }
      } catch {}
      return {
        id: String(a.id),
        name: String(a.name ?? 'Animal'),
        breed: String(a.breed?.name ?? ''),
        tagCode: a.tagCode ?? null,
        weightKg,
        bodyLengthCm,
        withersHeightCm,
        notes: a.notes ?? null,
      } as CloudAnimal;
    }),
  );
  // Cacheia por org (mostra instantâneo na próxima navegação).
  try { await AsyncStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify({ orgId, at: Date.now(), animals: result })); } catch {}
  return result;
}

/**
 * Animais da nuvem do CACHE local (instantâneo, sem rede). Vazio se não houver
 * cache da org atual. Use para pintar a tela na hora e chamar fetchCloudAnimals()
 * em 2º plano para atualizar.
 */
export async function getCachedCloudAnimals(): Promise<CloudAnimal[]> {
  if (!(await isCloudSyncEnabled())) return [];
  try {
    const orgId = await getOrganizationId();
    const raw = await AsyncStorage.getItem(CLOUD_CACHE_KEY);
    if (!raw || !orgId) return [];
    const c = JSON.parse(raw);
    return c.orgId === orgId && Array.isArray(c.animals) ? (c.animals as CloudAnimal[]) : [];
  } catch {
    return [];
  }
}
