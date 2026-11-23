// Relatório de erros para o nosso backend (POST /api/v1/client-errors), sem SaaS externo.
// Cada relatório vira uma linha de log no servidor (e no Application Insights), para
// sabermos que erros as pessoas estão a ter no iPhone, na web de computador e na web
// de telemóvel. Regras: nunca lança, nunca bloqueia (fire-and-forget), não repete o
// mesmo erro em 5 minutos e não envia mais de 30 por sessão. Sem emails, tokens nem
// coordenadas: o endpoint vai sem query string e as mensagens são curtas.
//
// FICHEIRO PARTILHADO: igual em PondiFarmApp/mobile/src/lib e PondiFarmWeb-Desk/src/lib.
import { Platform } from 'react-native';
import { getBackendUrl } from './api';
import { authHeaders } from './auth';
import { APP_VERSION } from './version';

export type ReportPlatform = 'ios' | 'web-desktop' | 'web-mobile';
export type ReportKind = 'api' | 'network' | 'js' | 'unhandled-rejection';

export interface ErrorReport {
  /** Ecrã/página onde aconteceu (ex.: 'FarmLocation', 'Weather'). */
  screen?: string;
  message: string;
  kind?: ReportKind;
  httpStatus?: number;
  /** Caminho da API (a query string é retirada aqui e no servidor). */
  endpoint?: string;
}

let platform: ReportPlatform = Platform.OS === 'web' ? 'web-mobile' : 'ios';
/** A versão web chama isto quando sabe se está no layout de computador ou de telemóvel. */
export function setReportPlatform(p: ReportPlatform) { platform = p; }

let screenName: string | undefined;

const DEDUPE_MS = 5 * 60 * 1000;
const MAX_PER_SESSION = 30;
const recent = new Map<string, number>();
let sent = 0;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** '/api/v1/places/search?q=…' → '/api/v1/places/search'; URLs completas → só o caminho. */
export function endpointPath(url: string): string {
  const noQuery = url.split('?')[0];
  const m = noQuery.match(/^https?:\/\/[^/]+(\/.*)?$/i);
  return m ? (m[1] || '/') : noQuery;
}

export function reportError(r: ErrorReport): void {
  try {
    const endpoint = r.endpoint ? endpointPath(r.endpoint) : undefined;
    // Não reportar falhas do próprio relatório (ciclo).
    if (endpoint?.includes('/client-errors')) return;
    const message = clip(String(r.message || 'Unknown error'), 900);
    // Sem ecrã explícito (ex.: erros de API em api.ts), usa o ecrã ativo do navegador.
    const screen = r.screen ?? screenName;
    const key = [r.kind, screen, r.httpStatus, endpoint, message.slice(0, 200)].join('|');
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_MS) return;
    if (sent >= MAX_PER_SESSION) return;
    recent.set(key, now);
    sent += 1;
    if (recent.size > 200) recent.clear();
    const body = JSON.stringify({
      platform,
      appVersion: APP_VERSION,
      screen: screen ? clip(screen, 64) : undefined,
      message,
      kind: r.kind,
      httpStatus: r.httpStatus,
      endpoint: endpoint ? clip(endpoint, 200) : undefined,
      timestamp: new Date(now).toISOString(),
    });
    void (async () => {
      try {
        const base = (await getBackendUrl()).trim().replace(/\/+$/, '');
        let auth: Record<string, string> = {};
        try { auth = (await authHeaders()) as Record<string, string>; } catch {}
        await fetch(`${base}/api/v1/client-errors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...auth },
          body,
        });
      } catch {
        // Sem rede: o relatório perde-se; o erro original já foi tratado no ecrã.
      }
    })();
  } catch {
    // Nunca deixar o relatório estragar o que a app estava a fazer.
  }
}

/** Mensagem de um erro qualquer, curta. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return `${e.name !== 'Error' ? `${e.name}: ` : ''}${e.message}`;
  return typeof e === 'string' ? e : (() => { try { return JSON.stringify(e); } catch { return String(e); } })();
}

let installed = false;
/**
 * Erros JavaScript não apanhados: ErrorUtils no iPhone; window.onerror e
 * unhandledrejection na web. Encadeia com o handler anterior (o ecrã vermelho em
 * desenvolvimento e o crash normal em produção continuam iguais).
 */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.addEventListener('error', (ev: ErrorEvent) => {
        reportError({ kind: 'js', message: errorMessage(ev.error ?? ev.message), screen: currentScreen() });
      });
      window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
        reportError({ kind: 'unhandled-rejection', message: errorMessage(ev.reason), screen: currentScreen() });
      });
      return;
    }
    const EU = (globalThis as any).ErrorUtils;
    if (!EU?.getGlobalHandler || !EU?.setGlobalHandler) return;
    const prev = EU.getGlobalHandler();
    EU.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      reportError({ kind: 'js', message: `${isFatal ? '[fatal] ' : ''}${errorMessage(error)}`, screen: currentScreen() });
      prev?.(error, isFatal);
    });
  } catch {}
}

/** O navegador diz em que ecrã estamos (para os erros globais). */
export function setCurrentScreen(name: string | undefined) { screenName = name; }
const currentScreen = () => screenName;
/** Nome do ecrã ativo a partir do estado do React Navigation (rotas aninhadas incluídas). */
export function activeRouteName(state: any): string | undefined {
  let s = state;
  let name: string | undefined;
  while (s?.routes?.length) {
    const r = s.routes[s.index ?? s.routes.length - 1];
    name = r?.name;
    s = r?.state;
  }
  return name;
}
