import { describe, expect, it, vi } from 'vitest';
import { createAuthStore } from '../lib/auth-store.mjs';
import { dummyPasswordHash } from '../lib/password.mjs';

const account = { id: 'test-id', email: 'user@example.test', role: 'administrador', active: true, locked: false, password_hash: 'fake-hash' };

function fixture(user: typeof account | undefined = account, valid = true) {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    void params;
    return { rows: sql.startsWith('SELECT') && user ? [user] : [] };
  });
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn(async () => client), query };
  const verify = vi.fn(async () => valid);
  return { store: createAuthStore(() => pool, verify), query, client, verify };
}

describe('PostgreSQL adapter contract (fake SQL client, not a real migration)', () => {
  it('locks the account row, uses bound input and returns only public user fields', async () => {
    const { store, query, client } = fixture();
    expect(await store.authenticate(account.email, 'fake-password')).toEqual({ id: account.id, email: account.email, role: account.role });
    expect(query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(query.mock.calls[1][1]).toEqual([account.email]);
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('performs password work for nonexistent accounts and returns no user', async () => {
    const missing = fixture();
    missing.query.mockResolvedValue({ rows: [] });
    expect(await missing.store.authenticate('missing@example.test', 'fake-password')).toBeNull();
    expect(missing.verify).toHaveBeenCalledWith('fake-password', dummyPasswordHash);
  });

  it.each([{ ...account, active: false }, { ...account, locked: true }])('rejects disabled/locked accounts', async user => {
    const { store, query } = fixture(user);
    expect(await store.authenticate(account.email, 'fake-password')).toBeNull();
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it('persists failed attempts with a five-attempt / fifteen-minute lockout policy', async () => {
    const { store, query } = fixture(account, false);
    expect(await store.authenticate(account.email, 'wrong-password')).toBeNull();
    const update = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'));
    expect(update?.[0]).toContain('failed_login_attempts + 1 >= 5');
    expect(update?.[0]).toContain("interval '15 minutes'");
    expect(update?.[1]).toEqual([account.id]);
  });

  it('rolls back and releases connections without exposing raw database errors', async () => {
    const { store, query, client } = fixture();
    query.mockRejectedValueOnce(new Error('sensitive-driver-error'));
    await expect(store.authenticate(account.email, 'fake-password')).rejects.toThrow('Authentication storage unavailable');
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rotates session state atomically and stores only the provided hash', async () => {
    const { store, query, client } = fixture();
    const expiry = new Date('2026-11-22T00:00:00Z');
    await store.createSession(account.id, 'new-hash', expiry, 'old-hash');
    expect(query.mock.calls[1][1]).toEqual(['old-hash']);
    expect(query.mock.calls[2][1]).toEqual(['new-hash', account.id, expiry]);
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('queries expiry, revocation, active account and current role on session reads', async () => {
    const { store, query } = fixture();
    const now = new Date();
    await store.findSession('hash-only', now);
    expect(query.mock.calls[0][0]).toContain('s.revoked_at IS NULL');
    expect(query.mock.calls[0][0]).toContain('s.expires_at > $2');
    expect(query.mock.calls[0][0]).toContain('u.active = true');
    expect(query.mock.calls[0][1]).toEqual(['hash-only', now]);
  });
});
