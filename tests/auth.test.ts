import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthService, hashToken, SESSION_SECONDS, type AuthStore, type User } from '../lib/auth';

const admin: User = { id: 'test-admin', email: 'admin@example.test', role: 'administrador' };
const supervisor: User = { id: 'test-supervisor', email: 'supervisor@example.test', role: 'supervisor' };

describe('authentication and backend authorization (in-memory store)', () => {
  let now: Date;
  let currentUser: User;
  let store: AuthStore;
  const sessions = new Map<string, { user: User; expiresAt: Date; revoked: boolean }>();

  beforeEach(() => {
    now = new Date('2026-11-21T12:00:00Z');
    currentUser = admin;
    sessions.clear();
    store = {
      authenticate: vi.fn(async () => currentUser),
      createSession: vi.fn(async (_id, tokenHash, expiresAt, previousHash) => {
        if (previousHash && sessions.has(previousHash)) sessions.get(previousHash)!.revoked = true;
        sessions.set(tokenHash, { user: currentUser, expiresAt, revoked: false });
      }),
      findSession: vi.fn(async (tokenHash, instant) => {
        const session = sessions.get(tokenHash);
        return session && !session.revoked && session.expiresAt > instant ? session.user : null;
      }),
      revokeSession: vi.fn(async tokenHash => { if (sessions.has(tokenHash)) sessions.get(tokenHash)!.revoked = true; }),
    };
  });

  const credentials = { email: ' ADMIN@example.test ', password: 'unit-test-password' };

  it('normalizes email and stores a hash of an opaque token with absolute expiry', async () => {
    const service = createAuthService(store, () => now);
    const result = await service.login(credentials);
    expect(store.authenticate).toHaveBeenCalledWith('admin@example.test', credentials.password);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sessions.has(result.token)).toBe(false);
    expect(sessions.get(hashToken(result.token))?.expiresAt.getTime()).toBe(now.getTime() + SESSION_SECONDS * 1000);
    expect(await service.requireAccess(result.token, 'write')).toEqual(admin);
  });

  it('rejects empty, malformed and oversized inputs before hitting storage', async () => {
    const service = createAuthService(store);
    for (const input of [null, {}, { email: 'invalid', password: 'x' }, { ...credentials, password: '' }, { ...credentials, password: 'a'.repeat(129) }]) {
      await expect(service.login(input)).rejects.toMatchObject({ status: 400 });
    }
    expect(store.authenticate).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials without creating a session', async () => {
    vi.mocked(store.authenticate).mockResolvedValue(null);
    await expect(createAuthService(store).login(credentials)).rejects.toMatchObject({ status: 401 });
    expect(store.createSession).not.toHaveBeenCalled();
  });

  it('allows supervisor queries and rejects supervisor writes on the backend', async () => {
    currentUser = supervisor;
    const service = createAuthService(store, () => now);
    const { token } = await service.login(credentials);
    expect(await service.requireAccess(token, 'read')).toEqual(supervisor);
    await expect(service.requireAccess(token, 'write')).rejects.toMatchObject({ status: 403 });
  });

  it('rejects missing, forged and expired sessions', async () => {
    const service = createAuthService(store, () => now);
    await expect(service.requireAccess(undefined)).rejects.toMatchObject({ status: 401 });
    await expect(service.requireAccess('forged')).rejects.toMatchObject({ status: 401 });
    await expect(service.requireAccess('z'.repeat(43))).rejects.toMatchObject({ status: 401 });
    const { token } = await service.login(credentials);
    now = new Date(now.getTime() + SESSION_SECONDS * 1000);
    await expect(service.requireAccess(token)).rejects.toMatchObject({ status: 401 });
  });

  it('rotates the token on login and revokes the previous session', async () => {
    const service = createAuthService(store, () => now);
    const first = await service.login(credentials);
    const second = await service.login(credentials, first.token);
    expect(first.token).not.toBe(second.token);
    await expect(service.requireAccess(first.token)).rejects.toMatchObject({ status: 401 });
    expect(await service.requireAccess(second.token)).toEqual(admin);
  });

  it('logout revokes server state and prevents token replay', async () => {
    const service = createAuthService(store, () => now);
    const { token } = await service.login(credentials);
    await service.logout(token);
    await expect(service.requireAccess(token)).rejects.toMatchObject({ status: 401 });
    await expect(service.logout(undefined)).resolves.toBeUndefined();
  });

  it('rechecks account state and roles rather than trusting the cookie', async () => {
    const service = createAuthService(store, () => now);
    const { token } = await service.login(credentials);
    sessions.get(hashToken(token))!.user = supervisor;
    await expect(service.requireAccess(token, 'write')).rejects.toMatchObject({ status: 403 });
    vi.mocked(store.findSession).mockResolvedValue(null);
    await expect(service.requireAccess(token)).rejects.toMatchObject({ status: 401 });
  });
});
