import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CloudAnimal } from '../lib/api';
import { fmtW } from './herd';

// Peças partilhadas pelas páginas do computador: números animados, cartões, histograma e raças.
export const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Número que sobe até ao valor quando aparece ou muda (ease-out). */
export function useCountUp(target: number | null, ms = 700) {
  const [v, setV] = useState<number | null>(target);
  const from = useRef(0);
  useEffect(() => {
    if (target === null) { setV(null); return; }
    if (reduced()) { setV(target); from.current = target; return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - u, 3);
      setV(Math.round(a + (target - a) * e));
      if (u < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2); };
export const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
export const pos = (v: number | null) => (v && v > 0 ? v : null);
export const weights = (as: CloudAnimal[]) => as.map((a) => fmtW(a.weightKg)).filter((w): w is number => w !== null);

export function Kpi({ label, value, unit, note, text }: { label: string; value: number | null; unit?: string; note: string; text?: string }) {
  const n = useCountUp(value);
  return (
    <div className="pf-card pf-kpi">
      <div className="pf-k w7">{label}</div>
      <div className="v w8">{text ?? (n ?? '—')}{(text || n !== null) && unit && <small className="w6">{unit}</small>}</div>
      <div className="pf-sub">{note}</div>
    </div>
  );
}

/** Anel de percentagem que enche ao aparecer. */
export function Ring({ pct, size = 84, label }: { pct: number; size?: number; label: string }) {
  const shown = useCountUp(pct) ?? 0;
  const R = 34, C = 2 * Math.PI * R;
  return (
    <svg className="pf-ringsvg" viewBox="0 0 84 84" width={size} height={size} aria-label={label}>
      <circle cx="42" cy="42" r={R} fill="none" stroke="var(--line)" strokeWidth="9" />
      <circle cx="42" cy="42" r={R} fill="none" stroke="var(--green)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" className="w8" style={{ fontSize: 17, fill: 'var(--label)' }}>{shown}%</text>
    </svg>
  );
}

export function Histogram({ ws, avg, height = 210, empty }: { ws: number[]; avg: number | null; height?: number; empty?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!ws.length) return <div className="pf-empty">{empty ?? 'Weights appear here once animals are scanned with the iPhone app.'}</div>;
  const lo = Math.min(...ws), hi = Math.max(...ws);
  const BINS = Math.min(14, Math.max(6, Math.ceil(Math.sqrt(ws.length)) + 4)), step = (hi - lo) / BINS || 1;
  const bins = Array.from({ length: BINS }, (_, i) => ws.filter((w) => w >= lo + i * step && (i === BINS - 1 ? w <= hi : w < lo + (i + 1) * step)).length);
  const top = Math.max(1, ...bins);
  const avgAt = avg === null || hi === lo ? null : ((avg - lo) / (hi - lo)) * 100;
  const h = hover ?? -1;
  return (
    <>
      <div className="pf-hist-tip" aria-live="polite">{h >= 0
        ? <><b className="w7">{bins[h]} {bins[h] === 1 ? 'animal' : 'animals'}</b> between {Math.round(lo + h * step)} and {Math.round(lo + (h + 1) * step)} kg</>
        : <>Hover a bar to see how many animals fall in that range</>}</div>
      <div className="pf-hist" style={{ height }} onMouseLeave={() => setHover(null)}>
        {bins.map((v, i) => (
          <button key={i} className={`b${i === h ? ' on' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}
            aria-label={`${v} animals between ${Math.round(lo + i * step)} and ${Math.round(lo + (i + 1) * step)} kg`}>
            <i style={{ height: `${(v / top) * 100}%`, animationDelay: `${i * 35}ms` }} />
          </button>))}
        {avgAt !== null && <div className="avg" style={{ left: `${avgAt}%` }}><span className="w7">mean {avg} kg</span></div>}
      </div>
      <div className="pf-hist-axis"><span>{lo} kg</span><span>{Math.round((lo + hi) / 2)} kg</span><span>{hi} kg</span></div>
    </>
  );
}

export function Breeds({ animals, limit = 6 }: { animals: CloudAnimal[]; limit?: number }) {
  const rows = useMemo(() => {
    const m = new Map<string, CloudAnimal[]>();
    for (const a of animals) { const k = (a.breed || 'Unknown').trim() || 'Unknown'; m.set(k, [...(m.get(k) ?? []), a]); }
    return [...m.entries()].map(([breed, xs]) => ({ breed, n: xs.length, w: mean(weights(xs)) }))
      .sort((a, b) => b.n - a.n).slice(0, limit);
  }, [animals, limit]);
  const top = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <div className="pf-empty">No animals yet.</div>;
  return (
    <div className="pf-breeds">
      {rows.map((r, i) => (
        <div key={r.breed} className="r">
          <div className="l"><span className="w6">{r.breed}</span><span>{r.n} {r.n === 1 ? 'animal' : 'animals'}{r.w !== null ? ` · mean ${r.w} kg` : ''}</span></div>
          <div className="bar"><i style={{ width: `${(r.n / top) * 100}%`, animationDelay: `${i * 60}ms` }} /></div>
        </div>))}
    </div>
  );
}

/** Seletor com fundo que desliza para a opção escolhida. */
export function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const i = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div className="pf-pills" role="tablist" aria-label={label} style={{ ['--n' as any]: options.length, ['--i' as any]: i }}>
      <span className="thumb" aria-hidden="true" />
      {options.map((o) => <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? 'on w6' : 'w6'} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

/** As raças mais comuns, para os filtros. */
export function topBreeds(animals: CloudAnimal[], n = 3) {
  const c = new Map<string, number>();
  animals.forEach((a) => a.breed && c.set(a.breed, (c.get(a.breed) ?? 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([b]) => b);
}

// ---------- esqueletos de carregamento (a forma do conteúdo, a pulsar) ----------
export const Skel = ({ w = '100%', h = 14, r = 8, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) =>
  <span className="pf-skel" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;

export function SkelKpis({ n = 4 }: { n?: number }) {
  return (
    <div className="pf-kpis" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="pf-card pf-kpi"><Skel w={90} h={13} /><Skel w={130} h={38} style={{ marginTop: 12 }} /><Skel w={150} h={12} style={{ marginTop: 12 }} /></div>))}
    </div>
  );
}

export function SkelChart({ h = 190 }: { h?: number }) {
  const bars = [35, 52, 28, 70, 88, 64, 95, 58, 76, 40, 30];
  return (
    <div aria-hidden="true"><Skel w={260} h={12} />
      <div className="pf-skelbars" style={{ height: h }}>{bars.map((v, i) => <Skel key={i} h={v} r={6} style={{ height: `${v}%`, animationDelay: `${i * 60}ms` }} />)}</div>
    </div>
  );
}

export function SkelRows({ n = 5, right = true }: { n?: number; right?: boolean }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="pf-skelrow"><Skel w={36} h={36} r={18} />
          <div style={{ flex: 1 }}><Skel w={`${45 - (i % 3) * 8}%`} h={13} /><Skel w={`${30 + (i % 2) * 10}%`} h={11} style={{ marginTop: 7 }} /></div>
          {right && <Skel w={54} h={18} />}</div>))}
    </div>
  );
}
