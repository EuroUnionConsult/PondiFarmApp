// «What's new» — FONTE ÚNICA das novidades mostradas ao utilizador (iPhone, web de
// telemóvel e web de computador). Ficheiro partilhado: tem de ser IGUAL em
// PondiFarmApp/mobile/src/lib e em PondiFarmWeb-Desk/src/lib.
//
// Cada release acrescenta aqui as suas entradas, em linguagem simples (não as mensagens
// dos commits). O release-please NÃO o faz sozinho: `npm run whatsnew:check` falha se a
// APP_VERSION de version.ts não tiver nenhuma entrada. Entradas de uma versão ainda não
// publicada podem entrar antes — só aparecem quando a APP_VERSION lá chegar.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { APP_VERSION } from './version';

export type WhatsNewArea = 'scan' | 'herd' | 'weather' | 'team';

export interface WhatsNewItem {
  version: string;
  /** Data da release, AAAA-MM-DD. */
  date: string;
  area: WhatsNewArea;
  /** Frase curta, em inglês (a interface da app é em inglês), para quem usa a app. */
  text: string;
}

export const AREAS: { key: WhatsNewArea; label: string }[] = [
  { key: 'scan', label: 'Scan' },
  { key: 'herd', label: 'Herd' },
  { key: 'weather', label: 'Weather' },
  { key: 'team', label: 'Team & web' },
];

export const WHATS_NEW: WhatsNewItem[] = [
  { version: '0.11.0', date: '2026-11-23', area: 'scan', text: 'Scan the same animal again' },
  { version: '0.11.0', date: '2026-11-23', area: 'herd', text: 'Scan history with the weather and the ± margin of each weight' },
  { version: '0.11.0', date: '2026-11-23', area: 'herd', text: 'The herd opens up to 2× faster' },
  { version: '0.11.0', date: '2026-11-23', area: 'weather', text: 'The weather is saved with every scan' },
  { version: '0.11.0', date: '2026-11-23', area: 'team', text: '«Connecting to the server…» notice while the server wakes up' },

  { version: '0.10.2', date: '2026-11-23', area: 'weather', text: 'Search your farm by postcode (e.g. 4935-585)' },
  { version: '0.10.2', date: '2026-11-23', area: 'weather', text: 'The last forecast stays on screen when the weather service fails' },
  { version: '0.10.2', date: '2026-11-23', area: 'team', text: 'Error reports help us fix problems faster' },

  { version: '0.10.0', date: '2026-10-24', area: 'weather', text: 'Heat-stress alerts and your farm on a map' },
  { version: '0.10.0', date: '2026-10-24', area: 'herd', text: 'Record the sex of each animal' },
  { version: '0.10.0', date: '2026-10-24', area: 'team', text: 'Team activity history' },
  { version: '0.10.0', date: '2026-10-24', area: 'scan', text: 'Photo, Clay and LiDAR views of the 3D scan' },

  { version: '0.9.0', date: '2026-10-23', area: 'team', text: 'PondiFarm on the web' },
  { version: '0.9.0', date: '2026-10-23', area: 'scan', text: '3D models saved in the cloud' },
  { version: '0.9.0', date: '2026-10-23', area: 'herd', text: 'Weight history for each animal' },

  { version: '0.8.0', date: '2026-10-21', area: 'team', text: 'Teams with a leader and join requests' },
  { version: '0.8.0', date: '2026-10-21', area: 'scan', text: 'Live coverage ring and automatic box fit' },
  { version: '0.8.0', date: '2026-10-21', area: 'team', text: 'New look, with a light and a dark theme' },

  { version: '0.7.0', date: '2026-10-21', area: 'herd', text: 'Weight is marked as Experimental' },
  { version: '0.7.0', date: '2026-10-21', area: 'herd', text: 'Limousine is the default breed' },
];

/** Compara versões «x.y.z» (negativo se a < b). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Entradas até à versão instalada (as de versões futuras ficam escondidas), da mais nova para a mais antiga. */
export function whatsNewFor(current: string = APP_VERSION, onlyCurrent = false): WhatsNewItem[] {
  return WHATS_NEW
    .filter((i) => (onlyCurrent ? i.version === current : compareVersions(i.version, current) <= 0))
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** Entradas de uma área, já ordenadas. */
export function byArea(items: WhatsNewItem[], area: WhatsNewArea): WhatsNewItem[] {
  return items.filter((i) => i.area === area);
}

// «Visto»: guarda a última versão em que a pessoa abriu o «What's new». Enquanto for
// diferente da APP_VERSION, as Settings mostram o ponto verde. AsyncStorage = localStorage na web.
export const WHATS_NEW_SEEN_KEY = 'pondifarm_whats_new_seen';
const listeners = new Set<(seen: string | null) => void>();

export async function markWhatsNewSeen(): Promise<void> {
  try { await AsyncStorage.setItem(WHATS_NEW_SEEN_KEY, APP_VERSION); } catch {}
  listeners.forEach((l) => l(APP_VERSION));
}

/** true quando há novidades desta versão por abrir. */
export function useWhatsNewUnseen(): boolean {
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(WHATS_NEW_SEEN_KEY).then((v) => { if (alive) setSeen(v); }).catch(() => { if (alive) setSeen(null); });
    const l = (v: string | null) => setSeen(v);
    listeners.add(l);
    return () => { alive = false; listeners.delete(l); };
  }, []);
  return seen !== undefined && seen !== APP_VERSION;
}
