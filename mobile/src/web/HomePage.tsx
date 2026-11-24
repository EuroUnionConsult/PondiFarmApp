import React, { useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import WeatherIcon from '../components/WeatherIcon';
import { KIND_LABEL, useWeather } from '../lib/weather';
import { fmtW, type Herd } from './herd';
import { Breeds, Histogram, Kpi, Ring, SkelChart, SkelKpis, SkelRows, mean, weights } from './charts';
import { ChartIcon, Chevron, CloudIcon, HourglassIcon, PhoneIcon } from './icons';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening'; };

export default function HomePage({ herd, members, openAnimal, goHerd, goAnalytics, goProfile, goWeather }: {
  herd: Herd; members: number | null; openAnimal: (id: string) => void; goHerd: () => void; goAnalytics: () => void; goProfile: () => void; goWeather: () => void;
}) {
  const { weather, unread } = useWeather();
  const wxNow = weather?.location ? weather.current : undefined;
  const topAlert = weather?.alerts?.[0];
  const { user } = useAuth();
  const all = herd.animals ?? [];
  const ws = useMemo(() => weights(all), [all]);
  const avg = mean(ws);
  const lo = ws.length ? Math.min(...ws) : null, hi = ws.length ? Math.max(...ws) : null;
  const first = (user?.name ?? '').trim().split(/\s+/)[0];
  const synced = herd.pending === 0;
  const latest = all.slice(0, 5);
  const loading = herd.animals === null;
  const pending = user?.membershipStatus === 'pending';
  const pendingOrg = user?.pendingOrganizationName || 'the organization';

  return (
    <div className="pf-page">
      <div className="pf-top">
        <div><h1 className="w8">{greeting()}{first ? `, ${first}` : ''}</h1>
          <div className="pf-sub">{pending ? pendingOrg : user?.organizationName || 'Your organization'} · {pending ? 'waiting for approval' : herd.animals === null ? 'loading the herd…' : `${all.length} animals in the herd`}</div></div>
        <div className="pf-actions">
          {/* O tempo da quinta agora, com o aviso mais importante (abre a página do tempo). */}
          {wxNow && (
            <button className="pf-card pf-wxchip" onClick={goWeather} aria-label={`Weather: ${Math.round(wxNow.temp)} degrees. ${topAlert ? topAlert.title : 'No welfare alerts'}. Open the weather page.`}>
              <WeatherIcon kind={wxNow.kind} size={30} chip dot={unread} />
              <span><b className="w7">{Math.round(wxNow.temp)}° · {KIND_LABEL[wxNow.kind]}</b><small className={`w6${topAlert ? ' warn' : ''}`}>{topAlert ? topAlert.title : 'No welfare alerts'}</small></span>
            </button>)}
          <button className="pf-btn l w7" onClick={goAnalytics}><ChartIcon />Analytics</button>
          <button className="pf-btn g w7" onClick={goHerd}>Open the herd</button>
        </div>
      </div>

      {/* À espera do Líder: o mesmo aviso da Home do iPhone (PendingApprovalBanner). */}
      {pending && (
        <button className="pf-card pf-wait" onClick={goProfile} aria-label={`Waiting for approval from ${pendingOrg}. Open your profile.`}>
          <span className="ic" aria-hidden="true"><HourglassIcon /></span>
          <span className="tx"><b className="w7">Waiting for approval</b>
            <span>Until the leader of {pendingOrg} approves you, you don’t see the organization’s herd. This page opens it by itself once you’re approved.</span></span>
          <Chevron />
        </button>
      )}

      {loading ? <SkelKpis /> : (
      <div className="pf-kpis">
        <Kpi label="Animals" value={herd.animals === null ? null : all.length} note={`${ws.length} with an estimated weight`} />
        <Kpi label="Mean weight" value={avg} unit="kg" note={ws.length ? `from ${ws.length} estimates` : 'no estimates yet'} />
        <Kpi label="Weight range" value={null} text={lo !== null ? `${lo}–${hi}` : '—'} unit={lo !== null ? 'kg' : undefined} note="lightest to heaviest" />
        <Kpi label="Team" value={members} note={members === 1 ? 'member in the organization' : 'members in the organization'} />
      </div>
      )}

      <div className="pf-row">
        <div style={{ flex: 1.45, minWidth: 0 }}><div className="pf-sect w6">Herd by weight</div>
          <div className="pf-card pf-pad">{loading ? <SkelChart /> : <Histogram ws={ws} avg={avg} height={190} />}</div></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pf-secthead"><div className="pf-sect w6">Latest records</div><button className="pf-link w6" onClick={goHerd}>View all</button></div>
          <div className="pf-card pf-list">
            {latest.map((a, i) => { const w = fmtW(a.weightKg); return (
              <button key={a.id} className="it pf-rise" style={{ animationDelay: `${i * 45}ms` }} onClick={() => openAnimal(a.id)}>
                <div className="t"><span className="w6 nm">{a.name}</span><span>{[a.breed, a.tagCode].filter(Boolean).join(' · ')}</span></div>
                <div className="w w8">{w ?? '—'}{w !== null && <span className="w6">kg</span>}</div>
              </button>); })}
            {herd.animals !== null && !all.length && <div className="pf-empty">No animals yet. Records from your team appear here as they sync.</div>}
            {loading && <SkelRows n={5} />}
          </div></div>
      </div>

      <div className="pf-row">
        <div style={{ flex: 1.45, minWidth: 0 }}><div className="pf-sect w6">Breeds</div>
          <div className="pf-card pf-pad">{loading ? <SkelRows n={3} right={false} /> : <Breeds animals={all} limit={4} />}</div></div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}><div className="pf-sect w6">Sync</div>
          <div className="pf-card pf-sync">
            <Ring pct={synced ? 100 : 0} size={72} label={synced ? 'All records synced' : 'Records waiting to sync'} />
            <div><div className="w7" style={{ fontSize: 15.5 }}>{synced ? 'Everything is synced' : `${herd.pending} records waiting to sync`}</div>
              <div className="pf-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className="pf-i"><CloudIcon /></span>Data from your organization&apos;s account</div></div>
          </div>
          <div className="pf-card pf-note" style={{ marginTop: 14 }}><PhoneIcon />New scans are captured with the iPhone app. They appear here as soon as they sync.</div>
        </div>
      </div>
    </div>
  );
}
