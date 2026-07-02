import AsyncStorage from '@react-native-async-storage/async-storage';
import { authHeaders } from './auth';

const CFG_KEY_NEW = '@pondifarm:config';
const CFG_KEY_LEGACY = '@boviscan:config';

// Org piloto PondiFarm (Fase 0). Ideal: derivar do login/config quando houver auth.
const PONDIFARM_ORG_ID = 'afa19bc8-1528-4802-95fa-24ad30305adb';

const DEFAULT_HEADERS = { 'bypass-tunnel-reminder': 'true' } as const;

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
  try {
    const raw = (await AsyncStorage.getItem(CFG_KEY_NEW)) ?? (await AsyncStorage.getItem(CFG_KEY_LEGACY));
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.backendUrl) return cfg.backendUrl.trim().replace(/\/+$/, '');
    }
  } catch {}
  // Fallback: configure o IP/URL do servidor nas Configurações do app
  return 'http://localhost:8000';
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
  const base = (await getBackendUrl()).trim().replace(/\/+$/, '');

  const res = await fetchWithTimeout(
    `${base}/api/v1/organizations/${PONDIFARM_ORG_ID}/animals`,
    20000,
  );
  if (!res.ok) throw new Error(`animals HTTP ${res.status}`);
  const animals = (await res.json()) as any[];

  return Promise.all(
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
}
