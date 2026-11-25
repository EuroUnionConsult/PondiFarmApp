import React, { useEffect, useState } from 'react';
import FarmMap from '../components/FarmMap';
import { useAuth } from '../lib/AuthContext';
import { POSTCODE_CREDIT, saveFarmLocation, searchMessage, usePinLabel, usePlaceSearch, useWeather } from '../lib/weather';
import PondiLoader from '../components/PondiLoader';

/**
 * Marcar a quinta no computador (só o Líder): a localização deste browser, pesquisa
 * por nome ou código postal, e o pino no mapa para afinar. Guarda-se a ~1 km.
 */
const PORTUGAL = { lat: 39.5, lon: -8.0 };

export default function FarmLocationDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { weather, applyLocation } = useWeather();
  const start = weather?.location ?? null;
  const [pin, setPin] = useState(start ? { lat: start.lat, lon: start.lon } : PORTUGAL);
  const place = usePinLabel(start?.label ?? null);
  const label = place.label;
  const [touched, setTouched] = useState(false);
  // Mesma pesquisa do iPhone (lib/weather): pedidos antigos cancelados, vazio ≠ erro.
  const search = usePlaceSearch();
  const { q, results } = search;
  const searchMsg = searchMessage(search);
  const [busy, setBusy] = useState<'gps' | 'save' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const move = (lat: number, lon: number, known?: string | null) => {
    setPin({ lat, lon }); setTouched(true); setErr(null);
    if (known) place.setKnown(known);
    else place.lookup(lat, lon);
  };
  const mine = () => {
    if (!navigator.geolocation) { setErr('This browser cannot share its location. Search or move the pin instead.'); return; }
    setBusy('gps'); setErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(null); move(p.coords.latitude, p.coords.longitude); },
      () => { setBusy(null); setErr('Location permission was not given. Search or move the pin instead.'); },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };
  const save = async () => {
    if (!user?.organizationId) return;
    setBusy('save'); setErr(null);
    try {
      const saved = await saveFarmLocation(user.organizationId, { lat: pin.lat, lon: pin.lon, label });
      // Fecha já; a página mostra o sítio novo e «Updating forecast…» até a previsão chegar.
      applyLocation(saved);
      onClose();
    } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setBusy(null); }
  };

  return (
    <div className="pf pf-scrim" onClick={onClose}>
      <div className="pf-dlg pf-locdlg" role="dialog" aria-modal="true" aria-labelledby="pf-loc-t" onClick={(e) => e.stopPropagation()}>
        <h3 id="pf-loc-t" className="w8">Farm location</h3>
        <p>Mark the farm once. Everyone in the organization sees its forecast and welfare alerts.</p>
        <div className="pf-locbar">
          <button className="pf-btn g w7" onClick={mine} disabled={busy === 'gps'}>{busy === 'gps' ? 'Locating…' : 'Use my location'}</button>
          <div className="pf-locsearch">
            <input value={q} onChange={(e) => search.setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search.submit(); } }}
              placeholder="Search a place or postcode, e.g. 6000-458" aria-label="Search a place or postcode" aria-busy={search.status === 'searching'} enterKeyHint="search" />
            {search.status === 'searching' && <PondiLoader size={18} label="Searching" style={{ position: 'absolute', right: 12, top: '50%', marginTop: -9 }} />}
            {results.length > 0 && (
              <div className="pf-locres" role="listbox">
                {results.map((r, i) => <button key={`${r.lat},${r.lon},${i}`} role="option" aria-selected={false} onClick={() => { move(r.lat, r.lon, r.label); search.clear(); }}>{r.label}</button>)}
              </div>)}
            {searchMsg && results.length === 0 && (
              <div className={`pf-locres pf-locmsg${search.status === 'error' ? ' err' : ''}`} role={search.status === 'error' ? 'alert' : 'status'}>{searchMsg}</div>)}
          </div>
        </div>
        <FarmMap lat={pin.lat} lon={pin.lon} onChange={(a, b) => move(a, b)} height={340} />
        <div className="pf-locpick"><b className="w7">{label ?? (place.failed ? 'Place name unavailable — you can still save' : touched || start ? 'Finding the place name…' : 'No location yet')}</b>
          <span>{pin.lat.toFixed(2)}, {pin.lon.toFixed(2)} · drag the pin or click the map to adjust · saved rounded to about 1 km</span></div>
        {err && <div className="pf-err" role="alert">{err}</div>}
        <div className="pf-loccredit">{POSTCODE_CREDIT}</div>
        <div className="acts">
          <button className="pf-btn l w7" onClick={onClose}>Cancel</button>
          <button className="pf-btn g w7" onClick={save} disabled={busy === 'save' || !(touched || start)}>{busy === 'save' ? <><PondiLoader size="sm" tone="onColor" label="Saving" />Saving…</> : 'Save farm location'}</button>
        </div>
      </div>
    </div>
  );
}
