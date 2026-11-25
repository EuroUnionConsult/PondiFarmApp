import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { LAST_ACTIVITY_KEY, SESSION_TIMEOUTS, idleFor, markActivity } from '../lib/session';

// Saída por inatividade no site (só web; o iPhone não sai sozinho — uso no campo).
// 30 min sem interação em NENHUM separador → aviso com contagem de 60 s → sai, limpa
// o token e os dados da organização guardados, e mostra o login com «Signed out after
// 30 minutes of inactivity» (AuthContext). A última atividade é partilhada por todos os
// separadores (localStorage), por isso mexer num mantém os outros vivos; «Stay signed
// in» num separador fecha o aviso em todos; o logout num vai a todos (BroadcastChannel).

const EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll', 'focus'];

export default function IdleSessionGuard() {
  const { token, loading, logout } = useAuth();
  // ms até sair, enquanto o aviso está aberto; null = sem aviso.
  const [left, setLeft] = useState<number | null>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const active = !!token && !loading;

  useEffect(() => {
    if (!active) { setLeft(null); return; }
    const { idleMs, warnMs } = SESSION_TIMEOUTS;
    // Interação normal conta como atividade, mas não depois dos 30 min: aí só os botões do
    // aviso decidem (voltar ao separador ao fim de 2 h não pode reavivar a sessão).
    const onActivity = () => { if (idleFor() < idleMs) markActivity(); };
    const onVisible = () => { if (document.visibilityState === 'visible') { onActivity(); tick(); } };
    let out = false;
    const tick = () => {
      const idle = idleFor();
      if (idle >= idleMs + warnMs) {
        if (!out) { out = true; setLeft(null); void logout('idle'); }
      } else if (idle >= idleMs) {
        setLeft(idleMs + warnMs - idle);
      } else {
        setLeft(null);
      }
    };
    // Atividade ou «Stay signed in» noutro separador: reavalia já (sem esperar pelo intervalo,
    // que o browser abranda nos separadores em segundo plano).
    const onStorage = (e: StorageEvent) => { if (e.key === LAST_ACTIVITY_KEY) tick(); };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    const id = setInterval(tick, 1000);
    tick();
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true } as EventListenerOptions));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
      clearInterval(id);
    };
  }, [active, logout]);

  const open = left !== null;
  useEffect(() => { if (open) stayRef.current?.focus(); }, [open]);
  if (!open) return null;

  const secs = Math.max(0, Math.ceil((left ?? 0) / 1000));
  const stay = () => { markActivity(true); setLeft(null); };
  return (
    <div className="pf pf-scrim pf-idle">
      <div className="pf-dlg" role="alertdialog" aria-modal="true" aria-labelledby="pf-idle-t" aria-describedby="pf-idle-d">
        <div className="di" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        </div>
        <h3 id="pf-idle-t" className="w8">You’ll be signed out in <span className="pf-idle-n" aria-hidden="true">{secs}</span> s for security</h3>
        <p id="pf-idle-d">There has been no activity on PondiFarm for a while. Stay signed in to keep working.</p>
        {/* Para leitores de ecrã, só de 10 em 10 s (não a cada segundo). */}
        <span className="pf-sr" aria-live="polite">{secs % 10 === 0 ? `${secs} seconds left` : ''}</span>
        <div className="acts">
          <button className="pf-btn l w7" onClick={() => { void logout('user'); }}>Sign out now</button>
          <button ref={stayRef} className="pf-btn g w7" onClick={stay}>Stay signed in</button>
        </div>
      </div>
    </div>
  );
}
