// Motor de sincronização offline-first (M3-B).
// O scan é salvo local primeiro; este módulo o envia ao backend quando há rede,
// deixa na fila (pending) quando não há, e marca erro (4xx) sem repetir em loop.
import { getBackendUrl, isCloudSyncEnabled } from './api';
import { authHeaders, getOrganizationId } from './auth';
import { estimateWeightKg } from './weightModel';
import {
  listRecords, updateRecord, effectiveSyncState, type ScanRecord,
} from './storage';

const BOVINE_SPECIES_ID = '8165ec03-58b8-4741-bfbf-0fe12893c157';
const DEFAULT_HEADERS = { 'bypass-tunnel-reminder': 'true' } as const;

async function authed(path: string, init?: RequestInit, ms = 20000): Promise<Response> {
  const base = (await getBackendUrl()).trim().replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const auth = await authHeaders();
    return await fetch(`${base}${path}`, {
      ...init,
      headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', ...auth, ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Erro 4xx do cliente = payload/permite; não adianta repetir. */
class ClientError extends Error {}

// Cache de breeds (nome→id) por sessão — evita lookup repetido.
let breedCache: Record<string, string> | null = null;

async function resolveBreedId(breedName?: string): Promise<string | null> {
  try {
    if (!breedCache) {
      const res = await authed(`/api/v1/species/${BOVINE_SPECIES_ID}/breeds`);
      if (!res.ok) return null;
      const body = await res.json();
      const list: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? []);
      breedCache = {};
      for (const b of list) breedCache[String(b.name).toLowerCase()] = String(b.id);
    }
    const key = (breedName ?? '').toLowerCase().trim();
    // match por nome (ex.: 'limousine'→'limousin'); fallback p/ 'Other' ou 1º.
    return breedCache[key]
      ?? breedCache[key.replace(/e$/, '')]           // limousine → limousin
      ?? breedCache['other']
      ?? Object.values(breedCache)[0]
      ?? null;
  } catch {
    return null;
  }
}

/** Acha animal remoto por tag_code (evita duplicar) ou cria um novo. Devolve o id. */
async function findOrCreateAnimal(orgId: string, record: ScanRecord): Promise<string> {
  const tag = (record.animalId ?? '').trim();
  // 1) tenta achar por tag na org
  if (tag) {
    const res = await authed(`/api/v1/organizations/${orgId}/animals?search=${encodeURIComponent(tag)}`);
    if (res.ok) {
      const body = await res.json();
      const list: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? []);
      const hit = list.find(a => (a.tagCode ?? '').toLowerCase() === tag.toLowerCase());
      if (hit) return String(hit.id);
    }
  }
  // 2) cria
  const breedId = await resolveBreedId(record.breed);
  if (!breedId) throw new Error('sem breed_id (species/breeds indisponível)');
  const res = await authed('/api/v1/animals', {
    method: 'POST',
    body: JSON.stringify({
      speciesId: BOVINE_SPECIES_ID,
      breedId,
      name: tag || 'Bovino',
      tagCode: tag || null,
      sex: 'female',               // default do fluxo (rebanho de corte); ajustável depois
      // organizationId é ignorado pelo backend (usa a org do token — M3-A)
      organizationId: orgId,
    }),
  });
  if (res.status >= 400 && res.status < 500) throw new ClientError(`animal ${res.status}`);
  if (!res.ok) throw new Error(`animal HTTP ${res.status}`);
  const animal = await res.json();
  return String(animal.id);
}

/**
 * Envia UM scan local ao backend (cria animal se preciso + cria o scan com medidas+peso).
 * Marca o registro: synced (ok) / pending (falha de rede) / error (4xx).
 */
export async function pushRecord(record: ScanRecord): Promise<'synced' | 'pending' | 'error'> {
  if (!(await isCloudSyncEnabled())) return 'pending';
  const orgId = await getOrganizationId();
  if (!orgId) return 'pending';

  try {
    const remoteAnimalId = record.remoteAnimalId ?? await findOrCreateAnimal(orgId, record);
    const m = record.measurements;
    const res = await authed(`/api/v1/animals/${remoteAnimalId}/scans`, {
      method: 'POST',
      body: JSON.stringify({
        scanSource: 'lidar',
        scanStatus: 'completed',
        scannedAt: new Date(record.scannedAt).toISOString(),
        estimatedWeight: estimateWeightKg(m),
        bodyLength: m.body_length_cm,
        withersHeight: m.withers_height_cm,
        chestCircumference: m.chest_girth_cm,
        hipWidth: m.rump_width_cm,
        rawResultJson: {
          vertexCount: record.vertexCount,
          faceCount: record.faceCount,
          category: record.category,
          thoracicDepthCm: m.thoracic_depth_cm,
        },
      }),
    });
    if (res.status >= 400 && res.status < 500) throw new ClientError(`scan ${res.status}`);
    if (!res.ok) throw new Error(`scan HTTP ${res.status}`);
    const scan = await res.json();
    await updateRecord(record.id, {
      syncState: 'synced', remoteId: String(scan.id), remoteAnimalId, syncError: undefined,
    });
    return 'synced';
  } catch (e: any) {
    if (e instanceof ClientError) {
      await updateRecord(record.id, { syncState: 'error', syncError: String(e.message) });
      return 'error';
    }
    // rede/servidor → mantém na fila para tentar depois
    await updateRecord(record.id, { syncState: 'pending' });
    return 'pending';
  }
}

/**
 * Reprocessa a fila: envia todos os scans locais ainda não sincronizados (pending),
 * em série (não sobrecarrega o Azure free-tier). Chamar ao focar o app / voltar a rede.
 */
export async function syncPending(): Promise<{ synced: number; pending: number; error: number }> {
  const out = { synced: 0, pending: 0, error: 0 };
  if (!(await isCloudSyncEnabled())) return out;
  const records = await listRecords();
  for (const r of records) {
    if (effectiveSyncState(r) === 'synced') continue;   // já sincronizado
    if (r.syncState === 'error') continue;               // não repetir erros de payload
    const s = await pushRecord(r);
    out[s] += 1;
  }
  return out;
}
