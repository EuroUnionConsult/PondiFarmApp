import React, { useMemo, useState } from 'react';
import type { CloudAnimal } from '../lib/api';
import { WEIGHT_MODEL_VERSION } from '../lib/weightModel';
import { fmtW, type Herd } from './herd';
import { InfoIcon } from './icons';
import { Breeds, Histogram, Kpi, Pills, Ring, SkelChart, SkelKpis, SkelRows, mean, median, pos, topBreeds, weights } from './charts';

function Coverage({ withW, total }: { withW: number; total: number }) {
  const pct = total ? Math.round((withW / total) * 100) : 0;
  return (
    <div className="pf-card pf-kpi pf-cov">
      <div><div className="pf-k w7">With an estimate</div>
        <div className="v w8">{withW}<small className="w6">/ {total}</small></div>
        <div className="pf-sub">animals with a weight</div></div>
      <Ring pct={pct} label={`${pct}% of the herd has a weight`} />
    </div>
  );
}

// Escala «redonda» para os eixos: o mínimo e o máximo arredondados ao passo, com folga.
function niceRange(lo: number, hi: number, step: number): [number, number] {
  const a = Math.floor((lo - step * 0.25) / step) * step, b = Math.ceil((hi + step * 0.25) / step) * step;
  return a === b ? [a - step, b + step] : [a, b];
}

function Scatter({ animals, openAnimal }: { animals: CloudAnimal[]; openAnimal: (id: string) => void }) {
  const pts = animals.map((a) => ({ id: a.id, x: pos(a.bodyLengthCm), y: fmtW(a.weightKg), name: a.name }))
    .filter((p): p is { id: string; x: number; y: number; name: string } => p.x !== null && p.y !== null);
  const [hover, setHover] = useState<number | null>(null);
  if (pts.length < 2) return <div className="pf-empty">Body length and weight appear here together once at least two animals have both measured.</div>;
  const W = 560, H = 280, L = 52, R = 18, T = 16, B = 44;
  const [x0, x1] = niceRange(Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), 10);
  const [y0, y1] = niceRange(Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)), 50);
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R), sy = (y: number) => H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round(y0 + ((y1 - y0) * i) / 4));
  const xTicks = Array.from({ length: 5 }, (_, i) => Math.round(x0 + ((x1 - x0) * i) / 4));
  // Reta de tendência (mínimos quadrados): mostra se os animais mais compridos pesam mais.
  const n = pts.length, mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0), sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const slope = sxx ? sxy / sxx : 0, icpt = my - slope * mx;
  const yAt = (x: number) => Math.min(y1, Math.max(y0, icpt + slope * x));
  const h = hover !== null ? pts[hover] : null;
  return (
    <>
      <div className="pf-hist-tip" aria-live="polite">{h
        ? <><b className="w7">{h.name}</b> · {Math.round(h.x)} cm · {h.y} kg</>
        : <>Each dot is an animal. The dashed line is the trend{sxx ? `: about ${slope >= 0 ? '+' : '−'}${Math.abs(Math.round(slope * 10))} kg for every 10 cm of body length` : ''}.</>}</div>
      <svg className="pf-scatter" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Body length against estimated weight" onMouseLeave={() => setHover(null)}>
        {yTicks.map((t) => <g key={`y${t}`}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="grid" /><text x={L - 8} y={sy(t) + 4} className="ax" textAnchor="end">{t}</text></g>)}
        {xTicks.map((t) => <text key={`x${t}`} x={sx(t)} y={H - B + 18} className="ax" textAnchor="middle">{t}</text>)}
        <text x={(L + W - R) / 2} y={H - 6} className="ax tt" textAnchor="middle">Body length (cm)</text>
        <text x={14} y={(T + H - B) / 2} className="ax tt" textAnchor="middle" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>Weight (kg)</text>
        {sxx > 0 && <line x1={sx(x0)} y1={sy(yAt(x0))} x2={sx(x1)} y2={sy(yAt(x1))} className="trend" pathLength={1} />}
        {h && <><line x1={sx(h.x)} x2={sx(h.x)} y1={sy(h.y)} y2={H - B} className="guide" /><line x1={L} x2={sx(h.x)} y1={sy(h.y)} y2={sy(h.y)} className="guide" /></>}
        {pts.map((p, i) => (
          <g key={p.id} className="dotg" onMouseEnter={() => setHover(i)} onClick={() => openAnimal(p.id)} role="button" aria-label={`${p.name}, ${Math.round(p.x)} cm, ${p.y} kg. Open in the herd`}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={14} fill="transparent" />
            <circle cx={sx(p.x)} cy={sy(p.y)} r={i === hover ? 8 : 6} className={`dot${i === hover ? ' on' : ''}`} style={{ animationDelay: `${i * 25}ms` }} />
          </g>))}
      </svg>
    </>
  );
}

