import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkHealth, isCloudSyncEnabled, setCloudSyncEnabled } from '../lib/api';
import { CLOUD_CACHE_KEY } from '../lib/config';
import { clearAll } from '../lib/storage';
import { useAuth } from '../lib/AuthContext';
import { APP_VERSION } from '../lib/version';
import { WEIGHT_MODEL_FEATURE_COUNT, WEIGHT_MODEL_VERSION } from '../lib/weightModel';
import { CloudIcon, DesktopIcon, PhoneIcon } from './icons';

// Definições da versão de computador. Só o que faz sentido aqui: no browser não há
// scan nem vibração, por isso a raça por omissão e o «haptic feedback» ficam na app do iPhone.
type Section = 'cloud' | 'browser' | 'about';
const SECTIONS: { id: Section; label: string; hint: string; Icon: React.FC }[] = [
  { id: 'cloud', label: 'Cloud sync', hint: 'Connection to your organization', Icon: CloudIcon },
  { id: 'browser', label: 'This browser', hint: 'Session and saved data', Icon: DesktopIcon },
  { id: 'about', label: 'About', hint: 'Version and weight model', Icon: PhoneIcon },
];

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`pf-switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span className="knob" />
    </button>
  );
}

export function Confirm({ title, body, action, onCancel, onConfirm, tone = 'danger' }: { title: string; body: string; action: string; onCancel: () => void; onConfirm: () => void; tone?: 'danger' | 'go' }) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { ok.current?.focus(); const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onCancel]);
  return (
    <div className="pf pf-scrim" onClick={onCancel}>
      <div className="pf-dlg" role="dialog" aria-modal="true" aria-labelledby="pf-set-t" onClick={(e) => e.stopPropagation()}>
        <h3 id="pf-set-t" className="w8">{title}</h3><p>{body}</p>
        <div className="acts"><button className="pf-btn l w7" onClick={onCancel}>Cancel</button>
          <button ref={ok} className={`pf-btn ${tone === 'go' ? 'g' : 'r'} w7`} onClick={onConfirm}>{action}</button></div>
      </div>
    </div>
  );
}

function CloudPanel() {
  const [sync, setSync] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'off'>('checking');
  const refresh = useCallback(async (enabled: boolean) => {
    if (!enabled) { setStatus('off'); return; }
    setStatus('checking');
    setStatus((await checkHealth()) ? 'online' : 'offline');
  }, []);
  useEffect(() => { isCloudSyncEnabled().then((v) => { setSync(v); refresh(v); }); }, [refresh]);
  const toggle = async (v: boolean) => { setSync(v); await setCloudSyncEnabled(v); refresh(v); };
  const label = { checking: 'Connecting…', online: 'Connected', offline: 'No connection', off: 'Off' }[status];
  return (
    <>
      <div className="pf-card pf-set">
        <div className="row"><div><div className="w6">Cloud sync</div><div className="pf-sub">Show the herd your team records with the iPhone app</div></div>
          {sync !== null && <Switch on={sync} onChange={toggle} label="Cloud sync" />}</div>
        <div className="row"><div className="w6">Status</div>
          <div className="pf-status"><span className={`dot ${status}`} /><span className="w6">{label}</span>
            {sync && <button className="pf-link w6" onClick={() => refresh(true)} disabled={status === 'checking'}>Check again</button>}</div></div>
      </div>
      <p className="pf-foot">With sync on, the desktop shows the animals and weights stored in your organization&apos;s account. With it off, this browser does not contact the server.</p>
    </>
  );
}

function BrowserPanel({ embedded }: { embedded?: boolean }) {
  const { user, logout } = useAuth();
  const [ask, setAsk] = useState<'clear' | 'out' | null>(null);
  const [done, setDone] = useState(false);
  const clear = async () => {
    setAsk(null);
    await clearAll();
    await AsyncStorage.removeItem(CLOUD_CACHE_KEY).catch(() => {});
    setDone(true);
  };
  return (
    <>
      <div className="pf-card pf-set">
        {/* Dentro do Perfil, o «Sign out» já está na lista da conta logo abaixo. */}
        {!embedded && <div className="row"><div><div className="w6">Signed in as</div><div className="pf-sub">{user?.email}</div></div>
          <button className="pf-btn l w7" onClick={() => setAsk('out')}>Sign out</button></div>}
        <div className="row"><div><div className="w6">Saved data</div><div className="pf-sub">{done ? 'Cleared. The herd will download again from the cloud.' : 'A copy of the herd is kept here so the pages open instantly'}</div></div>
          <button className="pf-btn r-l w7" onClick={() => setAsk('clear')} disabled={done}>Clear data</button></div>
      </div>
      <p className="pf-foot">On a shared computer, sign out when you finish. Clearing data does not delete anything from your organization&apos;s account.</p>
      {ask === 'clear' && <Confirm title="Clear data from this browser?" body="The saved copy of the herd is removed from this browser. Your organization's data in the cloud is not affected." action="Clear data" onCancel={() => setAsk(null)} onConfirm={clear} />}
      {ask === 'out' && <Confirm title="Sign out?" body="You will need your email and password to sign in again on this browser." action="Sign out" onCancel={() => setAsk(null)} onConfirm={() => { setAsk(null); void logout(); }} />}
    </>
  );
}

function AboutPanel({ goWhatsNew }: { goWhatsNew?: () => void }) {
  const rows = [
    ['Application', 'PondiFarm for desktop'],
    ['Version', APP_VERSION],
    ['Weight model', `${WEIGHT_MODEL_VERSION} · Hereford base`],
    ['AI engine', `Linear regression, ${WEIGHT_MODEL_FEATURE_COUNT} body measurements`],
    ['Scans', 'LiDAR, captured with the iPhone app'],
  ];
  return (
    <>
      <div className="pf-card pf-set">{rows.map(([k, v]) => <div key={k} className="row"><span>{k}</span><span className="val">{v}</span></div>)}
        {goWhatsNew && <div className="row"><span>What&apos;s new</span><button className="pf-link w6" onClick={goWhatsNew}>See what&apos;s new in {APP_VERSION}</button></div>}</div>
      <p className="pf-foot">PondiFarm · Euro Union Consult, Lda. Pilot build: weight estimates are experimental.</p>
    </>
  );
}

/** `embedded`: dentro do Perfil (sem título de página nem «Sign out» repetido). */
export default function SettingsPage({ embedded, goWhatsNew }: { embedded?: boolean; goWhatsNew?: () => void }) {
  const [sec, setSec] = useState<Section>('cloud');
  const i = SECTIONS.findIndex((s) => s.id === sec);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowDown' ? 1 : SECTIONS.length - 1)) % SECTIONS.length;
    setSec(SECTIONS[n].id);
    (e.currentTarget.querySelectorAll('button')[n] as HTMLButtonElement | undefined)?.focus();
  };
  const current = SECTIONS[i];
  const content = (
    <div className={`pf-row pf-split pf-settings${embedded ? ' emb' : ''}`}>
        <nav className="pf-secnav" role="tablist" aria-orientation="vertical" aria-label="Settings sections" onKeyDown={onKey} style={{ ['--i' as any]: i }}>
          <span className="thumb" aria-hidden="true" />
          {SECTIONS.map(({ id, label, hint, Icon }) => (
            <button key={id} role="tab" aria-selected={sec === id} tabIndex={sec === id ? 0 : -1} className={sec === id ? 'on' : ''} onClick={() => setSec(id)}>
              <span className="ic"><Icon /></span><span><b className="w6">{label}</b><small>{hint}</small></span></button>))}
        </nav>
        <section className="pf-secpanel" role="tabpanel" aria-label={current.label} key={sec}>
          <h2 className="w8">{current.label}</h2>
          {sec === 'cloud' && <CloudPanel />}
          {sec === 'browser' && <BrowserPanel embedded={embedded} />}
          {sec === 'about' && <AboutPanel goWhatsNew={goWhatsNew} />}
        </section>
      </div>
  );
  if (embedded) return content;
  return (
    <div className="pf-page">
      <div className="pf-top"><div><h1 className="w8">Settings</h1><div className="pf-sub">Preferences for PondiFarm on this computer</div></div></div>
      {content}
    </div>
  );
}
