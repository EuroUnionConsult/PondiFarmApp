import React, { useEffect, useState } from 'react';
import WeatherIcon from '../components/WeatherIcon';
import { useAuth } from '../lib/AuthContext';
import { BAND_LABEL, KIND_LABEL, forecastNotice, useWeather, type Weather } from '../lib/weather';
import FarmLocationDialog from './FarmLocationDialog';
import { Skel, SkelChart, SkelRows } from './charts';
import PondiLoader from '../components/PondiLoader';

/**
 * Tempo e bem-estar no computador: o tempo agora, o stress térmico (THI) e os avisos
 * lado a lado, as próximas 24 h, 7 dias e o resumo da estação. Os números e os
 * avisos vêm do servidor (os mesmos da app).
 */
const band = (x: number) => (x >= 84 ? 'emergency' : x >= 79 ? 'danger' : x >= 75 ? 'alert' : 'normal');
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
// Ícones dos avisos, em JSX (nada vindo do servidor entra como HTML).
const ALERT_IC: Record<string, React.ReactNode> = {
  heat: <><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z" /><path d="M12 9v7" /></>,
  rain: <><path d="M7 15a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 7a4 4 0 0 1-.5 8z" /><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" /></>,
  cold: <path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18" />,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7" />,
  ok: <path d="m5 12 5 5L20 7" />,
};
const Ic = ({ k }: { k: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{ALERT_IC[k] ?? null}</svg>
);

/** Esqueleto da previsão (a forma da página a pulsar) enquanto a 1.ª chega. */
function WeatherSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the forecast">
      <div className="pf-wx-grid">
        <div className="pf-card pf-wx-now"><Skel w={44} h={13} /><Skel w={150} h={56} r={12} style={{ margin: '10px 0 8px' }} /><Skel w={180} h={14} /><Skel w={230} h={12} style={{ marginTop: 12 }} /></div>
        <div className="pf-card pf-wx-thi"><Skel w={140} h={13} /><Skel w={80} h={44} r={10} style={{ margin: '10px 0 8px' }} /><Skel h={8} r={6} style={{ marginTop: 16 }} /><Skel w="90%" h={12} style={{ marginTop: 16 }} /></div>
        <div className="pf-card pf-wx-alerts"><SkelRows n={3} right={false} /></div>
      </div>
      <div className="pf-sect w6">Next 24 hours</div>
      <div className="pf-card pf-wx-chart"><SkelChart h={200} /></div>
    </div>
  );
}