export default function AnalyticsPage({ herd, openAnimal }: { herd: Herd; openAnimal: (id: string) => void }) {
  const all = herd.animals ?? [];
  const breeds = useMemo(() => topBreeds(all), [all]);
  const [breed, setBreed] = useState<string>('all');
  const animals = breed === 'all' ? all : all.filter((a) => a.breed === breed);
  const ws = weights(animals);
  const avg = mean(ws), med = median(ws);
  const len = mean(animals.map((a) => pos(a.bodyLengthCm)).filter((v): v is number => v !== null));
  const height = mean(animals.map((a) => pos(a.withersHeightCm)).filter((v): v is number => v !== null));
  const heaviest = [...animals].filter((a) => fmtW(a.weightKg) !== null).sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0)).slice(0, 5);

  return (
    <div className="pf-page">
      <div className="pf-top">
        <div><h1 className="w8">Analytics</h1>
          <div className="pf-sub">{herd.animals === null ? 'Loading the herd…' : `${animals.length} animals · ${ws.length} with an estimated weight`}</div></div>
        {breeds.length > 1 && <Pills label="Filter by breed" value={breed} onChange={setBreed}
          options={[{ id: 'all', label: 'All breeds' }, ...breeds.map((x) => ({ id: x, label: x }))]} />}
      </div>

      {herd.animals === null ? <SkelKpis /> : (
      <div className="pf-kpis" key={breed}>
        <Kpi label="Mean weight" value={avg} unit="kg" note={ws.length ? `from ${ws.length} estimates` : 'no estimates yet'} />
        <Kpi label="Median weight" value={med} unit="kg" note="half the herd is above this" />
        <Kpi label="Heaviest" value={ws.length ? Math.max(...ws) : null} unit="kg" note={ws.length ? `lightest ${Math.min(...ws)} kg` : '—'} />
        <Coverage withW={ws.length} total={animals.length} />
      </div>)}

      <div className="pf-row">
        <div style={{ flex: 1.45, minWidth: 0 }}><div className="pf-sect w6">Weight distribution</div>
          <div className="pf-card pf-pad">{herd.animals === null ? <SkelChart h={210} /> : <Histogram key={breed} ws={ws} avg={avg} />}</div></div>
        <div style={{ flex: 1, minWidth: 0 }}><div className="pf-sect w6">By breed</div>
          <div className="pf-card pf-pad">{herd.animals === null ? <SkelRows n={4} right={false} /> : <Breeds key={breed} animals={animals} />}</div></div>
      </div>

      <div className="pf-row">
        <div style={{ flex: 1.45, minWidth: 0 }}><div className="pf-sect w6">Body length and weight</div>
          <div className="pf-card pf-pad">
            <div className="pf-mini"><div><span>Mean body length</span><b className="w8">{len ?? '—'}{len !== null && <small> cm</small>}</b></div>
              <div><span>Mean withers height</span><b className="w8">{height ?? '—'}{height !== null && <small> cm</small>}</b></div></div>
            <Scatter key={breed} animals={animals} openAnimal={openAnimal} /></div></div>
        <div style={{ flex: 1, minWidth: 0 }}><div className="pf-sect w6">Heaviest animals</div>
          <div className="pf-card pf-list">
            {heaviest.map((a, i) => (
              <button key={a.id} className="it" onClick={() => openAnimal(a.id)}>
                <div className="pf-rank w7">{i + 1}</div>
                <div className="t"><span className="w6" style={{ display: 'inline', fontSize: 15, color: 'var(--label)', margin: 0 }}>{a.name}</span><span>{[a.breed, a.tagCode].filter(Boolean).join(' · ')}</span></div>
                <div className="w w8">{fmtW(a.weightKg)}<span className="w6">kg</span></div>
              </button>))}
            {herd.animals === null ? <SkelRows n={5} /> : !heaviest.length && <div className="pf-empty">No estimated weights yet.</div>}
          </div></div>
      </div>
      <div className="pf-card pf-note pf-disclaimer"><InfoIcon /><span>Weights are estimated by the PondiFarm model ({WEIGHT_MODEL_VERSION}). They are experimental and not validated against a scale.</span></div>
    </div>
  );
}
