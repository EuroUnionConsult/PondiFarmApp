// Organizações com Líder: pesquisar, criar, pedir entrada e — para o Líder —
// aprovar, recusar, remover e passar a liderança. Rotas do backend de 21/10/2026.
import { getBackendUrl } from './api';
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
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true',
        ...(await authHeaders()),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
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
