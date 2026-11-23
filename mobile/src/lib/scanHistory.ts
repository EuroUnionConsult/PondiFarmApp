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

/**
 * «Scan again»: o scan novo vai direto para o animal da ficha (`remoteAnimalId`), a menos
 * que a pessoa tenha mudado o ID no formulário — aí é outro animal e o sync decide pela tag.
 */
export function scanAgainTarget(
  again: { animalId?: string; remoteAnimalId?: string } | undefined,
  typedId: string | undefined,
): string | undefined {
  if (!again?.remoteAnimalId || !again.animalId) return undefined;
  return (typedId ?? '').trim() === again.animalId.trim() ? again.remoteAnimalId : undefined;
}

export interface MeasureDelta { label: string; now: number | null; before: number | null; diff: number | null }

/** Medidas (cm) do scan `cur` comparadas com `ref` (o anterior, ou o de hoje). */
export function measureDeltas(cur: HistoryScan, ref: HistoryScan | undefined): MeasureDelta[] {
  const rows: [string, keyof HistoryScan][] = [['Chest girth', 'chestCm'], ['Body length', 'lengthCm'], ['Withers height', 'withersCm']];
  return rows.map(([label, k]) => {
    const now = cur[k] as number | null, before = ref ? (ref[k] as number | null) : null;
    return { label, now, before, diff: now != null && before != null ? Math.round(now - before) : null };
  });
}

/** Frase honesta: medidas fiáveis, peso dentro/fora da margem. */
export function growthSummary(first: HistoryScan, last: HistoryScan, n: number): string {
  const days = Math.max(1, Math.round((last.at - first.at) / 86400000));
  const g = measureDeltas(last, first).find((m) => m.label === 'Chest girth');
  const d = weightDelta(last, first);
  const parts = [`Over ${n} scans in ${days} days`];
  if (g?.diff != null) parts.push(`chest girth ${g.diff >= 0 ? 'grew' : 'shrank'} ${Math.abs(g.diff)} cm`);
  if (d) parts.push(d.withinMargin ? `weight changed ${d.kg >= 0 ? '+' : '−'}${Math.abs(d.kg)} kg, within the ± ${d.margin} kg margin` : `weight ${d.kg >= 0 ? 'rose' : 'fell'} about ${Math.abs(d.kg)} kg`);
  return parts.join(', ') + '.';
}

/** Tempo muito diferente entre dois scans: comparar com cuidado. */
export function weatherDiffers(a: ScanWx | undefined, b: ScanWx | undefined): boolean {
  if (!a || !b) return false;
  const dt = a.tempC != null && b.tempC != null ? Math.abs(a.tempC - b.tempC) : 0;
  const dthi = a.thi != null && b.thi != null ? Math.abs(a.thi - b.thi) : 0;
  return dt >= 8 || dthi >= 8 || a.heatStress !== b.heatStress;
}
