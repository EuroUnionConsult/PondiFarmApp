import { flushSync } from 'react-dom';
import type { ThemeMode } from '../lib/ThemeContext';

/**
 * Troca de tema com uma passagem de scan que sai do botão: uma linha verde a 45°,
 * com a nuvem de pontos do LiDAR atrás dela, nasce no ponto onde se tocou e varre o
 * ecrã na diagonal, revelando o tema novo por onde passa.
 *
 * Usa a View Transitions API: o browser fotografa o ecrã antigo, aplicamos o tema
 * novo e animamos a revelação (clip-path, meio-plano diagonal) e a linha com a mesma
 * curva e o mesmo percurso, por isso andam coladas. Sem a API, ou com «reduzir
 * movimento», o tema muda de imediato.
 */
export function applyThemeAttr(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

export type ScanOrigin = { x: number; y: number };

const DURATION = 1100;
const EASING = 'cubic-bezier(.33,0,.2,1)';
const BAND = 150;                       // altura da faixa de pontos (atrás da linha)
const S = Math.SQRT1_2;
const U = { x: -S, y: S };              // sentido da varredura: para baixo e para a esquerda
const V = { x: S, y: S };               // ao longo da linha

/** Percurso da linha: do canto atrás do botão até ao canto oposto do ecrã. */
function sweep(o: ScanOrigin, w: number, h: number) {
  const proj = ([x, y]: number[]) => (x - o.x) * U.x + (y - o.y) * U.y;
  const ds = [[0, 0], [w, 0], [0, h], [w, h]].map(proj);
  return { s0: Math.min(...ds), s1: Math.max(...ds), long: 2 * Math.hypot(w, h) };
}

/** Meio-plano já revelado (atrás da linha), como polígono de 4 pontos: interpola-se linearmente. */
function revealed(o: ScanOrigin, s: number, L: number) {
  const p = { x: o.x + s * U.x, y: o.y + s * U.y };
  const pts = [
    [p.x + L * V.x, p.y + L * V.y],
    [p.x - L * V.x, p.y - L * V.y],
    [p.x - L * V.x - L * U.x, p.y - L * V.y - L * U.y],
    [p.x + L * V.x - L * U.x, p.y + L * V.y - L * U.y],
  ];
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;
}

/** Faixa rodada a 45°: a borda de baixo (o traço brilhante) fica sobre a linha. */
function bandAt(o: ScanOrigin, s: number, L: number) {
  const tx = o.x + s * U.x - (L / 2) * V.x - BAND * U.x;
  const ty = o.y + s * U.y - (L / 2) * V.y - BAND * U.y;
  return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) rotate(45deg)`;
}

export function switchThemeWithScan(next: ThemeMode, setMode: (m: ThemeMode) => void, origin?: ScanOrigin) {
  const apply = () => { applyThemeAttr(next); flushSync(() => setMode(next)); };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };
  if (!doc.startViewTransition || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { apply(); return; }

  const w = window.innerWidth, h = window.innerHeight;
  const o = origin ?? { x: w - 40, y: 40 };
  const { s0, s1, long } = sweep(o, w, h);

  // A linha existe só no estado novo, com nome próprio na transição, por isso é animada
  // por cima das duas fotografias. Sai do DOM quando a transição acaba.
  const line = document.createElement('div');
  line.className = 'pf-scanline';
  line.style.width = `${long}px`;
  line.setAttribute('aria-hidden', 'true');
  const t = doc.startViewTransition(() => { document.body.appendChild(line); apply(); });
  t.ready.then(() => {
    const opts = { duration: DURATION, easing: EASING, fill: 'both' as const };
    document.documentElement.animate(
      { clipPath: [revealed(o, s0, long), revealed(o, s1, long)] },
      { ...opts, pseudoElement: '::view-transition-new(root)' },
    );
    document.documentElement.animate(
      { transform: [bandAt(o, s0, long), bandAt(o, s1, long)] },
      { ...opts, pseudoElement: '::view-transition-new(pf-scan)' },
    );
  }).catch(() => {});
  t.finished.finally(() => line.remove());
}
