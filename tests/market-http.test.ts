import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createAuthService, hashToken, type User } from '../lib/auth';
import { createMarketHandlers } from '../lib/market-http';
import type { MarketStore } from '../lib/market';

const origin = 'https://market.example.test';
const token = 'b'.repeat(43);
const csrf = 'a'.repeat(43);
const id = '11111111-1111-4111-8111-111111111111';
const totals = { total: 0, pendiente: 0, en_revision: 0, completo: 0, pendientes: 0 };

describe('market endpoints with real authorization and simulated storage', () => {
  let user: User | null;
  let store: MarketStore;
  beforeEach(() => {
    user = { id, email: 'admin@example.test', role: 'administrador' };
    store = {
      listMerchants: vi.fn(async () => []), createMerchant: vi.fn(async () => ({ id })),
      listStalls: vi.fn(async () => []), createStall: vi.fn(async () => ({ id })), assignStall: vi.fn(async () => ({ id })),
      listDossiers: vi.fn(async () => []), updateRequirement: vi.fn(async () => ({ fulfilled: true })), updateStatus: vi.fn(async () => ({ status: 'completo' })),
      indicators: vi.fn(async () => totals),
    };
  });
  function handlers() {
    const service = createAuthService({
      authenticate: vi.fn(), createSession: vi.fn(), revokeSession: vi.fn(),
      findSession: vi.fn(async hash => hash === hashToken(token) ? user : null),
    });
    return createMarketHandlers(service, store, true);
  }
  function req(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
    return new NextRequest(`${origin}/api/${path}`, {
      method, headers: { cookie: `__Host-lp_session=${token}; __Host-lp_csrf=${csrf}`, origin, 'x-csrf-token': csrf, 'content-type': 'application/json', ...headers },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    });
  }
  const writes = [
    ['createMerchant', 'merchants', 'POST', { dni: '01234567', name: 'Ana Pérez', trade: 'Frutas' }],
    ['createStall', 'stalls', 'POST', { code: 'A-01', sector: 'Frutas' }],
    ['assignStall', 'stalls/assign', 'POST', { merchantId: id, stallId: id }],
    ['updateRequirement', 'dossiers/requirements', 'PATCH', { dossierId: id, code: 'identificacion', fulfilled: true }],
    ['updateStatus', 'dossiers/status', 'PATCH', { dossierId: id, status: 'completo' }],
  ] as const;

  it('returns 401 for every business endpoint when the session is absent or revoked', async () => {
    user = null;
    const h = handlers();
    for (const key of Object.keys(h) as (keyof typeof h)[]) expect((await h[key](req('anything'))).status).toBe(401);
    expect(store.listDossiers).not.toHaveBeenCalled();
  });

  it('allows supervisor dossier and indicator queries but denies the merchant and stall padron', async () => {
    user!.role = 'supervisor';
    const h = handlers();
    expect((await h.dossiers(req('dossiers?status=pendientes'))).status).toBe(200);
    expect(store.listDossiers).toHaveBeenCalledWith('pendientes');
    const response = await h.indicators(req('indicators'));
    expect(await response.json()).toEqual({ data: totals });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await h.merchants(req('merchants'))).status).toBe(403);
    expect((await h.stalls(req('stalls'))).status).toBe(403);
    expect(store.listMerchants).not.toHaveBeenCalled();
  });

  it.each(writes)('denies supervisor direct backend writes: %s', async (handler, path, method, body) => {
    user!.role = 'supervisor';
    expect((await handlers()[handler](req(path, method, body))).status).toBe(403);
    expect(store[handler]).not.toHaveBeenCalled();
  });

  it.each(writes)('allows admin valid data and blocks CSRF before storage: %s', async (handler, path, method, body) => {
    const h = handlers();
    expect((await h[handler](req(path, method, body, { 'x-csrf-token': '' }))).status).toBe(403);
    expect((await h[handler](req(path, method, body, { origin: 'https://evil.example.test' }))).status).toBe(403);
    expect(store[handler]).not.toHaveBeenCalled();
    const response = await h[handler](req(path, method, body));
    expect(response.status).toBe(handler === 'createMerchant' || handler === 'createStall' ? 201 : 200);
    expect(store[handler]).toHaveBeenCalledOnce();
  });

  it('rejects invalid data and unknown filters without querying business storage', async () => {
    const h = handlers();
    for (const [handler, path, method] of writes) expect((await h[handler](req(path, method, {}))).status).toBe(400);
    expect((await h.dossiers(req('dossiers?status=illegal'))).status).toBe(400);
    expect((await h.merchants(req(`merchants?q=${'a'.repeat(81)}`))).status).toBe(400);
    expect(store.createMerchant).not.toHaveBeenCalled();
    expect(store.listDossiers).not.toHaveBeenCalled();
  });

  it('maps duplicate and missing references safely and hides raw database errors', async () => {
    const h = handlers();
    const [, path, method, body] = writes[0];
    vi.mocked(store.createMerchant).mockRejectedValueOnce({ code: '23505', detail: 'sensitive-dni' });
    const duplicate = await h.createMerchant(req(path, method, body));
    expect(duplicate.status).toBe(409);
    expect(await duplicate.text()).not.toContain('sensitive-dni');
    vi.mocked(store.assignStall).mockRejectedValueOnce({ code: '23503' });
    expect((await h.assignStall(req('stalls/assign', 'POST', { merchantId: id, stallId: id }))).status).toBe(400);
    vi.mocked(store.indicators).mockRejectedValueOnce(new Error('secret-driver-string'));
    const failure = await h.indicators(req('indicators'));
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain('secret-driver-string');
  });
});
