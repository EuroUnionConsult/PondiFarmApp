// Geometria do palco da animação de abertura (components/EntryAnimation.tsx).
// O splash nativo (assets/splash-icon.png, gerado por scripts/make-splash.py) desenha
// os mesmos cantos no mesmo sítio — se mudar aqui, mudar lá também (constantes iguais).

/** Fração da largura do ecrã ocupada pelo palco no telemóvel (150 pt num ecrã de 402 pt). */
export const STAGE_PHONE = 0.373;
/** Centro do palco: 42 % da altura. */
export const STAGE_CY = 0.42;
/** Cantos: afastamento, comprimento do braço, espessura e raio (frações do palco). */
export const CORNER = { pad: 0.08, arm: 0.22, stroke: 0.027, radius: 0.05 };

export function stageGeometry(w: number, h: number) {
  const s = Math.round(w < 700 ? w * STAGE_PHONE : Math.min(240, h * 0.28));
  const left = (w - s) / 2;
  const top = h * STAGE_CY - s / 2;
  const pad = s * CORNER.pad;
  const stroke = Math.max(3, s * CORNER.stroke);
  const arm = s * CORNER.arm;
  const r = s * CORNER.radius;
  // Caminho dos quatro cantos no referencial da caixa (palco + afastamento).
  const a = stroke / 2, b = s + 2 * pad - stroke / 2;
  const cornersPath = [
    `M ${a} ${a + arm} L ${a} ${a + r} Q ${a} ${a} ${a + r} ${a} L ${a + arm} ${a}`,
    `M ${b - arm} ${a} L ${b - r} ${a} Q ${b} ${a} ${b} ${a + r} L ${b} ${a + arm}`,
    `M ${b} ${b - arm} L ${b} ${b - r} Q ${b} ${b} ${b - r} ${b} L ${b - arm} ${b}`,
    `M ${a + arm} ${b} L ${a + r} ${b} Q ${a} ${b} ${a} ${b - r} L ${a} ${b - arm}`,
  ].join(' ');
  return { s, left, top, pad, stroke, cornersPath };
}
