import { describe, expect, it, vi } from 'vitest';
import { createMarketStore } from '../lib/market-store.mjs';

const id = '11111111-1111-4111-8111-111111111111';
function fixture(status = 'pendiente', total = 3, fulfilled = 2) {
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    void params;
    if (sql.startsWith('SELECT id, status')) return { rows: [{ id, status }] };
    if (sql.startsWith('SELECT count(*)')) return { rows: [{ total, fulfilled }] };
    if (sql.includes('RETURNING')) return { rows: [{ id, status: 'completo', code: 'identificacion', fulfilled: true }] };
    return { rows: [] };
  });
  const client = { query, release: vi.fn() };
  const pool = { query, connect: vi.fn(async () => client) };
  return { store: createMarketStore(() => pool), query, client };
}

describe('market SQL transaction contracts (fake PostgreSQL client)', () => {
  it('creates merchant, dossier and checklist in one transaction', async () => {
    const { store, query, client } = fixture();
    await store.createMerchant({ dni: '01234567', name: 'Ana Pérez', trade: 'Frutas' });
    expect(query.mock.calls[0][0]).toBe('BEGIN');
    expect(query.mock.calls[1][1]?.slice(1)).toEqual(['01234567', 'Ana Pérez', 'Frutas']);
    expect(query.mock.calls[2][0]).toContain('INSERT INTO dossiers');
    expect(query.mock.calls[3][0]).toContain('revision_sanitaria');
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('rolls back the complete merchant operation if dossier creation fails', async () => {
    const { store, query, client } = fixture();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id, status: 'pendiente' }] }).mockRejectedValueOnce(new Error('fake database failure'));
    await expect(store.createMerchant({ dni: '01234567', name: 'Ana Pérez', trade: 'Frutas' })).rejects.toThrow();
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('treats wildcard characters as literal search data using a bound parameter', async () => {
    const { store, query } = fixture();
    await store.listMerchants("%_O'Hara");
    expect(query.mock.calls[0][0]).not.toContain("O'Hara");
    expect(query.mock.calls[0][1]).toEqual(["%\\%\\_O'Hara%"]);
  });
  it('refuses assignment when the conditional update cannot reserve the stall', async () => {
    const { store, query } = fixture();
    query.mockResolvedValue({ rows: [] });
    await expect(store.assignStall({ merchantId: id, stallId: id })).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls[0][0]).toContain('merchant_id IS NULL');
    expect(query.mock.calls[0][1]).toEqual([id, id]);
  });
  it.each([[3, 2], [2, 2], [0, 0]])('rejects premature completion (%i requirements / %i fulfilled)', async (total, fulfilled) => {
    const { store, query, client } = fixture('pendiente', total, fulfilled);
    await expect(store.updateStatus({ dossierId: id, status: 'completo' })).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE dossiers'))).toBe(false);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('allows completion only after the locked dossier has all three requirements', async () => {
    const { store, query } = fixture('en_revision', 3, 3);
    await store.updateStatus({ dossierId: id, status: 'completo' });
    expect(query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(query.mock.calls[3][1]).toEqual(['completo', id]);
    expect(query).toHaveBeenLastCalledWith('COMMIT');
  });
  it('prevents unchecking a requirement on a complete dossier until reopened', async () => {
    const { store, query } = fixture('completo', 3, 3);
    await expect(store.updateRequirement({ dossierId: id, code: 'identificacion', fulfilled: false })).rejects.toMatchObject({ status: 409 });
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE dossier_requirements'))).toBe(false);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  });
  it('permits requirement changes on an open dossier and persists its timestamp', async () => {
    const { store, query } = fixture();
    await store.updateRequirement({ dossierId: id, code: 'identificacion', fulfilled: false });
    expect(query.mock.calls[2][1]).toEqual([false, id, 'identificacion']);
    expect(query.mock.calls[3][0]).toContain('updated_at');
    expect(query).toHaveBeenLastCalledWith('COMMIT');
  });
  it('returns 404 instead of updating a nonexistent dossier', async () => {
    const { store, query } = fixture();
    query.mockResolvedValue({ rows: [] });
    await expect(store.updateStatus({ dossierId: id, status: 'pendiente' })).rejects.toMatchObject({ status: 404 });
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  });
});
