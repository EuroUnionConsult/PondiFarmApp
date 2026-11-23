// Tempo e bem-estar da quinta. O servidor faz as contas (THI, avisos, ícone):
// a app e a versão web mostram exatamente o mesmo. Aqui: pedir, guardar a última
// previsão (sem rede mostra-a), atualizar a cada 30 min e ao voltar ao 1.º plano,
// e saber se há avisos importantes por ler (o ponto laranja).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackendUrl } from './api';
import { authHeaders } from './auth';
import { useAuth } from './AuthContext';
import { errorMessage, reportError } from './errorReport';
import { trackServerRequest } from './serverWake';

export type WeatherKind = 'sun' | 'hot' | 'cloudy' | 'rain' | 'storm' | 'wind' | 'night';
export type ThiBand = 'normal' | 'alert' | 'danger' | 'emergency';

export interface WeatherAlert {
  id: string;
  kind: 'heat' | 'rain' | 'cold' | 'wind';
  severity: 'warning' | 'danger';
  title: string;
  text: string;
  start: string;
  end: string;
}

export interface FarmLocation { lat: number; lon: number; label: string | null }

export interface Weather {
  location: FarmLocation | null;
  canSetLocation: boolean;
  timezone?: string;
  updatedAt?: string;
  /** O servidor não conseguiu atualizar e devolveu a última previsão boa (ver updatedAt). */
  stale?: boolean;
  replay?: string | null;
  current?: {
    time: string; temp: number; feelsLike: number; rh: number; wind: number; gust: number; code: number;
    isDay: boolean; thi: number; thiBand: ThiBand; kind: WeatherKind; uv: number | null; aqi: number | null;
  };
  hours?: { time: string[]; temp: number[]; rh: number[]; rain: number[]; pop: (number | null)[]; wind: number[]; gust: number[]; code: number[]; isDay: number[]; thi: number[] };
  days?: { date: string; max: number; min: number; pop: number | null; code: number; kind: WeatherKind }[];
  thiPeak?: number | null;
  alerts?: WeatherAlert[];
  season?: { from: string; to: string; alertDays: number; dangerDays: number } | null;
}

export interface Place { label: string; lat: number; lon: number }

export const REFRESH_MS = 30 * 60 * 1000;

/** Erro de um pedido, já com texto para mostrar (nunca «HTTP 503» cru). */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly endpoint: string, readonly detail?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function friendly(status: number, detail: string | undefined): string {
  if (status === 0) return 'No connection to the server. Check the internet and try again.';
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 403) return 'Only the leader can set the farm location.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return detail && status === 503 ? detail : 'The server had a problem. Try again shortly.';
  return detail || 'Something went wrong. Try again.';
}

async function req<T>(method: string, path: string, body?: unknown, opts?: { signal?: AbortSignal; screen?: string }): Promise<T> {
  const endpoint = path.split('?')[0];
  let res: Response;
  try {
    const base = (await getBackendUrl()).trim().replace(/\/+$/, '');
    // Também conta para «Connecting to the server…» (o 1.º pedido do dia pode ser este).
    res = await trackServerRequest(fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: opts?.signal,
    }));
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;   // pedido substituído por um mais recente: não é erro
    reportError({ kind: 'network', message: errorMessage(e), endpoint, screen: opts?.screen });
    throw new ApiError(friendly(0, undefined), 0, endpoint);
  }
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const j = await res.json();
      if (typeof j?.detail === 'string') detail = j.detail;
    } catch {}
    if (res.status >= 500 || res.status === 429) {
      reportError({ kind: 'api', message: detail || `HTTP ${res.status}`, httpStatus: res.status, endpoint, screen: opts?.screen });
    }
    throw new ApiError(friendly(res.status, detail), res.status, endpoint, detail);
  }
  return res.json() as Promise<T>;
}

// Demonstração (só funciona num backend com WEATHER_REPLAY=1): repete um dia real do ERA5.
let replayDay: string | null = (() => {
  const env = process.env.EXPO_PUBLIC_WEATHER_REPLAY;   // só em desenvolvimento
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) return env;
  if (typeof window !== 'undefined' && (window as any).location?.search) {
    const q = new URLSearchParams((window as any).location.search).get('replay');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  }
  return null;
})();
export function setWeatherReplay(day: string | null) { replayDay = day; }

export const fetchWeather = (orgId: string) =>
  req<Weather>('GET', `/api/v1/organizations/${orgId}/weather${replayDay ? `?replay=${replayDay}` : ''}`);
export const saveFarmLocation = (orgId: string, loc: { lat: number; lon: number; label?: string | null }) =>
  req<FarmLocation>('PUT', `/api/v1/organizations/${orgId}/farm-location`, loc);
