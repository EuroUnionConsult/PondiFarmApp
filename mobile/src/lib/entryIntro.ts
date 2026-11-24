import { AccessibilityInfo, Platform } from 'react-native';

// Animação de entrada (logótipo em pontos): UMA vez por sessão, logo depois do login
// ou ao abrir a app já com sessão. A decisão fica em memória (e no sessionStorage na
// web, para um reload no mesmo separador não a repetir). «Reduzir movimento»: nunca.

/** Linha do tempo (ms desde o início). */
export const INTRO = {
  /** Fim da chegada dos pontos (o último ponto parte aos ~280 ms e viaja 700 ms). */
  pointsLand: 980,
  /** Pontos → ícone real (cross-fade). */
  crossFrom: 960,
  crossTo: 1240,
  /** Wordmark «PondiFarm» por baixo do ícone. */
  wordFrom: 1060,
  wordTo: 1360,
  /** O overlay desvanece e o conteúdo da Home entra cartão a cartão. */
  fadeFrom: 1460,
  total: 1880,
  /** Intervalo entre cartões da Home depois da animação. */
  cardStagger: 70,
} as const;

const KEY = 'pf-entry-intro';

let reduceMotion: boolean | null = null;
// Lido já no arranque: quando a sessão chega (token do armazenamento ou login) o valor
// já está em cache e a decisão pode ser síncrona (sem piscar o overlay).
if (Platform.OS === 'web') {
  reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
} else {
  AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion = v; }).catch(() => { reduceMotion = true; });
  AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });
}

let decision: { play: boolean; startedAt: number } | null = null;

function playedInThisTab(): boolean {
  if (Platform.OS !== 'web') return false;
  try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}
function markTab(v: boolean) {
  if (Platform.OS !== 'web') return;
  try { if (v) window.sessionStorage.setItem(KEY, '1'); else window.sessionStorage.removeItem(KEY); } catch { /* sem storage: só memória */ }
}

/**
 * Decide (uma vez por sessão) se a animação corre agora. Chamadas seguintes devolvem a
 * mesma decisão — por isso um re-render ou o StrictMode não a cancelam nem repetem.
 */
export function entryIntro(): { play: boolean; startedAt: number } {
  if (decision) return decision;
  const reduced = Platform.OS === 'web'
    ? !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    : reduceMotion !== false; // ainda por saber → não arrisca
  const play = !reduced && !playedInThisTab();
  decision = { play, startedAt: Date.now() };
  markTab(true);
  return decision;
}

/** Está a decorrer agora? (o overlay só monta enquanto for verdade). */
export function entryIntroActive(): boolean {
  return !!decision?.play && Date.now() - decision.startedAt < INTRO.total;
}

/**
 * Atraso extra para as entradas da Home (FadeInView, página do desktop): enquanto a
 * animação corre, o conteúdo espera pelo desvanecer do overlay. 0 fora da animação.
 */
export function entryIntroContentDelay(): number {
  if (!decision?.play) return 0;
  return Math.max(0, decision.startedAt + INTRO.fadeFrom - Date.now());
}

/** Ao terminar a sessão (logout) o próximo login volta a mostrar a animação. */
export function resetEntryIntro() {
  decision = null;
  markTab(false);
}
