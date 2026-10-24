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

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = (await getBackendUrl()).trim().replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'Only the leader can set the farm location.' : `HTTP ${res.status}`);
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
export const searchPlaces = (q: string) => req<Place[]>('GET', `/api/v1/places/search?q=${encodeURIComponent(q.trim())}`);
export const reversePlace = (lat: number, lon: number) =>
  req<Place & { label: string | null }>('GET', `/api/v1/places/reverse?lat=${lat}&lon=${lon}`);

const CACHE_KEY = (org: string) => `@pondifarm:weather:${org}`;
const SEEN_KEY = (org: string) => `@pondifarm:weather-seen:${org}`;

interface Ctx {
  weather: Weather | null;
  loading: boolean;
  error: string | null;
  /** Há aviso importante ainda não visto (acende o ponto laranja). */
  unread: boolean;
  refresh: () => Promise<void>;
  markSeen: () => void;
}
const WeatherCtx = createContext<Ctx>({ weather: null, loading: false, error: null, unread: false, refresh: async () => {}, markSeen: () => {} });

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const orgId = user?.membershipStatus === 'active' ? user.organizationId : null;
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!orgId || busy.current) return;
    busy.current = true; setLoading(true); setError(null);
    try {
      const w = await fetchWeather(orgId);
      setWeather(w);
      void AsyncStorage.setItem(CACHE_KEY(orgId), JSON.stringify(w)).catch(() => {});
    } catch (e: any) {
      setError(String(e?.message ?? e));   // mantém a última previsão guardada
    } finally {
      busy.current = false; setLoading(false);
    }
  }, [orgId]);

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

  const value = useMemo(() => ({ weather, loading, error, unread, refresh, markSeen }), [weather, loading, error, unread, refresh, markSeen]);
  return <WeatherCtx.Provider value={value}>{children}</WeatherCtx.Provider>;
}

export const useWeather = () => useContext(WeatherCtx);

// --- Texto e cores partilhados -------------------------------------------------

export const KIND_LABEL: Record<WeatherKind, string> = {
  sun: 'Clear', hot: 'Strong sun', cloudy: 'Cloudy', rain: 'Rain', storm: 'Thunderstorm', wind: 'Windy', night: 'Clear night',
};
export const BAND_LABEL: Record<ThiBand, string> = { normal: 'Normal', alert: 'Alert', danger: 'Danger', emergency: 'Emergency' };
