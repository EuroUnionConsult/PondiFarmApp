// «What's new» — FONTE ÚNICA das novidades mostradas ao utilizador (iPhone, web de
// telemóvel e web de computador). O site é compilado deste mesmo app (App.web.tsx),
// por isso há um só ficheiro para as três.
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
  { version: '0.13.2', date: '2026-11-25', area: 'team', text: 'The website no longer shows a blank page while it loads or after an unexpected error: you see the PondiFarm loader, or «Something went wrong» with a Reload button' },
  { version: '0.13.2', date: '2026-11-25', area: 'team', text: 'When the server is waking up, the app waits on «Connecting to the server…» and opens by itself when it answers, instead of an empty profile' },
  { version: '0.13.2', date: '2026-11-25', area: 'herd', text: 'If the server can\'t be reached, the herd says when its data was saved instead of «Everything is synced»' },
  { version: '0.13.2', date: '2026-11-25', area: 'team', text: 'On the website, «Keep me signed in on this computer» is now a choice; without it you are signed out when the browser closes' },
  { version: '0.13.2', date: '2026-11-25', area: 'team', text: 'On the website you are signed out after 30 minutes without activity, with a 60-second warning to stay signed in; it applies to every open tab' },
  { version: '0.13.2', date: '2026-11-25', area: 'team', text: 'Profile no longer jumps when it refreshes, and its rows stay readable with very large text sizes' },

  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'A new opening animation: the cow from our icon is scanned and becomes the PondiFarm logo' },
  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'The launch screen uses the PondiFarm colours instead of a placeholder' },
  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'A new PondiFarm loading animation with the cow from our icon' },
  { version: '0.13.1', date: '2026-11-24', area: 'herd', text: 'Empty lists show the cow from our icon and what to do next' },
  { version: '0.13.1', date: '2026-11-24', area: 'herd', text: 'Pull down on Home and Herd to refresh, with the new loading animation' },
  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'Home, Settings and What\'s new stay readable with very large text sizes' },
  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'Fixed a console error on the website' },
  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'Leaders can select several join requests or members and approve, deny or remove them in one go' },
  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'Press and hold a request or member on iPhone to start selecting' },
  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'Quick messages now share one PondiFarm style: green when done, orange for a warning, red for an error' },
  { version: '0.13.1', date: '2026-11-24', area: 'team', text: 'A green dot on your avatar and in Profile shows when there\'s something new to read' },

  { version: '0.13.0', date: '2026-11-24', area: 'team', text: 'The website is now built from the same code as the iPhone app, so both always get the same features at the same time' },
  { version: '0.13.0', date: '2026-11-24', area: 'scan', text: '3D models on the website only load content stored inside the model file' },

  { version: '0.12.0', date: '2026-11-24', area: 'team', text: '«What\'s new» in Settings: every change grouped by area, with a green dot when there is something new' },
  { version: '0.12.0', date: '2026-11-24', area: 'team', text: '«Coming next»: what we are working on now and what comes after' },

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

// «Coming next» — o que está a ser feito ou planeado, em linguagem simples (para quem
// não é programador) mas tecnicamente certa. Sai daqui quando for publicado e passa a
// entrada de WHATS_NEW da versão em que saiu.
export type UpcomingStatus = 'in-progress' | 'planned';

export interface UpcomingItem {
  title: string;
  area: WhatsNewArea;
  status: UpcomingStatus;
  /** Uma ou duas frases, em inglês, a explicar o que muda para quem usa a PondiFarm. */
  text: string;
}

export const STATUS_LABEL: Record<UpcomingStatus, string> = {
  'in-progress': 'In progress',
  planned: 'Planned',
};

/** Cores do selo de estado (iguais no tema claro e escuro, como os selos de versão). */
export const STATUS_COLORS: Record<UpcomingStatus, { bg: string; fg: string }> = {
  'in-progress': { bg: '#FBEBDD', fg: '#9C4C16' },
  planned: { bg: '#E3EBF3', fg: '#1B3A57' },
};

export const UPCOMING: UpcomingItem[] = [
  { title: 'Weight accuracy with scale weights', area: 'scan', status: 'in-progress', text: 'Calibrating the weight model with real scale weights from farm visits to reduce the current ~10 % margin.' },
  { title: 'Automatic, safer releases', area: 'team', status: 'planned', text: 'New versions go first to a private test copy of PondiFarm (staging) with test data; only after checking it there are they published to everyone.' },
  { title: 'More secure web sign-in', area: 'team', status: 'planned', text: 'The website will keep your session in a protected cookie that page scripts cannot read, and renew it automatically.' },
  { title: 'Automatic testing on every change', area: 'team', status: 'planned', text: 'Key flows (sign-in, herd, scan again, postcode search) are tested automatically on web and iPhone before any release.' },
];

/** «Coming next», com o que está em curso primeiro. */
export function upcomingSorted(): UpcomingItem[] {
  return UPCOMING.filter((u) => u.status === 'in-progress').concat(UPCOMING.filter((u) => u.status !== 'in-progress'));
}

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

/** true quando a versão tem pelo menos uma novidade. */
export function hasWhatsNewFor(version: string = APP_VERSION): boolean {
  return WHATS_NEW.some((i) => i.version === version);
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
  // Sem entradas para esta versão não há nada de novo a assinalar.
  return seen !== undefined && seen !== APP_VERSION && hasWhatsNewFor(APP_VERSION);
}
