import { describe, expect, it, vi } from 'vitest';
import { assertPending, migrationState, applyMigration, inspectDatabase } from '../scripts/db-migrations.mjs';

describe('manual migration runner (simulated catalog, no database)', () => {
  it('distinguishes absent, present and partial without claiming history', () => {
    expect(migrationState([], '001')).toBe('AUSENTE');
    expect(migrationState(['users'], '001')).toBe('PARCIAL_BLOQUEADA');
    expect(migrationState(['users', 'sessions'], '001')).toBe('OBJETOS_PRESENTES_REVISAR');
  });
  it('refuses reapplication, partial schemas and out-of-order execution', () => {
    expect(() => assertPending(['users'], '001')).toThrow();
    expect(() => assertPending(['users', 'sessions'], '001')).toThrow();
    expect(() => assertPending([], '002')).toThrow();
    expect(() => assertPending(['users', 'sessions'], '002')).not.toThrow();
    expect(() => assertPending([], '003')).toThrow();
  });
  it('rolls back instead of executing DDL when any target object already exists', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('current_schema()')) return { rows: [{ schema: 'public' }] };
      if (sql.includes('pg_catalog.pg_class')) return { rows: [{ name: 'users', kind: 'r' }] };
      return { rows: [] };
    });
    await expect(applyMigration({ query }, '001')).rejects.toThrow();
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(query.mock.calls.some(([sql]) => sql.includes('CREATE TABLE'))).toBe(false);
  });
  it('applies only the selected additive DDL within its owned transaction', async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('current_schema()') ? [{ schema: 'public' }] : [] }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await applyMigration({ query }, '001');
      const ddl = query.mock.calls.find(([sql]) => sql.includes('CREATE TABLE'))?.[0];
      expect(ddl).toContain('CREATE TABLE users');
      expect(ddl).not.toMatch(/(?:^|;)\s*(BEGIN|COMMIT|DROP|TRUNCATE|DELETE|UPDATE)\b/i);
      expect(query).toHaveBeenLastCalledWith('COMMIT');
    } finally { log.mockRestore(); }
  });
  it('applies 002 only when the prerequisite tables exist and its targets do not', async () => {
    const query = vi.fn(async (sql: string): Promise<{ rows: Record<string, unknown>[] }> => {
      if (sql.includes('current_schema()')) return { rows: [{ schema: 'public' }] };
      if (sql.includes('pg_catalog.pg_class')) return { rows: [{ name: 'users', kind: 'r' }, { name: 'sessions', kind: 'r' }] };
      return { rows: [] };
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await applyMigration({ query }, '002');
      const ddl = query.mock.calls.find(([sql]) => sql.includes('CREATE TABLE'))?.[0];
      expect(ddl).toContain('CREATE TABLE dossier_requirements');
      expect(ddl).not.toContain('CREATE TABLE users');
      expect(query).toHaveBeenLastCalledWith('COMMIT');
    } finally { log.mockRestore(); }
  });
  it('rolls back on a DDL failure without reporting success', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) throw new Error('simulated DDL failure');
      return { rows: sql.includes('current_schema()') ? [{ schema: 'public' }] : [] };
    });
    await expect(applyMigration({ query }, '001')).rejects.toThrow();
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  });
  it('inspects catalog metadata inside a read-only transaction without reading table data', async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('current_schema()') ? [{ schema: 'public' }] : [] }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    try {
      await inspectDatabase({ query });
      expect(query).toHaveBeenNthCalledWith(1, 'BEGIN READ ONLY');
      expect(query).toHaveBeenLastCalledWith('ROLLBACK');
      for (const [sql] of query.mock.calls) expect(sql).not.toMatch(/\bFROM\s+(users|sessions|merchants)\b/i);
    } finally { log.mockRestore(); table.mockRestore(); }
  });
});
