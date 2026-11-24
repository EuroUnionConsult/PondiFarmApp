import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { trackCloud } from '../lib/activity';
import { initials, loadProfile, saveProfile, type Profile } from '../lib/profile';
import {
  approveRequest, cancelMyRequest, describeEvent, leaveOrganization, listEvents, listPendingRequests, listPeople, rejectRequest, type OrgEvent,
  removePerson, transferLeadership, type OrgPerson, type PendingJoinRequest,
} from '../lib/orgs';
import { SkelRows, useCountUp } from './charts';
import SettingsPage, { Confirm } from './SettingsPage';
import FarmLocationDialog from './FarmLocationDialog';
import { useWeather } from '../lib/weather';
import { switchThemeWithScan } from './themeScan';
import { Chevron, DotsIcon, GearIcon, InfoIcon, MoonIcon, PenIcon, SunIcon } from './icons';
import { APP_VERSION } from '../lib/version';
import { useWhatsNewUnseen } from '../lib/whatsNew';
import { BulkActionBar, canBulkSelectPerson, useMembersBulk } from '../components/MembersBulk';
import PondiLoader from '../components/PondiLoader';

// Perfil da versão de computador: as mesmas ações do ecrã da app (nome, organização,
// pedidos, membros, sair), com menus e confirmações em vez dos alertas do telemóvel.
/** Avisa o menu lateral de que o nome mudou. */
export const PROFILE_SAVED = 'pf-profile-saved';
type Ask = { title: string; body: string; action: string; tone?: 'danger' | 'go'; run: () => void };
const ini = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
const since = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };

function ThemeSwitch() {
  const { mode, setMode } = useTheme();
  const dark = mode === 'dark';
  return (
    <button className={`pf-theme${dark ? ' dark' : ''}`} role="switch" aria-checked={dark} aria-label="Dark theme"
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); switchThemeWithScan(dark ? 'light' : 'dark', setMode, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }}>
      <span className="ic sun"><SunIcon /></span><span className="ic moon"><MoonIcon /></span><span className="knob" />
      <span className="lbl w6">{dark ? 'Dark' : 'Light'}</span>
    </button>
  );
}