/** `submit`: a pessoa carregou em Enter/Pesquisar (o servidor pode então usar o
 * Nominatim para nomes pequenos; em autocompletar não pode). */
export const searchPlaces = (q: string, opts?: { submit?: boolean; signal?: AbortSignal }) =>
  req<Place[]>('GET', `/api/v1/places/search?q=${encodeURIComponent(q.trim())}${opts?.submit ? '&submit=true' : ''}`, undefined,
    { signal: opts?.signal, screen: 'FarmLocation' });
export const reversePlace = (lat: number, lon: number, opts?: { signal?: AbortSignal }) =>
  req<Place & { label: string | null }>('GET', `/api/v1/places/reverse?lat=${lat}&lon=${lon}`, undefined,
    { signal: opts?.signal, screen: 'FarmLocation' });

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Uma linha sobre o estado da previsão (igual no iPhone e na web), ou null. */
export function forecastNotice(w: Weather | null, error: string | null, updating: boolean): string | null {
  if (updating) return 'Updating forecast…';
  const at = w?.updatedAt ? ` from ${fmtTime(w.updatedAt)}` : '';
  if (error && w?.current) return `Couldn't update the forecast; showing the one${at}.`;
  if (w?.stale) return `Couldn't update the forecast; showing the one${at}.`;
  return null;
}

// --- Pesquisa de lugares e nome do ponto (partilhado: iPhone, web mobile e desktop) ---

export type SearchStatus = 'idle' | 'searching' | 'done' | 'error';

/**
 * Pesquisa enquanto se escreve (com pausa de 450 ms) e, ao carregar em Enter/Pesquisar,
 * uma pesquisa mais larga (`submit`). Só a resposta do pedido mais recente conta: um
 * pedido antigo é cancelado (AbortController) e, se ainda assim chegar, é ignorado.
 * Vazio («nada encontrado») e erro são estados diferentes.
 */
export function usePlaceSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    ctrl.current?.abort();
    seq.current += 1;
  }, []);

  const run = useCallback((text: string, submit: boolean) => {
    cancel();
    const c = new AbortController();
    ctrl.current = c;
    const id = seq.current;
    setStatus('searching'); setError(null); setSubmitted(submit);
    searchPlaces(text, { submit, signal: c.signal })
      .then((r) => { if (id === seq.current) { setResults(r); setStatus('done'); } })
      .catch((e: any) => {
        if (id !== seq.current || e?.name === 'AbortError') return;
        setResults([]); setError(String(e?.message ?? e)); setStatus('error');
      });
  }, [cancel]);

  useEffect(() => {
    if (q.trim().length < 3) { cancel(); setResults([]); setStatus('idle'); setError(null); return; }
    timer.current = setTimeout(() => run(q, false), 450);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, run, cancel]);
  useEffect(() => () => ctrl.current?.abort(), []);

  const submit = useCallback(() => { if (q.trim().length >= 3) run(q, true); }, [q, run]);
  const clear = useCallback(() => { cancel(); setQ(''); setResults([]); setStatus('idle'); setError(null); }, [cancel]);
  return { q, setQ, results, status, error, submitted, submit, clear };
}

/** Texto para quando a pesquisa não encontrou nada (ou falhou). */
export function searchMessage(s: { status: SearchStatus; results: Place[]; error: string | null; submitted: boolean }): string | null {
  if (s.status === 'error') return s.error ?? 'Place search failed. Try again.';
  if (s.status === 'done' && s.results.length === 0) {
    return s.submitted
      ? 'No places found. Try the town or the 4-digit postcode.'
      : 'No places found yet. Press Search (Enter) to look further, or try the town or the 4-digit postcode.';
  }
  return null;
}

/** Nome do lugar do pino. Mover o pino depressa não deixa um nome antigo ganhar. */
export function usePinLabel(initial: string | null) {
  const [label, setLabelState] = useState<string | null>(initial);
  const [failed, setFailed] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const setKnown = useCallback((l: string | null) => {
    ctrl.current?.abort(); seq.current += 1; setLabelState(l); setFailed(false);
  }, []);
  const lookup = useCallback((lat: number, lon: number) => {
    ctrl.current?.abort();
    const c = new AbortController(); ctrl.current = c;
    const id = ++seq.current;
    setLabelState(null); setFailed(false);
    reversePlace(lat, lon, { signal: c.signal })
      .then((p) => { if (id === seq.current) { setLabelState(p.label); setFailed(!p.label); } })
      .catch((e: any) => { if (id === seq.current && e?.name !== 'AbortError') setFailed(true); });
  }, []);
  useEffect(() => () => ctrl.current?.abort(), []);
  return { label, failed, setKnown, lookup };
}

export const POSTCODE_CREDIT = 'Postcodes: GeoNames (geonames.org), CC BY 4.0';

