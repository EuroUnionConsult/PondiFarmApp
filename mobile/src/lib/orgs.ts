// Organizações com Líder: pesquisar, criar, pedir entrada e — para o Líder —
// aprovar, recusar, remover e passar a liderança. Rotas do backend de 21/10/2026.
import { getBackendUrl } from './api';
import { trackServerRequest } from './serverWake';
import { authHeaders } from './auth';

export interface OrgSearchResult {
  id: string;
  name: string;
}

export interface PendingJoinRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

export interface OrgPerson {
  userId: string;
  name: string;
  email: string;
  role: 'leader' | 'member';
  since: string;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = (await getBackendUrl()).trim().replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await trackServerRequest(fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true',
        ...(await authHeaders()),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    }));
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data?.detail === 'string' ? data.detail : `HTTP ${res.status}`);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export const MIN_SEARCH_CHARS = 3;

export const searchOrganizations = (q: string) =>
  call<OrgSearchResult[]>('GET', `/api/v1/organizations/search?q=${encodeURIComponent(q.trim())}`);

export const createOrganization = (name: string) =>
  call<OrgSearchResult>('POST', '/api/v1/organizations/create', { name: name.trim() });

export const requestToJoin = (organizationId: string) =>
  call<unknown>('POST', '/api/v1/organizations/join-requests', { organizationId });

export const cancelMyRequest = () => call<void>('DELETE', '/api/v1/organizations/join-requests/mine');

export const listPendingRequests = (orgId: string) =>
  call<PendingJoinRequest[]>('GET', `/api/v1/organizations/${orgId}/join-requests`);

export const approveRequest = (orgId: string, requestId: string) =>
  call<unknown>('POST', `/api/v1/organizations/${orgId}/join-requests/${requestId}/approve`);

export const rejectRequest = (orgId: string, requestId: string) =>
  call<unknown>('POST', `/api/v1/organizations/${orgId}/join-requests/${requestId}/reject`);

export const listPeople = (orgId: string) =>
  call<OrgPerson[]>('GET', `/api/v1/organizations/${orgId}/people`);

export const removePerson = (orgId: string, userId: string) =>
  call<void>('DELETE', `/api/v1/organizations/${orgId}/people/${userId}`);

export const transferLeadership = (orgId: string, userId: string) =>
  call<void>('POST', `/api/v1/organizations/${orgId}/transfer-leadership`, { userId });

export const leaveOrganization = (orgId: string) =>
  call<void>('POST', `/api/v1/organizations/${orgId}/leave`);

// --- Ações em massa (só o Líder) ---------------------------------------------
// O backend aceita até 100 ids por pedido e responde item a item; aqui divide-se
// em lotes de 100 e juntam-se os resultados, para a interface não ter limite.

/** Códigos estáveis do backend quando um item falha. */
export type BulkReason =
  | 'already_handled' | 'in_other_organization' | 'not_a_member'
  | 'is_self' | 'is_leader' | 'error';

export interface BulkItemResult { id: string; ok: boolean; reason: BulkReason | string | null }
export interface BulkResult { succeeded: number; failed: number; results: BulkItemResult[] }

export const BULK_MAX = 100;
export type BulkRequestAction = 'approve' | 'deny';

async function inBatches(ids: string[], send: (batch: string[]) => Promise<BulkResult>): Promise<BulkResult> {
  const unique = Array.from(new Set(ids));
  const out: BulkResult = { succeeded: 0, failed: 0, results: [] };
  for (let i = 0; i < unique.length; i += BULK_MAX) {
    const r = await send(unique.slice(i, i + BULK_MAX));
    out.succeeded += r.succeeded; out.failed += r.failed; out.results.push(...r.results);
  }
  return out;
}

export const bulkDecideRequests = (orgId: string, ids: string[], action: BulkRequestAction) =>
  inBatches(ids, (batch) => call<BulkResult>('POST', `/api/v1/organizations/${orgId}/join-requests/bulk`, { ids: batch, action }));

export const bulkRemovePeople = (orgId: string, userIds: string[]) =>
  inBatches(userIds, (batch) => call<BulkResult>('POST', `/api/v1/organizations/${orgId}/members/bulk-remove`, { userIds: batch }));

const REASON_TEXT: Record<string, string> = {
  already_handled: 'already handled',
  in_other_organization: 'already in another organization',
  not_a_member: 'no longer a member',
  is_self: 'you can’t remove yourself',
  is_leader: 'the leader can’t be removed',
  error: 'server error',
};
export const bulkReasonText = (reason: string | null | undefined) => REASON_TEXT[reason ?? ''] ?? 'not done';

/** Título e detalhe do aviso: «5 approved, 1 failed» + «Already handled.» */
export function summarizeBulkParts(r: BulkResult, verb: string): { title: string; detail?: string } {
  const title = r.failed === 0 ? `${r.succeeded} ${verb}` : `${r.succeeded} ${verb}, ${r.failed} failed`;
  if (r.failed === 0) return { title };
  const counts = new Map<string, number>();
  for (const it of r.results) if (!it.ok) { const t = bulkReasonText(it.reason); counts.set(t, (counts.get(t) ?? 0) + 1); }
  const why = counts.size === 1
    ? Array.from(counts.keys())[0]
    : Array.from(counts.entries()).map(([t, n]) => `${n} ${t}`).join(', ');
  return { title, detail: `${why.charAt(0).toUpperCase()}${why.slice(1)}.` };
}

/** «5 approved, 1 failed: already handled» — igual na app e na web. */
export function summarizeBulk(r: BulkResult, verb: string): string {
  const { title, detail } = summarizeBulkParts(r, verb);
  return detail ? `${title}: ${detail.charAt(0).toLowerCase()}${detail.slice(1, -1)}` : title;
}

// --- Histórico da organização (só o Líder) ---------------------------------

export type OrgEventType =
  | 'created' | 'join_requested' | 'join_cancelled' | 'approved'
  | 'rejected' | 'removed' | 'left' | 'leader_transferred';

export interface OrgEvent {
  id: string;
  type: OrgEventType | string;
  actorName: string | null;
  subjectName: string | null;
  createdAt: string;
}

export const listEvents = (orgId: string, limit = 30) =>
  call<OrgEvent[]>('GET', `/api/v1/organizations/${orgId}/events?limit=${limit}`);

/** A frase do histórico, igual na app e na web. */
export function describeEvent(e: OrgEvent): string {
  const who = e.actorName || 'Someone';
  const whom = e.subjectName || 'a member';
  switch (e.type) {
    case 'created': return `${who} created the organization`;
    case 'join_requested': return `${who} asked to join`;
    case 'join_cancelled': return `${who} cancelled the request to join`;
    case 'approved': return `${who} approved ${whom}`;
    case 'rejected': return `${who} declined ${whom}’s request`;
    case 'removed': return `${who} removed ${whom}`;
    case 'left': return `${who} left the organization`;
    case 'leader_transferred': return `${who} made ${whom} the leader`;
    default: return `${who}: ${e.type}`;
  }
}