export default function WeatherPage() {
  const { user } = useAuth();
  const { weather: w, loading, error, updating, markSeen } = useWeather();
  const notice = forecastNotice(w, error, updating);
  const [editing, setEditing] = useState(false);
  const leader = user?.role === 'leader';
  useEffect(() => { if (w?.alerts?.length) markSeen(); }, [w, markSeen]);

  if (!w) return <div className="pf-page"><div className="pf-top"><div><h1 className="w8">Weather</h1><div className="pf-sub">{loading ? 'Loading the forecast…' : error ?? ''}</div></div></div>{loading && <WeatherSkeleton />}</div>;

  if (!w.location) {
    return (
      <div className="pf-page">
        <div className="pf-top"><div><h1 className="w8">Weather</h1><div className="pf-sub">Forecast and welfare alerts for your farm</div></div></div>
        <div className="pf-card pf-wx-empty">
          <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg></div>
          <b className="w7">Where is the farm?</b>
          <p>{leader ? 'Mark the farm once and everyone in the organization sees its forecast and welfare alerts.' : 'Ask the leader of your organization to mark the farm location in the Profile.'}</p>
          {leader && <button className="pf-btn g w7" onClick={() => setEditing(true)}>Set the farm location</button>}
        </div>
        {editing && <FarmLocationDialog onClose={() => setEditing(false)} />}
      </div>
    );
  }

  const top = (
    <div className="pf-top">
      <div><h1 className="w8">Weather</h1>
        <div className="pf-sub">{w.location.label ?? 'Farm'} · {w.replay ? `replay of a real day (${w.replay}), ERA5 / Copernicus` : `ECMWF forecast${w.updatedAt && w.current ? `, updated ${hhmm(w.updatedAt)}` : ''}`}</div></div>
      {leader && <div className="pf-actions"><button className="pf-btn l w7" onClick={() => setEditing(true)}>Change farm location</button></div>}
    </div>
  );
  // O aviso fica no fluxo normal da página, por baixo do cabeçalho (antes tinha
  // margem negativa e sobrepunha-se ao subtítulo).
  const noticeEl = notice && (
    <div className="pf-wx-notice" role="status" aria-live="polite">{updating && <PondiLoader size={18} label="Updating forecast" />}{notice}</div>
  );

  // Sítio novo acabado de guardar: a previsão ainda vem a caminho (ou falhou).
  if (!w.current) {
    return (
      <div className="pf-page">
        {top}
        {noticeEl}
        {loading || updating
          ? <WeatherSkeleton />
          : <div className="pf-card pf-wx-wait">{error ?? 'No forecast yet.'}</div>}
        {editing && <FarmLocationDialog onClose={() => setEditing(false)} />}
      </div>
    );
  }

  const cur = w.current;
  const peak = w.thiPeak ?? cur.thi;
  const pos = Math.max(0, Math.min(100, ((cur.thi - 60) / 30) * 100));
  return (
    <div className="pf-page">
      {top}
      {noticeEl}

      <div className="pf-wx-grid">
        <div className="pf-card pf-wx-now pf-rise">
          <div className="k w7">Now</div>
          <div className="t w8">{Math.round(cur.temp)}°<small className="w6">C</small><WeatherIcon kind={cur.kind} size={64} /></div>
          <div className="cond">{KIND_LABEL[cur.kind]} · feels like {Math.round(cur.feelsLike)}°</div>
          <div className="facts"><span>Humidity <b className="w6">{cur.rh}%</b></span><span>Wind <b className="w6">{Math.round(cur.wind)} km/h</b></span>
            {cur.uv != null && <span>UV <b className="w6">{cur.uv}</b></span>}{cur.aqi != null && <span>Air <b className="w6">{cur.aqi} AQI</b></span>}</div>
        </div>
        <div className="pf-card pf-wx-thi pf-rise" style={{ animationDelay: '60ms' }}>
          <div className="k w7"><span>Heat stress (THI)</span><span className={`band ${band(peak)}`}>today’s peak {Math.round(peak)}</span></div>
          <div className="v w8">{Math.round(cur.thi)}</div><span className={`band ${cur.thiBand}`}>{BAND_LABEL[cur.thiBand]}</span>
          <div className="scale"><span className="n" /><span className="a" /><span className="d" /><span className="e" /></div>
          <div className="mk"><i style={{ left: `${pos}%` }} /></div>
          <div className="lbls"><span>Normal</span><span>75 Alert</span><span>79 Danger</span><span>84</span></div>
          <p>Temperature and humidity together: what the animals feel. Above 75 beef cattle start to struggle; above 79 it is dangerous.</p>
        </div>
        <div className="pf-card pf-wx-alerts pf-rise" style={{ animationDelay: '120ms' }}>
          {(w.alerts ?? []).length === 0
            ? <div className="al"><div className="ic ok"><Ic k="ok" /></div><div><b className="w7">No welfare alerts for the next 24 hours</b><span>Comfortable for the herd: THI stays below 75 and no rain or cold night is expected.</span></div></div>
            : w.alerts!.map((a) => (
              <div key={a.id} className="al"><div className={`ic ${a.kind}${a.severity === 'danger' ? ' danger' : ''}`}><Ic k={a.kind} /></div>
                <div><b className="w7">{a.title}</b><span>{a.text}</span></div><div className="when">{a.start}–{a.end}</div></div>))}
        </div>
      </div>

      <div className="pf-sect w6">Next 24 hours</div>
      <div className="pf-card pf-wx-chart">
        <div className="legend"><span><i style={{ background: 'var(--green)' }} />Temperature</span><span><i style={{ background: '#2563A8', opacity: 0.55 }} />Rain (mm)</span><span><i className="al" />Heat-stress alert</span><span><i className="dg" />Danger</span></div>
        <Chart w={w} />
      </div>

      <div className="pf-wx-row">
        {!!w.days?.length && <div><div className="pf-sect w6">Next 7 days</div>
          <div className="pf-card pf-wx-week">{w.days.map((d, i) => (
            <div key={d.date} className="wd"><div className="d w6">{i === 0 ? 'Today' : new Date(`${d.date}T12:00`).toLocaleDateString('en-GB', { weekday: 'short' })}</div>
              <div className="ic"><WeatherIcon kind={d.kind} size={40} /></div>
              <div><span className="mx w7">{Math.round(d.max)}°</span> <span className="mn">{Math.round(d.min)}°</span></div><div className="p">{d.pop ? `${d.pop}% rain` : ''}</div></div>))}</div></div>}
        {w.season && <div><div className="pf-sect w6">This season on the farm</div>
          <div className="pf-card pf-wx-season"><div className="k w7">Since {fmtDay(w.season.from)}</div>
            <div className="big"><div className="a"><b className="w8">{w.season.alertDays}</b>days with heat-stress alert</div><div className="d"><b className="w8">{w.season.dangerDays}</b>days in danger</div></div>
            <p>Heat is the main welfare risk here in summer. On those days the app warns the team with the hours to avoid.</p></div></div>}
      </div>
      <p className="pf-foot">Forecast: ECMWF IFS (European model) via Open-Meteo. UV and air quality: Copernicus Atmosphere Monitoring Service (CAMS). Season: ERA5, Copernicus Climate Change Service. Heat-stress bands: Livestock Weather Safety Index for beef cattle. The farm location is stored rounded to about 1 km.</p>
      {editing && <FarmLocationDialog onClose={() => setEditing(false)} />}
    </div>
  );
}

