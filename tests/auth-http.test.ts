import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createAuthHandlers } from '../lib/auth-http';
import { AuthError, type AuthService } from '../lib/auth';

const csrfToken = 'a'.repeat(43);
const sessionToken = 'b'.repeat(43);
const user = { id: 'test-id', email: 'admin@example.test', role: 'administrador' as const };
const origin = 'https://market.example.test';

function request(path: string, changes: Record<string, string> = {}, body = JSON.stringify({ email: user.email, password: 'unit-test-password' })) {
  return new NextRequest(`${origin}/api/auth/${path}`, {
    method: 'POST',
    headers: {
      origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
      cookie: `__Host-lp_csrf=${csrfToken}; __Host-lp_session=${sessionToken}`,
      'x-csrf-token': csrfToken, ...changes,
    },
    body,
  });
}

describe('auth HTTP boundary (real handlers, fake service, no network)', () => {
  let service: AuthService;
  beforeEach(() => {
    service = {
      login: vi.fn(async () => ({ user, token: sessionToken })),
      logout: vi.fn(async () => {}),
      requireAccess: vi.fn(async () => user),
    };
  });

  it('issues a noncacheable CSRF token with a protected host-only cookie', async () => {
    const response = await createAuthHandlers(service, true).csrf(new NextRequest(`${origin}/api/auth/csrf`));
    const data = await response.json();
    expect(data.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.cookies.get('__Host-lp_csrf')).toMatchObject({ value: data.csrfToken, httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
    expect(response.headers.get('set-cookie')).not.toContain('Domain=');
  });

  it('sets a secure session cookie, rotates CSRF and never exposes session tokens in JSON', async () => {
    const response = await createAuthHandlers(service, true).login(request('login'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user });
    expect(response.cookies.get('__Host-lp_session')).toMatchObject({ value: sessionToken, httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 28800 });
    expect(response.cookies.get('__Host-lp_csrf')?.maxAge).toBe(0);
    expect(service.login).toHaveBeenCalledWith({ email: user.email, password: 'unit-test-password' }, sessionToken);
  });

  it('supports HTTP localhost without weakening production cookie settings', async () => {
    const response = await createAuthHandlers(service, false).csrf(new NextRequest('http://localhost/api/auth/csrf'));
    expect(response.cookies.get('lp_csrf')).toMatchObject({ secure: false, httpOnly: true, sameSite: 'strict' });
  });

  it.each<Record<string, string>>([
    { origin: 'https://attacker.example.test' },
    { origin: '' },
    { 'sec-fetch-site': 'cross-site' },
    { 'x-csrf-token': '' },
    { 'x-csrf-token': 'c'.repeat(43) },
    { cookie: '' },
  ])('rejects login and logout CSRF before accessing storage: %j', async changes => {
    const handlers = createAuthHandlers(service, true);
    expect((await handlers.login(request('login', changes))).status).toBe(403);
    expect((await handlers.logout(request('logout', changes))).status).toBe(403);
    expect(service.login).not.toHaveBeenCalled();
    expect(service.logout).not.toHaveBeenCalled();
  });

  it('rejects malformed, oversized or non-JSON login bodies', async () => {
    const handlers = createAuthHandlers(service, true);
    expect((await handlers.login(request('login', {}, '{'))).status).toBe(400);
    expect((await handlers.login(request('login', {}, 'x'.repeat(4097)))).status).toBe(413);
    expect((await handlers.login(request('login', { 'content-type': 'text/plain' }))).status).toBe(415);
    expect(service.login).not.toHaveBeenCalled();
  });

  it('requires backend authorization even when called directly without the UI', async () => {
    const handlers = createAuthHandlers(service, true);
    vi.mocked(service.requireAccess).mockRejectedValue(new AuthError(403, 'Forbidden'));
    const response = await handlers.admin(request('admin'));
    expect(response.status).toBe(403);
    expect(service.requireAccess).toHaveBeenCalledWith(sessionToken, 'write');
  });

  it('rejects unauthenticated session reads', async () => {
    vi.mocked(service.requireAccess).mockRejectedValue(new AuthError(401, 'Unauthorized'));
    const response = await createAuthHandlers(service, true).session(new NextRequest(`${origin}/api/auth/session`));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('revokes before clearing cookies and does not claim success on a database failure', async () => {
    const handlers = createAuthHandlers(service, true);
    vi.mocked(service.logout).mockRejectedValueOnce(new Error('sensitive-internal-details'));
    const failure = await handlers.logout(request('logout'));
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain('sensitive-internal-details');
    expect(failure.headers.get('set-cookie')).toBeNull();
    const response = await handlers.logout(request('logout'));
    expect(response.status).toBe(204);
    expect(service.logout).toHaveBeenCalledWith(sessionToken);
    expect(response.cookies.get('__Host-lp_session')).toMatchObject({ value: '', maxAge: 0, secure: true });
  });
});