function PersonMenu({ p, onLeader, onRemove }: { p: OrgPerson; onLeader: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="pf-menuwrap" ref={ref}>
      <button className="pf-iconbtn" aria-label={`Manage ${p.name}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}><DotsIcon /></button>
      {open && (
        <div className="pf-menu" role="menu">
          <button role="menuitem" className="w6" onClick={() => { setOpen(false); onLeader(); }}>Make leader</button>
          <button role="menuitem" className="w6 dang" onClick={() => { setOpen(false); onRemove(); }}>Remove from organization</button>
        </div>)}
    </div>
  );
}

/** Caixa de seleção da versão de computador: um <button role="checkbox"> real (Tab, Espaço, Enter). */
function CheckBox({ checked, onToggle, label, disabled }: { checked: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled}
      className={`pf-check${checked ? ' on' : ''}`} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>);
}

// «23 Oct 2026, 14:05» (o servidor guarda em UTC; mostra-se na hora local).
const evWhen = (iso: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  .toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** `goWhatsNew`: abre a página «What's new» (a linha fica na conta, junto das Settings). */
export default function ProfilePage({ goWhatsNew }: { goWhatsNew?: () => void }) {
  const whatsNewUnseen = useWhatsNewUnseen();
  const { user, logout, refreshMe } = useAuth();
  const orgId = user?.organizationId ?? null;
  const isLeader = user?.role === 'leader';
  const isPending = user?.membershipStatus === 'pending';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(''), [last, setLast] = useState('');
  const [people, setPeople] = useState<OrgPerson[] | null>(null);
  const [requests, setRequests] = useState<PendingJoinRequest[]>([]);
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [allEvents, setAllEvents] = useState(false);
  const { weather } = useWeather();
  const farm = weather?.location ?? null;
  const [locOpen, setLocOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [saved, setSaved] = useState(false);
  // As Definições vivem aqui, dentro da conta: a linha abre e fecha com a seta a rodar.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (settingsOpen) setTimeout(() => settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 260); }, [settingsOpen]);

  useEffect(() => { void loadProfile(user?.id).then(setProfile); }, [user?.id]);
  const load = useCallback(async () => {
    if (!orgId) { setPeople([]); return; }
    setError(null);
    try {
      const [p, r, ev] = await trackCloud(Promise.all([
        listPeople(orgId),
        isLeader ? listPendingRequests(orgId) : Promise.resolve([] as PendingJoinRequest[]),
        // Histórico só para o Líder; um backend sem a rota não parte o Perfil.
        isLeader ? listEvents(orgId).catch(() => [] as OrgEvent[]) : Promise.resolve([] as OrgEvent[]),
      ]));
      setPeople(p); setRequests(r); setEvents(ev);
    } catch (e: any) { setError(String(e?.message ?? e)); setPeople((x) => x ?? []); }
  }, [orgId, isLeader]);
  useEffect(() => { void load(); }, [load]);

  // Seleção em massa (só o Líder): «Select» no cabeçalho de cada secção.
  const bulk = useMembersBulk({ orgId, requests, people, myId: user?.id, reload: load });
  const selecting = isLeader && bulk.selecting;
  const selectLink = (kind: 'request' | 'member') => {
    const has = kind === 'request' ? bulk.hasRequests : bulk.hasMembers;
    if (!isLeader || !has) return null;
    const all = kind === 'request' ? bulk.allRequests : bulk.allMembers;
    const label = !selecting ? 'Select' : all ? 'Deselect all' : 'Select all';
    const what = kind === 'request' ? 'requests' : 'members';
    return (
      <button className="pf-link w6" disabled={bulk.running !== null}
        aria-label={label === 'Select' ? `Select ${what}` : `${label} ${what}`}
        onClick={() => (!selecting ? bulk.start() : kind === 'request' ? bulk.toggleAllRequests() : bulk.toggleAllMembers())}>{label}</button>);
  };

  // A linha sai com animação antes de a lista ser recarregada.
  const act = async (id: string, fn: () => Promise<unknown>, roleMayChange = false, animateOut = false) => {
    setBusy(id); setError(null);
    try {
      await trackCloud(fn());
      if (animateOut) { setLeaving(id); await new Promise((r) => setTimeout(r, 320)); }
      if (roleMayChange) await refreshMe();
      await load();
    } catch (e: any) { setError(String(e?.message ?? e)); }
    finally { setBusy(null); setLeaving(null); }
  };

  const displayName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : (user?.name ?? '');
  const avatar = initials(profile, user?.name);
  const members = useCountUp(people ? people.length : null);
  const startEdit = () => { const parts = displayName.split(/\s+/); setFirst(parts[0] ?? ''); setLast(parts.slice(1).join(' ')); setEditing(true); };
  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = { firstName: first.trim(), lastName: last.trim() };
    if (!p.firstName) return;
    await saveProfile(user?.id, p); setProfile(p); window.dispatchEvent(new Event(PROFILE_SAVED)); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 1800);
  };
  const orgName = (isPending ? user?.pendingOrganizationName : user?.organizationName) || '—';

  return (
    <div className="pf-page">
      <div className="pf-top">
        <div><h1 className="w8">Profile</h1><div className="pf-sub">Your account and your organization</div></div>
        <ThemeSwitch />
      </div>

      <div className="pf-row">
        <div className="pf-card pf-me-card pf-rise">
          <div className="pf-avatar-xl"><span className="ring" aria-hidden="true" /><span className="in w8">{avatar || '?'}</span></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {!editing ? (<>
              <div className="nm w8">{displayName || 'Your name'}{saved && <span className="pf-saved w7">Saved</span>}</div>
              <div className="pf-sub">{user?.email}</div>
              <button className="pf-btn l w7" style={{ marginTop: 14 }} onClick={startEdit}><PenIcon />Edit name</button>
            </>) : (
              <form className="pf-edit" onSubmit={saveName}>
                <div className="flds">
                  <label><span className="w6">First name</span><input autoFocus value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" /></label>
                  <label><span className="w6">Last name</span><input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" /></label>
                </div>
                <div className="acts"><button type="button" className="pf-btn l w7" onClick={() => setEditing(false)}>Cancel</button>
                  <button type="submit" className="pf-btn g w7" disabled={!first.trim()}>Save name</button></div>
              </form>)}
          </div>
        </div>

        <div className="pf-card pf-org-card pf-rise" style={{ animationDelay: '60ms' }}>
          <div className="pf-k w7">Organization</div>
          <div className="org w8">{orgName}</div>
          <div className="meta">
            <span className={`pf-role w7${isPending ? ' pending' : ''}`}>{isPending ? 'Waiting for approval' : isLeader ? 'Leader' : user?.role ? 'Member' : 'Not available yet'}</span>
            {orgId && <span className="pf-sub" style={{ margin: 0 }}><b className="w8" style={{ color: 'var(--label)' }}>{members ?? '—'}</b> {people?.length === 1 ? 'member' : 'members'}</span>}
          </div>
          {orgId && !isPending && (
            <div className="pf-farmloc">
              <span className="ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg></span>
              <span><small>Farm location</small><b className="w6">{farm?.label ?? (farm ? `${farm.lat.toFixed(2)}, ${farm.lon.toFixed(2)}` : 'Not set')}</b></span>
              {isLeader && <button className="pf-link w6" onClick={() => setLocOpen(true)}>{farm ? 'Change' : 'Set'}</button>}
            </div>)}
          {isPending && (<>
            <p className="pf-sub">Until the leader approves you, you don&apos;t see the organization&apos;s herd. Your scans are sent automatically once you&apos;re approved.</p>
            <button className="pf-btn r-l w7" onClick={() => setAsk({ title: 'Cancel your request?', body: 'You can ask to join again later.', action: 'Cancel request', run: () => act('cancel', cancelMyRequest, true) })}>Cancel request</button>
          </>)}
        </div>
      </div>

      {isLeader && (<>
        <div className="pf-secthead"><div className="pf-sect w6">Requests to join · {requests.length}</div>{selectLink('request')}</div>
        <div className="pf-card pf-people">
          {requests.length === 0 && <div className="pf-empty" style={{ padding: '22px 24px' }}>No pending requests. When someone asks to join {orgName}, you approve them here.</div>}
          {requests.map((r, i) => (
            <div key={r.id} className={`pr pf-rise${leaving === r.id ? ' out' : ''}${selecting ? ' pick' : ''}${bulk.isRequestSelected(r.id) && selecting ? ' sel' : ''}${bulk.running && bulk.isRequestSelected(r.id) ? ' busy' : ''}`} style={{ animationDelay: `${i * 40}ms` }}
              onClick={selecting && !bulk.running ? (e) => { if (!(e.target as HTMLElement).closest('[role="checkbox"]')) bulk.toggleRequest(r.id); } : undefined}>
              {selecting && <CheckBox checked={bulk.isRequestSelected(r.id)} onToggle={() => bulk.toggleRequest(r.id)} disabled={bulk.running !== null} label={`Select ${r.userName}`} />}
              <div className="av w7">{ini(r.userName)}</div>
              <div className="who"><b className="w6">{r.userName}</b><small>{r.userEmail}{since(r.createdAt) && ` · asked ${since(r.createdAt)}`}</small></div>
              {!selecting && <div className="acts">
                <button className="pf-btn r-l w7" disabled={busy !== null} onClick={() => orgId && act(r.id, () => rejectRequest(orgId, r.id), false, true)}>Reject</button>
                <button className="pf-btn g w7" disabled={busy !== null} onClick={() => orgId && act(r.id, () => approveRequest(orgId, r.id), false, true)}>{busy === r.id ? 'Approving…' : 'Approve'}</button>
              </div>}
            </div>))}
        </div>
      </>)}

      {orgId && (<>
        <div className="pf-secthead"><div className="pf-sect w6">Members · {people?.length ?? '…'}</div>{selectLink('member')}</div>
        <div className="pf-card pf-people">
          {people === null && <SkelRows n={3} />}
          {(people ?? []).map((p, i) => {
            const me = p.userId === user?.id;
            const canPick = isLeader && canBulkSelectPerson(p, user?.id);
            const picked = bulk.isMemberSelected(p.userId);
            return (
              <div key={p.userId} className={`pr pf-rise${leaving === p.userId ? ' out' : ''}${selecting && canPick ? ' pick' : ''}${selecting && picked ? ' sel' : ''}${bulk.running === 'remove' && picked ? ' busy' : ''}`} style={{ animationDelay: `${i * 40}ms` }}
                onClick={selecting && canPick && !bulk.running ? (e) => { if (!(e.target as HTMLElement).closest('[role="checkbox"]')) bulk.toggleMember(p.userId); } : undefined}>
                {selecting && (canPick
                  ? <CheckBox checked={picked} onToggle={() => bulk.toggleMember(p.userId)} disabled={bulk.running !== null} label={`Select ${p.name}`} />
                  : <span className="pf-boxgap" aria-hidden="true" />)}
                <div className={`av w7${p.role === 'leader' ? ' lead' : ''}`}>{ini(p.name)}</div>
                <div className="who"><b className="w6">{p.name}{me && <span className="you w6">you</span>}</b><small>{p.email}{since(p.since) && ` · since ${since(p.since)}`}</small></div>
                <span className={`pf-role w7${p.role === 'leader' ? '' : ' mem'}`}>{p.role === 'leader' ? 'Leader' : 'Member'}</span>
                {selecting ? null : isLeader && !me ? (busy === p.userId ? <PondiLoader size={22} label="Working" style={{ marginHorizontal: 8 }} /> :
                  <PersonMenu p={p}
                    onLeader={() => setAsk({ title: `Make ${p.name} the leader?`, body: 'You become a member and can no longer approve requests or manage people.', action: 'Make leader', tone: 'go', run: () => orgId && act(p.userId, () => transferLeadership(orgId, p.userId), true) })}
                    onRemove={() => setAsk({ title: `Remove ${p.name}?`, body: "They lose access to the organization's data right away.", action: 'Remove', run: () => orgId && act(p.userId, () => removePerson(orgId, p.userId), false, true) })} />)
                  : <span className="pf-iconbtn ghost" aria-hidden="true" />}
              </div>);
          })}
        </div>
        {isLeader && <p className="pf-foot">{selecting ? 'Tick requests or members, then choose an action below.' : 'Use the menu next to a member to make them leader or remove them, or «Select» to act on several at once.'}</p>}
      </>)}

      {/* Histórico (só o Líder): entradas, saídas, remoções e mudanças de líder. */}
      {orgId && isLeader && events.length > 0 && (<>
        <div className="pf-sect w6">Activity</div>
        <div className="pf-card pf-events">
          {(allEvents ? events : events.slice(0, 6)).map((e, i) => (
            <div key={e.id} className="ev pf-rise" style={{ animationDelay: `${i * 30}ms` }}>
              <span className={`dot ${e.type}`} aria-hidden="true" />
              <span className="tx">{describeEvent(e)}</span>
              <time className="when" dateTime={e.createdAt}>{evWhen(e.createdAt)}</time>
            </div>))}
          {!allEvents && events.length > 6 && <button className="more w6" onClick={() => setAllEvents(true)}>Show all activity</button>}
        </div>
      </>)}

      {error && <div className="pf-err" role="alert" style={{ margin: '14px 6px 0' }}>{error}</div>}
      {locOpen && <FarmLocationDialog onClose={() => setLocOpen(false)} />}

      <div className="pf-sect w6">Account</div>
      <div className="pf-card pf-acct">
        {goWhatsNew && (
          <button className="row" onClick={goWhatsNew} aria-label={`What's new in version ${APP_VERSION}${whatsNewUnseen ? ', not opened yet' : ''}`}>
            <span className="ic"><InfoIcon /></span><span><span className="w6">What&apos;s new · {APP_VERSION}</span><small className="hint">New features, by area</small></span>
            {whatsNewUnseen && <span className="pf-newdot" aria-hidden="true" />}
            <span className="chev"><Chevron /></span></button>)}
        <button className="row" aria-expanded={settingsOpen} aria-controls="pf-prof-settings" onClick={() => setSettingsOpen((v) => !v)}>
          <span className="ic"><GearIcon /></span><span><span className="w6">Settings</span><small className="hint">Cloud sync, this browser, about</small></span>
          <span className={`chev${settingsOpen ? ' open' : ''}`}><Chevron /></span></button>
        <div id="pf-prof-settings" ref={settingsRef} className={`pf-collapse${settingsOpen ? ' open' : ''}`} role="region" aria-label="Settings">
          <div className="inner">{settingsOpen && <div className="pad"><SettingsPage embedded goWhatsNew={goWhatsNew} /></div>}</div>
        </div>
        {orgId && !isLeader && user?.role === 'member' && (
          <button className="row dang w6" onClick={() => setAsk({ title: 'Leave organization?', body: `You stop seeing ${user?.organizationName}'s data.`, action: 'Leave', run: () => orgId && act('leave', () => leaveOrganization(orgId), true) })}>Leave organization</button>)}
        <button className="row dang w6" onClick={() => setAsk({ title: 'Sign out?', body: user ? `Sign out of ${user.email} on this browser?` : 'Sign out?', action: 'Sign out', run: () => { void logout(); } })}>Sign out</button>
      </div>

      {/* Barra fixa das ações em massa (o mesmo componente do iPhone). */}
      {isLeader && bulk.selecting && (
        <div className="pf-bulkdock"><BulkActionBar bulk={bulk} orgName={user?.organizationName ?? undefined} /></div>)}

      {ask && <Confirm title={ask.title} body={ask.body} action={ask.action} tone={ask.tone} onCancel={() => setAsk(null)} onConfirm={() => { const a = ask; setAsk(null); a.run(); }} />}
    </div>
  );
}