function Chart({ w }: { w: Weather }) {
  const h = w.hours!, n = h.time.length, W = 1100, H = 230, P = { l: 34, r: 30, t: 14, b: 26 };
  const cw = W - P.l - P.r, ch = H - P.t - P.b;
  const tmin = Math.floor(Math.min(...h.temp) - 2), tmax = Math.ceil(Math.max(...h.temp) + 2);
  const x = (i: number) => P.l + (i / Math.max(1, n - 1)) * cw;
  const y = (t: number) => P.t + ch - ((t - tmin) / Math.max(1, tmax - tmin)) * ch;
  const step = cw / Math.max(1, n - 1), rmax = Math.max(1, ...h.rain.map((r) => r || 0));
  const path = h.temp.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(t).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="svg">
      {h.thi.map((v, i) => v >= 75 && <rect key={`t${i}`} x={x(i) - step / 2} y={P.t} width={step} height={ch} className={v >= 79 ? 'dg' : 'al'} />)}
      {[0, 1, 2, 3, 4].map((k) => { const t = tmin + ((tmax - tmin) * k) / 4, yy = y(t); return (
        <g key={k}><line x1={P.l} x2={P.l + cw} y1={yy} y2={yy} className="grid" /><text x={P.l - 8} y={yy + 4} textAnchor="end" className="ax">{Math.round(t)}°</text></g>); })}
      {h.rain.map((r, i) => r > 0 && <rect key={`r${i}`} x={x(i) - 5} y={P.t + ch - (r / rmax) * ch * 0.45} width={10} height={(r / rmax) * ch * 0.45} rx={3} fill="#2563A8" opacity={0.55} />)}
      <path d={`${path} L${x(n - 1)},${P.t + ch} L${x(0)},${P.t + ch} Z`} className="area" />
      <path d={path} className="line" />
      <circle cx={x(0)} cy={y(h.temp[0])} r={5} className="dot" />
      {[0, 6, 12, 18, n - 1].filter((i) => i < n).map((i) => <text key={`h${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="ax">{i === 0 ? 'now' : h.time[i].slice(11, 16)}</text>)}
    </svg>
  );
}
