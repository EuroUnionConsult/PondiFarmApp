import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { canEditSex, fetchAnimalScans, fetchScanHistory, type ScanHistoryData, fetchScanMesh, updateAnimalSex, type AnimalSex, type CloudAnimal, type MeshFormat, type ScanPoint } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { fmtW, type Herd } from './herd';
import { Pills, Skel, SkelRows, mean, pos, topBreeds, useCountUp, weights } from './charts';
import { CloudIcon, FemaleIcon, MaleIcon, PhoneIcon, SearchIcon } from './icons';
import { useTheme } from '../lib/ThemeContext';
import type { MeshSource } from './ScanViewer';
import { fmtScanDate, fmtScanTime, growthSummary, measureDeltas, shrunk, weatherDiffers, weatherLine, weightDelta, weightMargin } from '../lib/scanHistory';
import EmptyState, { EMPTY_HINT_WEB } from '../components/EmptyState';

// three.js só se descarrega ao abrir uma ficha com modelo 3D (pedaço próprio do bundle).
const ScanViewer = lazy(() => import('./ScanViewer'));

type Sort = 'name' | 'heavy' | 'light';
const SORTS: { id: Sort; label: string }[] = [{ id: 'name', label: 'Name' }, { id: 'heavy', label: 'Heaviest' }, { id: 'light', label: 'Lightest' }];
const cm = (v: number | null) => (pos(v) ? `${Math.round(v as number)} cm` : '—');

/** Valor do animal numa barra entre o mínimo e o máximo do rebanho, com a média marcada. */
function Compare({ label, value, all, unit }: { label: string; value: number | null; all: number[]; unit: string }) {
  if (!all.length) return null;
  const lo = Math.round(Math.min(...all)), hi = Math.round(Math.max(...all)), avg = mean(all) ?? lo, span = hi - lo || 1;
  const at = value === null ? null : ((value - lo) / span) * 100;
  return (
    <div className="pf-cmp">
      <div className="l"><span>{label}</span><span className="w6">{value === null ? '—' : `${Math.round(value)} ${unit}`}</span></div>
      <div className="track"><span className="avg" style={{ left: `${((avg - lo) / span) * 100}%` }} title={`Herd mean ${avg} ${unit}`} />
        {at !== null && <span className="dot" style={{ left: `${at}%` }} />}</div>
      <div className="ax"><span>{lo}</span><span>mean {avg}</span><span>{hi}</span></div>
    </div>
  );
}

