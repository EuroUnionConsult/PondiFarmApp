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

// Estados cujo peso NÃO deve representar o animal na listagem: arquivado (retirado
// de circulação pelo utilizador) e os que falharam validação. O backend devolve a
// lista ordenada por scanned_at desc, então basta descartar estes e ficar com o
// primeiro que sobra — o scan válido mais recente.
const HIDDEN_SCAN_STATUSES = new Set(['archived', 'failed', 'validation_failed']);

function latestUsableScan(list: any[]): any | undefined {
  return list.find((s) => !HIDDEN_SCAN_STATUSES.has(String(s?.scanStatus ?? s?.scan_status ?? '')));
}

/** Máximo aceite pelo endpoint. Pedir mais devolve 422. */
const ANIMALS_PER_PAGE = 100;
/** Guarda contra um ciclo infinito se o backend deixar de encurtar a última página. */
const MAX_ANIMAL_PAGES = 50;
/** Pedidos de scan em voo ao mesmo tempo. */
const SCAN_FETCH_CONCURRENCY = 8;

/**
 * `Promise.all` com um tecto de tarefas simultâneas. Preserva a ordem de entrada.
 */
async function mapComLimite<T, R>(
  items: T[],
  limite: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < items.length) {
      const i = proximo++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limite, items.length) }, trabalhador),
  );
  return out;
}

/** Busca os animais da org no backend + o peso do scan mais recente de cada um. */
export async function fetchCloudAnimals(): Promise<CloudAnimal[]> {
  // Sync desligado pelo usuário => opera 100% local, não toca no backend.
  if (!(await isCloudSyncEnabled())) return [];
  // Org do usuário logado (do token) — isolamento multi-tenant.
  const orgId = await getOrganizationId();
  if (!orgId) return [];
  const base = (await getBackendUrl()).trim().replace(/\/+$/, '');

  // PAGINAÇÃO. O endpoint devolve 20 por omissão e no máximo 100 por página, e
  // não havia nada aqui a pedir a página seguinte. Com 19 animais nunca se notou;
  // ao vigésimo primeiro a app deixaria de os mostrar todos, sem erro nenhum.
  const animals: any[] = [];
  for (let page = 1; page <= MAX_ANIMAL_PAGES; page++) {
    const res = await fetchWithTimeout(
      `${base}/api/v1/organizations/${orgId}/animals?page=${page}&limit=${ANIMALS_PER_PAGE}`,
      20000,
    );
    if (!res.ok) throw new Error(`animals HTTP ${res.status}`);
    const body = await res.json();
    const lote: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? []);
    animals.push(...lote);
    if (lote.length < ANIMALS_PER_PAGE) break;
  }

  // CONCORRÊNCIA LIMITADA. Cada animal exige um pedido para o seu scan mais
  // recente. Um Promise.all sobre a lista inteira dispara tantos pedidos
  // simultâneos quantos os animais — com 19 passa despercebido, com centenas é
  // uma estampida que esgota o servidor e faz expirar os próprios pedidos.
  const result = await mapComLimite(animals, SCAN_FETCH_CONCURRENCY, async (a) => {
      let weightKg: number | null = null;
      let bodyLengthCm: number | null = null;
      let withersHeightCm: number | null = null;
      try {
        const sr = await fetchWithTimeout(`${base}/api/v1/animals/${a.id}/scans`, 20000);
        if (sr.ok) {
          const body = await sr.json();
          const list: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? []);
          const s = latestUsableScan(list);
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
  });
  // Cacheia por org (mostra instantâneo na próxima navegação).
  try { await AsyncStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify({ orgId, at: Date.now(), animals: result })); } catch {}
  return result;
}

/**
 * Apaga o cache de animais da nuvem. Chamar no LOGOUT: o `getCachedCloudAnimals`
 * já filtra por org, mas os dados do utilizador anterior não devem continuar em
 * disco depois de ele sair da conta.
 */
export async function clearCloudCache(): Promise<void> {
  try { await AsyncStorage.removeItem(CLOUD_CACHE_KEY); } catch {}
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
