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
}

const KEY = '@boviscan:scans';

export async function saveRecord(record: ScanRecord): Promise<void> {
  const all = await listRecords();
  all.unshift(record);
  await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
}

export async function listRecords(): Promise<ScanRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function deleteRecord(id: string): Promise<void> {
  const all = await listRecords();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter(r => r.id !== id)));
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