// Histórico já pedido nesta sessão: voltar a um animal não repete o pedido.
const historyCache = new Map<string, ScanPoint[]>();
const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Evolução do peso estimado ao longo dos scans do animal. */
function WeightHistory({ id }: { id: string }) {
  const [pts, setPts] = useState<ScanPoint[] | null>(historyCache.get(id) ?? null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (historyCache.has(id)) return;
    let alive = true;
    fetchAnimalScans(id).then((p) => { historyCache.set(id, p); if (alive) setPts(p); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [id]);
  if (failed) return <div className="pf-sub">The scan history could not be loaded.</div>;
  if (pts === null) return <Skel h={130} r={12} />;
  const ws = pts.filter((p): p is ScanPoint & { weightKg: number } => p.weightKg !== null && p.weightKg > 0);
  if (ws.length < 2) return <div className="pf-sub">{ws.length === 1 ? `One scan so far (${fmtDate(ws[0].at)}). The trend appears after the next scan.` : 'No scans with a weight yet.'}</div>;
  const W = 340, H = 130, PX = 10, PY = 16;
  const t0 = ws[0].at, t1 = ws[ws.length - 1].at, lo = Math.min(...ws.map((p) => p.weightKg)), hi = Math.max(...ws.map((p) => p.weightKg));
  const x = (t: number) => PX + ((t - t0) / (t1 - t0 || 1)) * (W - 2 * PX), y = (w: number) => H - PY - ((w - lo) / (hi - lo || 1)) * (H - 2 * PY);
  const line = ws.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.weightKg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1).toFixed(1)} ${H - 4} L${x(t0).toFixed(1)} ${H - 4} Z`;
  const diff = Math.round(ws[ws.length - 1].weightKg - ws[0].weightKg);
  const h = hover !== null ? ws[hover] : null;
  return (
    <div className="pf-hist2">
      <div className="top"><span className={`pf-delta w6 ${diff >= 0 ? 'up' : 'down'}`}>{diff >= 0 ? '+' : '−'}{Math.abs(diff)} kg since {fmtDate(t0)}</span>
        <span className="pf-sub" style={{ margin: 0 }}>{h ? `${fmtDate(h.at)} · ${Math.round(h.weightKg)} kg` : `${ws.length} scans`}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="pf-wline" role="img" aria-label={`Weight from ${Math.round(ws[0].weightKg)} to ${Math.round(ws[ws.length - 1].weightKg)} kg over ${ws.length} scans`} onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="pf-wfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--green)" stopOpacity=".28" /><stop offset="1" stopColor="var(--green)" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#pf-wfill)" className="ar" />
        <path d={line} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="ln" />
        {ws.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <circle cx={x(p.at)} cy={y(p.weightKg)} r={14} fill="transparent" />
            <circle cx={x(p.at)} cy={y(p.weightKg)} r={i === ws.length - 1 || i === hover ? 5 : 3.5} className={`pt${i === hover ? ' on' : ''}`} style={{ animationDelay: `${300 + i * 60}ms` }} />
          </g>))}
      </svg>
      <div className="pf-hist-axis"><span>{fmtDate(t0)}</span><span>{fmtDate(t1)}</span></div>
    </div>
  );
}

const scanHistCache = new Map<string, ScanHistoryData>();

/** Scans do animal: o mais recente em destaque, os anteriores numa lista (com o tempo). */
function ScanHistoryPanel({ id }: { id: string }) {
  const [data, setData] = useState<ScanHistoryData | null>(scanHistCache.get(id) ?? null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    setOpenId(null);
    if (scanHistCache.has(id)) { setData(scanHistCache.get(id) ?? null); return; }
    let alive = true;
    setData(null); setFailed(false);
    fetchScanHistory(id).then((d) => { scanHistCache.set(id, d); if (alive) setData(d); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [id]);
  if (failed) return <div className="pf-sub">The scan history could not be loaded.</div>;
  if (!data) return <SkelRows n={3} />;
  const scans = data.scans.filter((x) => x.weightKg != null && x.weightKg > 0);
  if (!scans.length) return <div className="pf-sub">No scans with a weight yet.</div>;
  const n = scans.length, latest = scans[n - 1];
  const shown = scans.find((x) => x.id === openId) ?? latest;
  const i = scans.indexOf(shown), prev = scans[i - 1], isOld = shown !== latest;
  const d = weightDelta(shown, prev), kg = Math.round(shown.weightKg as number);
  const wl = weatherLine(data.weather[shown.id]);
  const muted = { color: 'var(--muted)', fontSize: 13 } as const;
  return (
    <div className="pf-card" style={{ padding: 16 }}>
      {isOld && (
        <div role="status" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: 'var(--soft)', marginBottom: 10 }}>
          <span className="w6">Previous scan · {i + 1} of {n} · not the current one</span>
          <button type="button" className="pf-link w6" onClick={() => setOpenId(null)} style={{ background: 'none', border: 0, color: 'var(--green)', cursor: 'pointer', padding: 0 }}>Back to latest</button>
        </div>)}
      <div style={muted}>{isOld ? 'Scan of' : 'Latest scan'} · {fmtScanDate(shown.at)}, {fmtScanTime(shown.at)}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <span className="w8" style={{ fontSize: 26 }}>≈ {kg} kg</span><span style={{ color: 'var(--muted)' }}>± {weightMargin(kg)}</span>
        <span className="pf-tag w6">Experimental</span></div>
      {d && <div className={`pf-delta w6 ${d.withinMargin ? '' : d.kg >= 0 ? 'up' : 'down'}`} style={{ marginTop: 6 }}>
        {d.kg >= 0 ? '+' : '−'}{Math.abs(d.kg)} kg vs previous scan{d.withinMargin ? ' · within margin' : ''}</div>}
      {isOld && <div style={muted}>Today: ≈ {Math.round(latest.weightKg as number)} kg ± {weightMargin(latest.weightKg as number)}</div>}
      <div style={{ marginTop: 8, fontSize: 13.5 }}>
        {!data.hasLocation ? 'Set the farm location to see weather' : data.weatherFailed ? 'Weather unavailable right now' : wl ? `Weather at scan: ${wl}` : 'No weather data for this scan yet'}</div>
      {isOld && data.hasLocation && !data.weatherFailed && (() => {
        const a = data.weather[shown.id], b = data.weather[latest.id];
        const rows: [string, (x?: typeof a) => string][] = [
          ['Temperature', (x) => (x?.tempC != null ? `${Math.round(x.tempC)} °C` : '—')],
          ['Humidity', (x) => (x?.humidity != null ? `${Math.round(x.humidity)} %` : '—')],
          ['THI', (x) => (x?.thi != null ? `${Math.round(x.thi)}${x.heatStress ? ' · heat stress' : ''}` : '—')],
          ['Rain 24 h', (x) => (x?.rain24hMm != null ? `${x.rain24hMm} mm` : '—')]];
        return (<>
          <table className="pf-histtbl"><thead><tr><th /><th>Then</th><th>Latest</th></tr></thead>
            <tbody>{rows.map(([l, f]) => <tr key={l}><td>{l}</td><td>{f(a)}</td><td>{f(b)}</td></tr>)}</tbody></table>
          {weatherDiffers(a, b) && <div style={{ color: 'var(--orange)', fontSize: 13, marginTop: 4 }}>The weather was very different. Compare with care.</div>}
        </>);
      })()}
      <table className="pf-histtbl"><thead><tr><th>Measurements</th><th>{isOld ? 'Then' : 'Now'}</th><th>{isOld ? 'Latest' : 'Since previous'}</th></tr></thead>
        <tbody>{measureDeltas(shown, isOld ? latest : prev).map((m) => (
          <tr key={m.label}><td>{m.label}</td><td>{m.now != null ? `${Math.round(m.now)} cm` : '—'}</td>
            <td>{isOld ? (m.before != null ? `${Math.round(m.before)} cm` : '—') : m.diff != null ? `${m.diff >= 0 ? '+' : '−'}${Math.abs(m.diff)} cm` : '—'}</td></tr>))}</tbody></table>
      {shrunk(shown, prev) && <div style={{ color: 'var(--orange)', fontSize: 13, marginTop: 6 }}>Check this scan. It may have been taken in a different pose.</div>}
      {n > 1 && <>
        <div className="w6" style={{ ...muted, marginTop: 16, marginBottom: 4 }}>Previous scans</div>
        {scans.slice(0, -1).reverse().map((x) => {
          const line = weatherLine(data.weather[x.id]);
          return (
            <button type="button" key={x.id} onClick={() => setOpenId(x.id)} aria-pressed={x.id === shown.id}
              style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '9px 6px', border: 0, borderTop: '1px solid var(--line)', background: x.id === shown.id ? 'var(--sel)' : 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block' }}>{fmtScanDate(x.at)} · {fmtScanTime(x.at)}</span>
                {line && <span style={{ ...muted, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line}</span>}</span>
              <span className="w6">{Math.round(x.weightKg as number)} kg</span>
            </button>);
        })}
      </>}
      {n > 1 && <>
        <div className="w6" style={{ ...muted, marginTop: 16, marginBottom: 4 }}>Growth & weather</div>
        <div style={{ fontSize: 14 }}>{growthSummary(scans[0], latest, n)}</div>
        {data.hasLocation && data.intervals.length > 0 && (
          <table className="pf-histtbl"><thead><tr><th>Between scans</th><th>Avg max</th><th>Heat days</th><th>Rain</th></tr></thead>
            <tbody>{data.intervals.map((iv) => {
              const a = scans.find((p) => p.id === iv.fromScanId), b = scans.find((p) => p.id === iv.toScanId);
              if (!a || !b) return null;
              const dm = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              return <tr key={iv.fromScanId}><td>{dm(a.at)}–{dm(b.at)}</td><td>{iv.avgMaxTempC != null ? `${Math.round(iv.avgMaxTempC)} °C` : '—'}</td><td>{iv.heatDays ?? '—'}</td><td>{iv.rainMm != null ? `${Math.round(iv.rainMm)} mm` : '—'}</td></tr>;
            })}</tbody></table>)}
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--soft)', fontSize: 13 }}>
          <b className="w6">How sure is this?</b><br />Measurements are more stable than weight. Weight is an estimate of ± 10 % today; it is being calibrated with scale weights at farm visits.</div>
      </>}
    </div>
  );
}

/**
 * De onde vem o modelo 3D do último scan: da API, quando o app já o enviou
 * (hasMesh). `pf-demo-mesh` (localStorage) serve só a pré-visualização local.
 */
function meshSourceFor(a: CloudAnimal): MeshSource | null {
  if (a.hasMesh && a.latestScanId) { const id = a.latestScanId; return () => fetchScanMesh(id); }
  let demo: string | null = null;
  try { demo = localStorage.getItem('pf-demo-mesh'); } catch { /* sem storage */ }
  if (!demo) return null;
  const url = demo;
  return async () => ({ format: (url.split('.').pop() ?? 'glb').toLowerCase() as MeshFormat, data: await (await fetch(url)).arrayBuffer() });
}

function Scan3D({ a }: { a: CloudAnimal }) {
  const { mode } = useTheme();
  const load = useMemo(() => meshSourceFor(a), [a.id, a.hasMesh, a.latestScanId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (load) return <Suspense fallback={<Skel h={300} r={16} />}><ScanViewer load={load} dark={mode === 'dark'} /></Suspense>;
  return (
    <div className="pf-3d-empty"><PhoneIcon /><div><b className="w6">The 3D model is on the iPhone</b>
      <span>This scan has no 3D model in the cloud yet. It is sent automatically the next time the iPhone that captured it syncs (app version with 3D upload).</span></div></div>
  );
}

/** Sexo na ficha: todos veem; só quem criou o animal (o primeiro scan) escolhe. */
function SexField({ a, onSaved }: { a: CloudAnimal; onSaved: () => void }) {
  const { user } = useAuth();
  const [sex, setSex] = useState<AnimalSex>(a.sex ?? 'unknown');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setSex(a.sex ?? 'unknown'); setErr(null); }, [a.id, a.sex]);
  const editable = canEditSex(a, user);
  const pick = (next: AnimalSex) => {
    const target = next === sex ? 'unknown' : next;   // tocar de novo limpa
    const before = sex;
    setSex(target); setErr(null);
    updateAnimalSex(a.id, target).then(() => { a.sex = target; onSaved(); }).catch((e) => { setSex(before); setErr(String(e?.message ?? e)); });
  };
  if (!editable) {
    return sex === 'unknown' ? null : (
      <span className={`pf-tag pf-sex ${sex} w6`}>{sex === 'female' ? <FemaleIcon /> : <MaleIcon />}{sex === 'female' ? 'Female' : 'Male'}</span>);
  }
  return (<>
    <span className="pf-sexpick" role="radiogroup" aria-label="Sex of the animal" title="You scanned this animal, so you set its sex. Everyone sees it.">
      {(['female', 'male'] as const).map((s) => (
        <button key={s} role="radio" aria-checked={sex === s} className={`w6 ${s}${sex === s ? ' on' : ''}`} onClick={() => pick(s)}>
          {s === 'female' ? <FemaleIcon /> : <MaleIcon />}{s === 'female' ? 'Female' : 'Male'}</button>))}
    </span>
    {err && <span className="pf-err" role="alert" style={{ width: '100%', margin: 0 }}>{err}</span>}
  </>);
}

function Sheet({ a, herd }: { a: CloudAnimal; herd: CloudAnimal[] }) {
  const [, redraw] = useState(0);   // depois de gravar o sexo (o ícone ao lado do nome)
  const w = fmtW(a.weightKg);
  const shown = useCountUp(w);
  const ws = weights(herd), avg = mean(ws);
  const diff = w !== null && avg !== null ? w - avg : null;
  // Percentagem dos OUTROS animais com peso que este supera (ele próprio não conta).
  const others = Math.max(0, ws.length - 1);
  const heavierPct = w !== null && others ? Math.round((ws.filter((x) => x < w).length / others) * 100) : null;
  const lighterPct = w !== null && others ? Math.round((ws.filter((x) => x > w).length / others) * 100) : null;
  const rank = heavierPct === null || lighterPct === null ? ''
    : lighterPct === 0 ? ' · the heaviest in the herd'
    : heavierPct === 0 ? ' · the lightest in the herd'
    : diff !== null && diff >= 0 ? ` · heavier than ${heavierPct}% of the herd` : ` · lighter than ${lighterPct}% of the herd`;
  const lens = herd.map((x) => pos(x.bodyLengthCm)).filter((v): v is number => v !== null);
  const hts = herd.map((x) => pos(x.withersHeightCm)).filter((v): v is number => v !== null);
  return (
    <aside className="pf-card pf-sheet pf-sheetin" aria-label={`${a.name} details`}>
      <div className="w8 pf-sheet-name" style={{ fontSize: 26, letterSpacing: -.5 }}>{a.name}
        {a.sex === 'female' && <span className="pf-sexicon female" aria-label="Female"><FemaleIcon /></span>}
        {a.sex === 'male' && <span className="pf-sexicon male" aria-label="Male"><MaleIcon /></span>}</div>
      <div className="pf-tags">
        {a.breed && <span className="pf-tag w6">{a.breed}</span>}
        {a.tagCode && <span className="pf-tag w6">Tag {a.tagCode}</span>}
        <span className="pf-badge w7"><span style={{ width: 14, display: 'inline-flex' }}><CloudIcon /></span>Synced</span>
        <SexField a={a} onSaved={() => redraw((n) => n + 1)} />
      </div>
      <div className="pf-est"><span className="lbl w7">Estimated weight</span><span className="exp w7">Experimental</span>
        <div className="num w8">{w !== null ? <>≈ {shown} <small className="w6">kg</small></> : '—'}</div>
        {diff !== null && (
          <div className={`pf-delta w6 ${diff >= 0 ? 'up' : 'down'}`}>{diff === 0 ? 'Same as the herd mean' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} kg vs the herd mean`}{rank}</div>)}
        <p>Experimental estimate, not validated against a scale</p></div>
      <div className="pf-sect w6" style={{ marginLeft: 2 }}>3D scan</div>
      <Scan3D a={a} />
      <div className="pf-sect w6" style={{ marginLeft: 2 }}>Scans</div>
      <ScanHistoryPanel id={a.id} />
      <div className="pf-sect w6" style={{ marginLeft: 2 }}>Weight over time</div>
      <WeightHistory id={a.id} />
      <div className="pf-sect w6" style={{ marginLeft: 2 }}>Compared with the herd</div>
      <Compare label="Weight" value={w} all={ws} unit="kg" />
      <Compare label="Body length" value={pos(a.bodyLengthCm)} all={lens} unit="cm" />
      <Compare label="Withers height" value={pos(a.withersHeightCm)} all={hts} unit="cm" />
      {a.notes ? <><div className="pf-sect w6" style={{ marginLeft: 2 }}>Notes</div><div className="pf-sub">{a.notes}</div></> : null}
    </aside>
  );
}

