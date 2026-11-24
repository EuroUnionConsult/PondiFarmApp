import { Platform } from 'react-native';

// Animação de abertura («Scan que revela»): em cada arranque a frio da app (e, na web,
// no primeiro carregamento de cada separador). A decisão fica em memória e, na web, no
// sessionStorage — um reload no mesmo separador não a repete. A componente é
// components/EntryAnimation.tsx; este módulo só guarda o estado e a linha do tempo,
// para a Home saber quando entrar.

/** Linha do tempo (ms desde o início). */
export const INTRO = {
  cornersIn: 300,
  scanFrom: 300,
  scanTo: 1300,
  /** Pontos → ícone real; os cantos saem. */
  revealFrom: 1350,
  revealTo: 1800,
  wordFrom: 1750,
  wordTo: 2050,
  bylineFrom: 1950,
  bylineTo: 2200,
  /** Passagem para a app (a Home entra cartão a cartão a partir daqui). */
  fadeFrom: 2850,
  total: 3150,
  /** «Reduzir movimento»: ícone + wordmark parados ~0,6 s e sai. */
  reducedHold: 600,
  reducedTotal: 850,
  cardStagger: 70,
} as const;

export const INTRO_BG = '#0F2234';
const KEY = 'pf-entry-intro';

let state: { play: boolean; startedAt: number; length: number } | null = null;

function playedInThisTab(): boolean {
  if (Platform.OS !== 'web') return false;
  try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

/**
 * Decide uma vez por arranque (iPhone) ou por separador (web). Chamadas seguintes
 * devolvem a mesma decisão, por isso re-renders e o StrictMode não a repetem.
 */
export function entryIntro(): { play: boolean; startedAt: number; length: number } {
  if (state) return state;
  const play = !playedInThisTab();
  state = { play, startedAt: Date.now(), length: INTRO.total };
  if (Platform.OS === 'web') { try { window.sessionStorage.setItem(KEY, '1'); } catch { /* só memória */ } }
  return state;
}

/** «Reduzir movimento»: a versão curta (o conteúdo entra mais cedo). */
export function shortenEntryIntro() {
  if (state) state.length = INTRO.reducedTotal;
}

/**
 * Atraso extra para as entradas da Home (FadeInView, página do desktop): enquanto a
 * animação corre, o conteúdo espera pela passagem para a app. 0 fora da animação.
 */
export function entryIntroContentDelay(): number {
  if (!state?.play) return 0;
  const fadeAt = state.length === INTRO.total ? INTRO.fadeFrom : INTRO.reducedHold;
  return Math.max(0, state.startedAt + fadeAt - Date.now());
}
