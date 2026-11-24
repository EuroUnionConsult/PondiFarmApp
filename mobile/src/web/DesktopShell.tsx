import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { listPeople } from '../lib/orgs';
import { initials, loadProfile, type Profile } from '../lib/profile';
import AnalyticsPage from './AnalyticsPage';
import ProfilePage, { PROFILE_SAVED } from './ProfilePage';
import HomePage from './HomePage';
import HerdPage from './HerdPage';
import WeatherPage from './WeatherPage';
import WhatsNewPage from './WhatsNewPage';
import WeatherIcon from '../components/WeatherIcon';
import { useWeather } from '../lib/weather';
import { useHerd } from './herd';
import { setCurrentScreen } from '../lib/errorReport';
import { ChartIcon, DesktopIcon, HerdIcon, HomeIcon } from './icons';
import { BRAND_ICON } from './brandIcon';
import { entryIntro, entryIntroContentDelay } from '../lib/entryIntro';

const ICON = BRAND_ICON;
export type Page = 'home' | 'herd' | 'analytics' | 'weather' | 'profile' | 'whatsnew';

export default function DesktopShell({ onRequestMobile, shellRef }: { onRequestMobile: () => void; shellRef?: React.Ref<HTMLDivElement> }) {
  const { user } = useAuth();
  const [page, setPage] = useState<Page>('home');
  // Animação de abertura (EntryAnimation, uma vez por separador): a Home espera pelo fim dela.
  // Valor fixo desde a montagem (o animation-delay conta a partir daí); trocar de página anula-o.
  const [introLeft, setIntroLeft] = useState(() => { entryIntro(); return entryIntroContentDelay(); });
  useEffect(() => { if (page !== 'home') setIntroLeft(0); }, [page]);
  // Os relatórios de erro dizem em que página do painel aconteceram (ex.: 'desktop:weather').
  useEffect(() => { setCurrentScreen(`desktop:${page}`); }, [page]);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const herd = useHerd();
  const { weather, unread } = useWeather();
  const wxNow = weather?.location ? weather.current : undefined;
  const openAnimal = (id?: string) => { if (id) setSelected(id); setPage('herd'); };
  useEffect(() => {
    if (user?.membershipStatus === 'active' && user.organizationId) listPeople(user.organizationId).then((p) => setMembers(p.length)).catch(() => {});
  }, [user?.organizationId, user?.membershipStatus]);
  const nav = (p: Page, label: string, Icon: React.FC) => (
    <button className={page === p ? 'on w6' : 'w6'} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)} title={label}><Icon /><span className="lbl">{label}</span></button>);
  // O nome editado no Perfil fica no browser (como na app); o rodapé mostra-o também.
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    const read = () => { void loadProfile(user?.id).then(setProfile); };
    read(); window.addEventListener(PROFILE_SAVED, read);
    return () => window.removeEventListener(PROFILE_SAVED, read);
  }, [user?.id]);
  const shownName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : user?.name;
  const ini = initials(profile, user?.name) || '?';
  const pending = user?.membershipStatus === 'pending';
  return (
    <div className="pf pf-app" ref={shellRef}>
      <div className="pf-ground" />
      <aside className="pf-side">
        <div className="pf-brand"><img src={ICON} alt="" /><div className="pf-word w8">Pondi<span>Farm</span></div></div>
        <nav className="pf-nav" aria-label="Main">{nav('home', 'Home', HomeIcon)}{nav('herd', 'Herd', HerdIcon)}{nav('analytics', 'Analytics', ChartIcon)}
          {/* Tempo da quinta: o ícone animado do tempo agora e o ponto laranja quando há aviso por ler. */}
          {weather && (
            <button className={`pf-wxnav ${page === 'weather' ? 'on w6' : 'w6'}`} aria-current={page === 'weather' ? 'page' : undefined} onClick={() => setPage('weather')} title="Weather">
              <span className="wxi">{wxNow ? <WeatherIcon kind={wxNow.kind} size={26} dot={unread} /> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2" /><path d="M17 20H8.5a4 4 0 1 1 .7-7.9 5 5 0 0 1 9.3 2.6A2.7 2.7 0 0 1 17 20z" /></svg>}</span>
              <span className="lbl">Weather</span>{wxNow && <small className="lbl">{Math.round(wxNow.temp)}°</small>}
            </button>)}
        </nav>
        <div className="pf-org">Organization<b className="w7">{pending ? user?.pendingOrganizationName : user?.organizationName || '—'}</b>
          <span className={`pf-role w7${pending ? ' pending' : ''}`}>{pending ? 'Waiting for approval' : user?.role === 'leader' ? 'Leader' : 'Member'}</span></div>
        <div className="pf-me">
          <button className="who" onClick={() => setPage('profile')} aria-label="Open your profile">
            <div className="pf-av w7">{ini}</div><div className="nmb" style={{ minWidth: 0 }}><div className="n w7">{shownName || 'Your profile'}</div><div className="e">{user?.email}</div></div></button>
          <button className="pf-dev" onClick={onRequestMobile} aria-label="Desktop version. Switch to mobile version"><DesktopIcon /><span className="tip w6">Desktop version</span></button>
        </div>
      </aside>
      <main className="pf-main">
        {/* key={page}: cada troca de página reinicia a animação de entrada (pf-pagein). */}
        <div className={introLeft ? 'pf-pagein pf-afterintro' : 'pf-pagein'} key={page}
          style={introLeft ? ({ '--intro-d': `${introLeft}ms` } as React.CSSProperties) : undefined}>
          {page === 'home' && <HomePage herd={herd} members={members} openAnimal={openAnimal} goHerd={() => setPage('herd')} goAnalytics={() => setPage('analytics')} goProfile={() => setPage('profile')} goWeather={() => setPage('weather')} />}
          {page === 'herd' && <HerdPage herd={herd} selected={selected} setSelected={setSelected} />}
          {page === 'analytics' && <AnalyticsPage herd={herd} openAnimal={openAnimal} />}
          {page === 'weather' && <WeatherPage />}
          {page === 'profile' && <ProfilePage goWhatsNew={() => setPage('whatsnew')} />}
          {page === 'whatsnew' && <WhatsNewPage onBack={() => setPage('profile')} />}
        </div>
      </main>
    </div>
  );
}