const CACHE_KEY = (org: string) => `@pondifarm:weather:${org}`;
const SEEN_KEY = (org: string) => `@pondifarm:weather-seen:${org}`;

interface Ctx {
  weather: Weather | null;
  loading: boolean;
  error: string | null;
  /** A localização mudou e a previsão do sítio novo ainda vem a caminho. */
  updating: boolean;
  /** Põe já a localização nova (sem esperar pela previsão) e pede a previsão dela. */
  applyLocation: (loc: FarmLocation) => void;
  /** Há aviso importante ainda não visto (acende o ponto laranja). */
  unread: boolean;
  refresh: () => Promise<void>;
  markSeen: () => void;
}
const WeatherCtx = createContext<Ctx>({
  weather: null, loading: false, error: null, updating: false, applyLocation: () => {}, unread: false, refresh: async () => {}, markSeen: () => {},
});

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const orgId = user?.membershipStatus === 'active' ? user.organizationId : null;
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  // Um pedido de cada vez; um refresh pedido durante outro NÃO se perde: fica
  // marcado (`again`) e corre logo a seguir, com a organização atual. Antes, o
  // segundo era ignorado e a quinta acabada de guardar podia ficar sem previsão.
  const run = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const orgRef = useRef(orgId);
  orgRef.current = orgId;

  const refresh = useCallback((): Promise<void> => {
    if (!orgRef.current) return Promise.resolve();
    if (run.current) { again.current = true; return run.current; }
    const p = (async () => {
      setLoading(true);
      try {
        do {
          again.current = false;
          const id = orgRef.current;
          if (!id) break;
          try {
            const w = await fetchWeather(id);
            if (orgRef.current !== id) { again.current = true; continue; }   // mudou de organização
            setWeather(w); setError(null);
            void AsyncStorage.setItem(CACHE_KEY(id), JSON.stringify(w)).catch(() => {});
          } catch (e: any) {
            if (orgRef.current === id) setError(String(e?.message ?? e));   // mantém a última previsão guardada
          }
        } while (again.current);
      } finally {
        run.current = null; setLoading(false); setUpdating(false);
      }
    })();
    run.current = p;
    return p;
  }, []);

  const applyLocation = useCallback((loc: FarmLocation) => {
    setWeather((prev) => {
      const same = prev?.location && prev.location.lat === loc.lat && prev.location.lon === loc.lon;
      // Sítio novo: a previsão antiga era de outro lugar, não se mostra com o nome novo.
      return same
        ? { ...prev!, location: loc }
        : { location: loc, canSetLocation: prev?.canSetLocation ?? true };
    });
    setError(null);
    setUpdating(true);
    void refresh();
  }, [refresh]);

  // Ao entrar (ou mudar de organização): a última guardada logo, depois a nova.
  useEffect(() => {
    setWeather(null);
    if (!orgId) return;
    AsyncStorage.multiGet([CACHE_KEY(orgId), SEEN_KEY(orgId)]).then(([[, w], [, s]]) => {
      if (w) setWeather((cur) => cur ?? JSON.parse(w));
      setSeen(s ? JSON.parse(s) : []);
    }).catch(() => {});
    void refresh();
    const id = setInterval(() => { void refresh(); }, REFRESH_MS);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void refresh(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [orgId, refresh]);

  const ids = useMemo(() => (weather?.alerts ?? []).map((a) => a.id), [weather]);
  const unread = ids.some((id) => !seen.includes(id));
  // Estável (não depende de `seen`) e só muda o estado se houver um id novo:
  // antes, cada chamada criava uma função nova e o efeito da página voltava a correr
  // em ciclo («Maximum update depth exceeded» no iPhone).
  const idsRef = useRef(ids); idsRef.current = ids;
  const markSeen = useCallback(() => {
    if (!orgId) return;
    setSeen((prev) => {
      const fresh = idsRef.current.filter((id) => !prev.includes(id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh].slice(-60);
      void AsyncStorage.setItem(SEEN_KEY(orgId), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [orgId]);

  const value = useMemo(
    () => ({ weather, loading, error, updating, applyLocation, unread, refresh, markSeen }),
    [weather, loading, error, updating, applyLocation, unread, refresh, markSeen],
  );
  return <WeatherCtx.Provider value={value}>{children}</WeatherCtx.Provider>;
}

export const useWeather = () => useContext(WeatherCtx);

// --- Texto e cores partilhados -------------------------------------------------

export const KIND_LABEL: Record<WeatherKind, string> = {
  sun: 'Clear', hot: 'Strong sun', cloudy: 'Cloudy', rain: 'Rain', storm: 'Thunderstorm', wind: 'Windy', night: 'Clear night',
};
export const BAND_LABEL: Record<ThiBand, string> = { normal: 'Normal', alert: 'Alert', danger: 'Danger', emergency: 'Emergency' };
