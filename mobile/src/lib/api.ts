import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDemoResult } from './demoData';

const CFG_KEY = '@boviscan:config';

export async function getBackendUrl(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(CFG_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.backendUrl) return cfg.backendUrl.replace(/\/$/, '');
    }
  } catch {}
  // Fallback: configure o IP/URL do servidor nas Configurações do app
  return 'http://localhost:8000';
}

export interface ScanResult {
  animal_id: string;
  breed: string;
  detection: {
    class: string;
    confidence_pct: number;
    is_real_animal: boolean;
    mode: string;
  };
  measurements: {
    body_length_cm: number;
    withers_height_cm: number;
    thoracic_depth_cm: number;
    rump_width_cm: number;
    chest_girth_cm: number;
  };
  result: {
    estimated_weight_kg: number;
    confidence_pct: number;
    accuracy_note: string;
  };
  _isDemo?: boolean;
}

export async function scanAnimal(
  imageUri: string,
  animalId: string = 'DEMO-001',
  breed: string = 'default',
): Promise<ScanResult> {
  const baseUrl = await getBackendUrl();

  const form = new FormData();
  form.append('file', {
    uri: imageUri,
    name: 'scan.jpg',
    type: 'image/jpeg',
  } as any);
  form.append('animal_id', animalId);
  form.append('breed', breed);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/scan`, {
      method: 'POST',
      headers: { 'bypass-tunnel-reminder': 'true' },
      body: form,
    });
  } catch {
    // Servidor inacessível — simula processamento para a animação ser visível
    await new Promise(r => setTimeout(r, 6000));
    return buildDemoResult(animalId, breed);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erro desconhecido' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

function buildDemoResult(animalId: string, breed: string): ScanResult {
  const demo = getDemoResult(breed);
  return {
    animal_id: animalId,
    breed: demo.breed,
    detection: {
      class: 'bovine',
      confidence_pct: 0.94,
      is_real_animal: false,
      mode: 'Demo offline — sem servidor',
    },
    measurements: demo.measurements,
    result: demo.result,
    _isDemo: true,
  };
}

export async function checkHealth(urlOverride?: string): Promise<boolean> {
  try {
    const baseUrl = urlOverride ?? await getBackendUrl();
    const url = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${url}/health`, {
      headers: { 'bypass-tunnel-reminder': 'true' },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