export default function HerdPage({ herd, selected, setSelected }: { herd: Herd; selected: string | null; setSelected: (id: string) => void }) {
  const all = herd.animals ?? [];
  const [q, setQ] = useState('');
  const [breed, setBreed] = useState('all');
  const [sort, setSort] = useState<Sort>('name');
  const breeds = useMemo(() => topBreeds(all), [all]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let xs = breed === 'all' ? all : all.filter((a) => a.breed === breed);
    if (s) xs = xs.filter((a) => [a.name, a.breed, a.tagCode].some((v) => (v ?? '').toLowerCase().includes(s)));
    const w = (a: CloudAnimal) => fmtW(a.weightKg);
    if (sort === 'name') return [...xs].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return [...xs].sort((a, b) => { const x = w(a), y = w(b); if (x === null) return 1; if (y === null) return -1; return sort === 'heavy' ? y - x : x - y; });
  }, [all, q, breed, sort]);
  // Com um filtro ativo, a ficha mostra sempre um animal da lista visível.
  const a = list.find((x) => x.id === selected) ?? list[0];
  const maxW = Math.max(1, ...weights(all));
  const listRef = useRef<HTMLDivElement>(null);

  // Setas ↑/↓ mudam de animal e a linha escolhida fica à vista. Só a navegação por
  // teclado faz scroll: um clique, um filtro ou uma ordenação nunca mexem na página.
  const byKey = useRef(false);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    byKey.current = true;
    const i = Math.max(0, list.findIndex((x) => x.id === a?.id));
    const n = list[Math.min(list.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (n) setSelected(n.id);
  };
  useEffect(() => {
    if (!byKey.current) return;
    byKey.current = false;
    listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }, [a?.id]);

  return (
    <div className="pf-page">
      <div className="pf-top">
        <div><h1 className="w8">Herd</h1>
          <div className="pf-sub">{herd.animals === null ? 'Loading the herd…' : `${list.length === all.length ? all.length : `${list.length} of ${all.length}`} animals · ${weights(all).length} with an estimated weight`}</div></div>
        <label className="pf-search"><SearchIcon /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, tag or breed" aria-label="Search the herd" /></label>
      </div>
      <div className="pf-toolbar">
        {breeds.length > 1 && <Pills label="Filter by breed" value={breed} onChange={setBreed} options={[{ id: 'all', label: 'All breeds' }, ...breeds.map((x) => ({ id: x, label: x }))]} />}
        <div className="pf-sortlbl">Sort by</div>
        <Pills label="Sort the herd" value={sort} onChange={setSort} options={SORTS} />
      </div>
      <div className="pf-row pf-split" style={{ alignItems: 'flex-start', marginTop: 16 }}>
        <div className="pf-card pf-table" style={{ flex: 1, minWidth: 0 }} ref={listRef} tabIndex={0} onKeyDown={onKey} aria-label="Animals. Use the arrow keys to move between them">
          <div className="hd w6"><span>Animal</span><span>Breed</span><span className="r">Body length</span><span className="r">Weight</span></div>
          <div key={`${breed}-${sort}-${q.trim()}`}>
            {list.map((x, i) => { const w = fmtW(x.weightKg); return (
              <button key={x.id} className={`tr${a?.id === x.id ? ' sel' : ''}${i < 18 ? ' pf-rise' : ''}`} style={i < 18 ? { animationDelay: `${i * 22}ms` } : undefined}
                onClick={() => setSelected(x.id)} aria-current={a?.id === x.id || undefined} tabIndex={-1}>
                <span className="nm" title={[x.name, x.tagCode, x.breed].filter(Boolean).join(' · ')}><b className="w6">{x.name}</b><small>{x.tagCode || '—'}<span className="brs">{x.breed ? ` · ${x.breed}` : ''}</span></small></span>
                <span className="br">{x.breed || '—'}</span>
                <span className="r">{cm(x.bodyLengthCm)}</span>
                <span className="r wt"><b className="w8">{w ?? '—'}</b>{w !== null && <small>kg</small>}
                  <i style={{ width: `${w !== null ? (w / maxW) * 100 : 0}%` }} /></span>
              </button>); })}
          </div>
          {herd.animals === null ? <SkelRows n={9} /> : !list.length && (all.length
            ? <EmptyState compact title="No results" text="Try a different name, tag or breed." />
            : <EmptyState title="No animals yet" text={EMPTY_HINT_WEB} />)}
        </div>
        {a ? <Sheet key={a.id} a={a} herd={all} /> : herd.animals === null && (
          <aside className="pf-card pf-sheet" aria-hidden="true"><Skel w={160} h={26} /><Skel w={220} h={22} style={{ marginTop: 12 }} />
            <Skel h={150} r={16} style={{ marginTop: 18 }} /><Skel w={180} h={12} style={{ marginTop: 22 }} /><Skel h={40} style={{ marginTop: 12 }} /><Skel h={40} style={{ marginTop: 12 }} /></aside>)}
      </div>
    </div>
  );
}
