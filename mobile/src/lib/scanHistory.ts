/**
 * Regras do histórico de scans (iPhone, web telemóvel e web computador usam as mesmas).
 * O peso é experimental: margem de ~10 % da estimativa. Uma diferença menor do que a
 * margem diz-se «within margin» — não é ganho nem perda que se possa afirmar.
 */
import type { HistoryScan, ScanWx } from './api';

export const WEIGHT_MARGIN = 0.1;

export const weightMargin = (kg: number) => Math.round(kg * WEIGHT_MARGIN);

export interface WeightDelta { kg: number; margin: number; withinMargin: boolean }

/** Diferença de peso para o scan anterior com peso (ou null se não houver). */
export function weightDelta(cur: HistoryScan, prev: HistoryScan | undefined): WeightDelta | null {
  if (!prev || cur.weightKg == null || prev.weightKg == null) return null;
  const kg = Math.round(cur.weightKg - prev.weightKg);
  const margin = weightMargin(cur.weightKg);
  return { kg, margin, withinMargin: Math.abs(kg) < margin };
}

export const fmtScanDate = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtScanTime = (t: number) =>
  new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** «18 °C · 62 % · THI 64» (+ « · heat stress»). Null se não houver dados. */
export function weatherLine(w: ScanWx | undefined): string | null {
  if (!w || w.tempC == null) return null;
  const parts = [`${Math.round(w.tempC)} °C`];
  if (w.humidity != null) parts.push(`${Math.round(w.humidity)} %`);
  if (w.thi != null) parts.push(`THI ${Math.round(w.thi)}`);
  if (w.heatStress) parts.push('heat stress');
  return parts.join(' · ');
}

/** Medidas que encolheram entre scans: provável pose diferente. */
export function shrunk(cur: HistoryScan, prev: HistoryScan | undefined): boolean {
  if (!prev) return false;
  const pairs: [number | null, number | null][] = [
    [cur.chestCm, prev.chestCm], [cur.lengthCm, prev.lengthCm], [cur.withersCm, prev.withersCm],
  ];
  // 3 % de tolerância: abaixo disso é ruído da medição.
  return pairs.some(([a, b]) => a != null && b != null && a < b * 0.97);
}
