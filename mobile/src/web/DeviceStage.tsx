import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RootNavigator } from '../navigation/AppNavigator';
import DesktopShell from './DesktopShell';
import { DesktopIcon, PhoneIcon } from './icons';
import { saveDeviceMode, type DeviceMode } from './deviceMode';
import { setReportPlatform } from '../lib/errorReport';
import { BRAND_ICON } from './brandIcon';

const ICON = BRAND_ICON;
const PHONE_W = 392, PHONE_H = 852, BEZEL = 14;
const cl = (x: number) => Math.min(1, Math.max(0, x));
const io3 = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const o3 = (x: number) => 1 - Math.pow(1 - x, 3), o4 = (x: number) => 1 - Math.pow(1 - x, 4);

function useViewport() {
  const [v, setV] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => { const f = () => setV({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return v;
}
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Confirm({ to, onCancel, onConfirm }: { to: DeviceMode; onCancel: () => void; onConfirm: () => void }) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { ok.current?.focus(); const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onCancel]);
  const mobile = to === 'mobile';
  return (
    <div className="pf pf-scrim" onClick={onCancel}>
      <div className="pf-dlg" role="dialog" aria-modal="true" aria-labelledby="pf-dlg-t" onClick={(e) => e.stopPropagation()}>
        <div className="di">{mobile ? <PhoneIcon /> : <DesktopIcon />}</div>
        <h3 id="pf-dlg-t" className="w8">{mobile ? 'Switch to mobile version?' : 'Switch to desktop version?'}</h3>
        <p>{mobile ? 'PondiFarm will switch to the phone layout, the same one as the iPhone app. You can switch back from the desktop icon at any time.'
                   : 'PondiFarm will switch to the computer layout, with the sidebar and wider views. You can switch back at any time.'}</p>
        <div className="acts"><button className="pf-btn l w7" onClick={onCancel}>Cancel</button>
          <button ref={ok} className="pf-btn g w7" onClick={onConfirm}>{mobile ? 'Switch to mobile' : 'Switch to desktop'}</button></div>
      </div>
    </div>
  );
}

/**
 * Palco com as duas versões. p = 0 é o computador, p = 1 o telemóvel; a transição anima p.
 * Três tempos, sem dupla exposição: (1) a janela encolhe e o desktop sai com desfoque,
 * (2) superfície limpa com a marca enquanto a moldura cresce e a janela inclina e assenta,
 * (3) o mobile revela-se de cima para baixo. Ao voltar, a mesma curva corre ao contrário.
 */
export default function DeviceStage({ initial }: { initial: DeviceMode }) {
  const vp = useViewport();
  const [p, setP] = useState(initial === 'mobile' ? 1 : 0);
  const [ask, setAsk] = useState<DeviceMode | null>(null);
  const raf = useRef(0);
  const animating = p > 0 && p < 1;

  const animateTo = useCallback((target: 0 | 1) => {
    cancelAnimationFrame(raf.current);
    const from = target === 1 ? 0 : 1, dur = reducedMotion() ? 420 : 1650, t0 = performance.now();
    const step = (now: number) => { const u = cl((now - t0) / dur); setP(from + (target - from) * u); if (u < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
    saveDeviceMode(target === 1 ? 'mobile' : 'desktop');
    setReportPlatform(target === 1 ? 'web-mobile' : 'web-desktop');
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Geometria: a janela vai do ecrã inteiro ao tamanho do telemóvel (que encolhe se a janela for baixa).
  const s = Math.min(1, (vp.h - 70) / (PHONE_H + 2 * BEZEL), (vp.w - 40) / (PHONE_W + 2 * BEZEL));
  const W1 = PHONE_W * s, H1 = PHONE_H * s, seg = (a: number, b: number) => cl((p - a) / (b - a));
  const k = io3(seg(0, 0.72));
  const w = vp.w + (W1 - vp.w) * k, h = vp.h + (H1 - vp.h) * k, x = (vp.w - w) / 2, y = (vp.h - h) / 2;
  const r = 50 * s * k, bez = BEZEL * s * o3(seg(0.32, 0.72));
  const tilt = reducedMotion() ? 0 : Math.sin(Math.PI * seg(0.2, 0.8)) * 7;
  const out = o3(seg(0, 0.32)), mark = Math.sin(Math.PI * seg(0.27, 0.51)), reveal = o4(seg(0.52, 0.96));
  const showDesktop = p < 0.34, showMobile = p > 0.5;

  return (
    <div className="pf" style={{ position: 'fixed', inset: 0, perspective: 1600 }}>
      <div className="pf-ground" />
      <div style={{ position: 'absolute', left: x - bez, top: y - bez, width: w + 2 * bez, height: h + 2 * bez,
        transform: tilt ? `rotateY(${tilt}deg) rotateX(${tilt * 0.35}deg)` : undefined }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: r + bez, background: '#0E1620', opacity: bez > 0.2 ? 1 : 0,
          boxShadow: `0 ${46 * k}px ${90 * k}px rgba(27,58,87,${0.3 * k})` }} />
        <div style={{ position: 'absolute', left: bez, top: bez, width: w, height: h, borderRadius: r, overflow: 'hidden', background: p > 0 ? 'var(--ground)' : 'transparent' }}>
          {showDesktop && (
            <div style={{ position: 'absolute', left: 0, top: 0, width: vp.w, height: vp.h, transformOrigin: '0 0',
              transform: p > 0 ? `scale(${w / vp.w}, ${h / vp.h})` : undefined, opacity: 1 - out, filter: out > 0 ? `blur(${out * 10}px)` : undefined,
              pointerEvents: animating ? 'none' : 'auto' }}>
              <DesktopShell onRequestMobile={() => setAsk('mobile')} />
            </div>)}
          {mark > 0.01 && <img src={ICON} alt="" style={{ position: 'absolute', left: w / 2 - 44, top: h / 2 - 44, width: 88, height: 88, borderRadius: 22, opacity: mark, transform: `scale(${0.85 + 0.15 * mark})` }} />}
          {showMobile && (
            <div style={{ position: 'absolute', left: (w - W1) / 2, top: (h - H1) / 2, width: W1, height: H1, overflow: 'hidden',
              WebkitMaskImage: reveal < 1 ? `linear-gradient(to bottom, #000 ${reveal * 112 - 12}%, transparent ${reveal * 112}%)` : undefined,
              maskImage: reveal < 1 ? `linear-gradient(to bottom, #000 ${reveal * 112 - 12}%, transparent ${reveal * 112}%)` : undefined,
              pointerEvents: animating ? 'none' : 'auto' }}>
              <div style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${s}) translateY(${(1 - reveal) * 20}px)`, transformOrigin: '0 0', position: 'relative', display: 'flex' }}>
                <RootNavigator />
              </div>
            </div>)}
        </div>
      </div>
      {p === 1 && (
        <>
          <button className="pf-back w6" onClick={() => setAsk('desktop')} aria-label="Switch to desktop version">Switch to desktop<span className="pf-dev"><DesktopIcon /></span></button>
          <div className="pf-caption">Mobile version · same account, same data</div>
        </>)}
      {ask && <Confirm to={ask} onCancel={() => setAsk(null)} onConfirm={() => { const to = ask; setAsk(null); animateTo(to === 'mobile' ? 1 : 0); }} />}
    </div>
  );
}
