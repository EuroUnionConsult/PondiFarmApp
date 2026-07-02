import AsyncStorage from '@react-native-async-storage/async-storage';

export type ScanCategory = 'cow' | 'extra';

export interface Measurements {
  body_length_cm: number;
  withers_height_cm: number;
  thoracic_depth_cm: number;
  rump_width_cm: number;
  chest_girth_cm: number;
}

export interface ScanRecord {
  id: string;
  scannedAt: number;
  category: ScanCategory;
  source: 'lidar';
  animalId?: string;            // só bovino
  breed?: string;               // só bovino
  measurements: Measurements;   // sempre reais (geometria)
  vertexCount: number;          // peso fica de fora até ter modelo treinado (pós-22/06)
  faceCount: number;
  meshUri: string;
  meshPlyUri?: string;          // PLY colorido (EURODEV-80) — preferido pelo viewer 3D
  meshTexturedUri?: string;     // OBJ+MTL+PNG texturizado (bake UV) — preferido se existir
  keyframesDir?: string;        // pasta de keyframes para "Render texture" sob demanda
  // --- Sincronização com a nuvem (M3-B) ---
  syncState?: 'pending' | 'synced' | 'error';  // ausente = pending (registros antigos)
  remoteId?: string;            // id do scan no backend
  remoteAnimalId?: string;      // id do animal no backend
  syncError?: string;           // mensagem se syncState === 'error'
}

/** Estado de sync efetivo (registros sem o campo contam como pendentes). */
export function effectiveSyncState(r: ScanRecord): 'pending' | 'synced' | 'error' {
  return r.syncState ?? 'pending';
}

/** Quantos scans locais (bovinos) ainda NÃO estão sincronizados. Extras não sincronizam. */
export function countPendingSync(records: ScanRecord[]): number {
  return records.filter(r => r.category === 'cow' && effectiveSyncState(r) !== 'synced').length;
}

const KEY = '@boviscan:scans';

// I3: serializa as escritas (read-modify-write) — sem isto, pushes concorrentes
// intercalam listRecords/setItem e um write se perde (ex.: 'synced' sobrescrito).
let writeChain: Promise<void> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(() => {}, () => {});
  return run;
}

export async function saveRecord(record: ScanRecord): Promise<void> {
  await serialize(async () => {
    const all = await listRecords();
    all.unshift(record);
    // Nunca evictar scans não sincronizados (pending/error) — só descartar sincronizados antigos.
    const trimmed: ScanRecord[] = [];
    for (const r of all) {
      if (trimmed.length < 200 || effectiveSyncState(r) !== 'synced') trimmed.push(r);
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  });
}

export async function listRecords(): Promise<ScanRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Atualiza campos de um scan local (ex.: estado de sync após o push). */
export async function updateRecord(id: string, patch: Partial<ScanRecord>): Promise<void> {
  await serialize(async () => {
    const all = await listRecords();
    const next = all.map(r => (r.id === id ? { ...r, ...patch } : r));
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  });
}

export async function deleteRecord(id: string): Promise<void> {
  await serialize(async () => {
    const all = await listRecords();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.filter(r => r.id !== id)));
  });
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
