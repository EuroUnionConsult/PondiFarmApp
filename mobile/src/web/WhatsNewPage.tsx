import React, { useEffect, useMemo, useState } from 'react';
import { APP_VERSION } from '../lib/version';
import {
  AREAS, STATUS_LABEL, byArea, hasWhatsNewFor, markWhatsNewSeen, upcomingSorted, whatsNewFor, type WhatsNewArea,
} from '../lib/whatsNew';
import { HerdIcon } from './icons';

// «What's new» no computador — conceito C «Árvore por área» (aprovado a 23/11/2026):
// as 4 áreas lado a lado, cada uma com o seu ramo, e o interruptor «All versions» /
// «Only <versão>». Os dados são os mesmos da app (src/lib/whatsNew.ts).
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ICONS: Record<WhatsNewArea, React.FC> = {
  scan: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" /></svg>,
  herd: HerdIcon,
  weather: () => <svg viewBox="0 0 24 24" {...P}><path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2" /><path d="M17 20H8.5a4 4 0 1 1 .7-7.9 5 5 0 0 1 9.3 2.6A2.7 2.7 0 0 1 17 20z" /></svg>,
  team: () => <svg viewBox="0 0 24 24" {...P}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a6.5 6.5 0 0 1 3 6" /></svg>,
};

export default function WhatsNewPage({ onBack }: { onBack?: () => void }) {
  const [only, setOnly] = useState(false);
  // «Released» (o que já saiu) | «Coming next» (em curso / planeado).
  const [next, setNext] = useState(false);
  const upcoming = useMemo(() => upcomingSorted(), []);
  useEffect(() => { void markWhatsNewSeen(); }, []);
  const items = useMemo(() => whatsNewFor(APP_VERSION, only), [only]);
  return (
    <div className="pf-page pf-wn">
      {onBack && <button className="pf-link w6 pf-wn-back" onClick={onBack}>‹ Profile</button>}
      <div className="pf-top">
        <div><h1 className="w8">What&apos;s new</h1><div className="pf-sub">You have version {APP_VERSION}</div></div>
        <div className="pf-wn-segs">
          <div className="pf-wn-seg" role="radiogroup" aria-label="Released or coming next">
            <button role="radio" aria-checked={!next} className={!next ? 'on w6' : 'w6'} onClick={() => setNext(false)}>Released</button>
            <button role="radio" aria-checked={next} className={next ? 'on w6' : 'w6'} onClick={() => setNext(true)}>Coming next</button>
          </div>
          {!next && <div className="pf-wn-seg" role="radiogroup" aria-label="Versions shown">
            <button role="radio" aria-checked={!only} className={!only ? 'on w6' : 'w6'} onClick={() => setOnly(false)}>All versions</button>
            <button role="radio" aria-checked={only} className={only ? 'on w6' : 'w6'} onClick={() => setOnly(true)}>Only {APP_VERSION}</button>
          </div>}
        </div>
      </div>
      {next ? <>
        <p className="pf-sub pf-wn-intro">What we are working on now, and what comes after it.</p>
        <div className="pf-wn-next">
          {upcoming.map((u) => {
            const Icon = ICONS[u.area];
            return (
              <section key={u.title} className="pf-card pf-wn-up" aria-label={u.title}>
                <h2 className="w7"><span className="ic"><Icon /></span><span>{u.title}<small>{AREAS.find((a) => a.key === u.area)?.label}</small></span></h2>
                <span className={`pf-wn-status w7 ${u.status}`}>{STATUS_LABEL[u.status]}</span>
                <p className="tx">{u.text}</p>
              </section>
            );
          })}
        </div>
      </> : <>
      <div className="pf-wn-grid">
        {AREAS.map((a) => {
          const list = byArea(items, a.key);
          const Icon = ICONS[a.key];
          return (
            <section key={a.key} className="pf-card pf-wn-col" aria-label={a.label}>
              <h2 className="w7"><span className="ic"><Icon /></span>{a.label}</h2>
              {list.length === 0
                ? <p className="pf-wn-empty">Nothing new here in {APP_VERSION}.</p>
                : <ul className="pf-wn-branch">
                    {list.map((it, i) => (
                      <li key={`${it.version}-${i}`}>
                        <span className={`pf-wn-badge w7${it.version === APP_VERSION ? ' new' : ''}`}>{it.version}</span>
                        <span className="tx">{it.text}</span>
                      </li>))}
                  </ul>}
            </section>
          );
        })}
      </div>
      {hasWhatsNewFor(APP_VERSION) && <p className="pf-foot pf-wn-legend"><span className="sw" aria-hidden="true" />Green = new in your version</p>}
      </>}
    </div>
  );
}
