// Motor de sincronização offline-first (M3-B).
// O scan é salvo local primeiro; este módulo o envia ao backend quando há rede,
// deixa na fila (pending) quando não há, e marca erro só em falhas PERMANENTES.
import { getBackendUrl, isCloudSyncEnabled } from './api';
import { authHeaders, getOrganizationId } from './auth';
import { estimateWeightKg, WEIGHT_MODEL_VERSION } from './weightModel';
import {
  listRecords, updateRecord, effectiveSyncState, type ScanRecord,
} from './storage';

const BOVINE_SPECIES_ID = '8165ec03-58b8-4741-bfbf-0fe12893c157';
const DEFAULT_HEADERS = { 'bypass-tunnel-reminder': 'true' } as const;
// Timeout generoso: o resume do Azure SQL free-tier leva 30-60s; abortar antes
// deixa o servidor concluir o INSERT enquanto o client marca pending → duplica.
const PUSH_TIMEOUT_MS = 55000;

async function authed(path: string, init?: RequestInit, ms = PUSH_TIMEOUT_MS): Promise<Response> {
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

// PERMANENTE (payload/rota) = não repetir. TRANSITÓRIO (rede/5xx/401/403/408/429) = tentar depois.
class PermanentError extends Error {}
class TransientError extends Error {}
function raiseByStatus(status: number, ctx: string): never {
  if (status === 400 || status === 404 || status === 422) throw new PermanentError(`${ctx} ${status}`);
  throw new TransientError(`${ctx} ${status}`);
}

// Cache de breeds (nome→id) por sessão.
let breedCache: Record<string, string> | null = null;
async function resolveBreedId(breedName?: string): Promise<string | null> {
  if (!breedCache) {
    const res = await authed(`/api/v1/species/${BOVINE_SPECIES_ID}/breeds?limit=100`);
    if (!res.ok) return null;
    const body = await res.json();
    const list: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? []);
    breedCache = {};
    for (const b of list) breedCache[String(b.name).toLowerCase()] = String(b.id);
  }
  const key = (breedName ?? '').toLowerCase().trim();
  if (!key) return breedCache['other'] ?? null;
  // match direto, ou 'limousine'→'limousin'; senão 'other' (NUNCA um breed arbitrário).
  return breedCache[key] ?? breedCache[key.replace(/e$/, '')] ?? breedCache['other'] ?? null;
}

/** Acha animal remoto por tag (match EXATO) ou cria. 409 na criação = já existe → reusa. */
async function findOrCreateAnimal(orgId: string, tag: string, breedName?: string): Promise<string> {
  const findByTag = async (): Promise<string | null> => {
    const res = await authed(`/api/v1/organizations/${orgId}/animals?search=${encodeURIComponent(tag)}&limit=100`);
    if (!res.ok) return null;
    const body = await res.json();
    const list: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? []);
    const hit = list.find(a => (a.tagCode ?? '').toLowerCase() === tag.toLowerCase());
    return hit ? String(hit.id) : null;
  };

  const found = await findByTag();
  if (found) return found;

  const breedId = await resolveBreedId(breedName);
  if (!breedId) throw new TransientError('breeds indisponível');
  const res = await authed('/api/v1/animals', {
    method: 'POST',
    body: JSON.stringify({
      speciesId: BOVINE_SPECIES_ID,
      breedId,
      name: tag,
      tagCode: tag,
      sex: 'unknown',              // sem campo de sexo na UI ainda — não chutar 'female'
      organizationId: orgId,       // ignorado pelo backend (usa org do token — M3-A)
    }),
  });
  if (res.status === 409) {
    // corrida/duplicado: o animal já existe → reusa (409 aqui = sucesso do objetivo).
    const again = await findByTag();
    if (again) return again;
    throw new TransientError('animal 409 sem match');
  }
  if (!res.ok) raiseByStatus(res.status, 'animal');
  const animal = await res.json();
  return String(animal.id);
}

// Evita push concorrente do MESMO record (save fire-and-forget × syncPending no focus).
const inFlight = new Set<string>();

/**
 * Envia UM scan local ao backend. Só bovinos com sync ligado sobem.
 * Marca: synced (ok) / pending (transitório: rede/5xx/401) / error (permanente: 400/404/422).
 */
export async function pushRecord(record: ScanRecord): Promise<'synced' | 'pending' | 'error' | 'skipped'> {
  // C1: só bovinos sincronizam (scans 'extra' = objeto/pessoa ficam locais).
  if (record.category !== 'cow') return 'skipped';
  if (!(await isCloudSyncEnabled())) return 'pending';
  if (inFlight.has(record.id)) return 'pending';   // C5: já em voo
  const orgId = await getOrganizationId();
  if (!orgId) return 'pending';

  inFlight.add(record.id);
  try {
    // C2: tag do usuário, ou uma única e ESTÁVEL por scan (dedup no retry; nunca placeholder compartilhado).
    const tag = (record.animalId ?? '').trim() || `PT-${record.id}`;
    const remoteAnimalId = record.remoteAnimalId ?? await findOrCreateAnimal(orgId, tag, record.breed);
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
          clientScanId: record.id,          // C4: chave de idempotência (dedup futuro)
          modelVersion: WEIGHT_MODEL_VERSION, // M6: rastrear a calibração usada
          vertexCount: record.vertexCount,
          faceCount: record.faceCount,
          category: record.category,
          thoracicDepthCm: m.thoracic_depth_cm,
        },
      }),
    });
    if (!res.ok) raiseByStatus(res.status, 'scan');
    const scan = await res.json();
    await updateRecord(record.id, {
      syncState: 'synced', remoteId: String(scan.id), remoteAnimalId, syncError: undefined,
    });
    return 'synced';
  } catch (e: any) {
    if (e instanceof PermanentError) {
      await updateRecord(record.id, { syncState: 'error', syncError: String(e.message) });
      return 'error';
    }
    // transitório (rede/5xx/401/timeout) → mantém na fila
    await updateRecord(record.id, { syncState: 'pending', syncError: undefined });
    return 'pending';
  } finally {
    inFlight.delete(record.id);
  }
}

let syncing = false;   // C5: evita reentrância de syncPending

/**
 * Reprocessa a fila: envia bovinos ainda não sincronizados, em série.
 * Não repete os marcados 'error' (falha permanente). Chamar ao focar / voltar a rede.
 */
export async function syncPending(): Promise<{ synced: number; pending: number; error: number; skipped: number }> {
  const out = { synced: 0, pending: 0, error: 0, skipped: 0 };
  if (syncing || !(await isCloudSyncEnabled())) return out;
  syncing = true;
  try {
    const records = await listRecords();
    for (const r of records) {
      if (r.category !== 'cow') continue;
      if (effectiveSyncState(r) === 'synced') continue;
      if (r.syncState === 'error') continue;   // não repetir falha permanente
      const s = await pushRecord(r);
      out[s] += 1;
    }
  } finally {
    syncing = false;
  }
  return out;
}
