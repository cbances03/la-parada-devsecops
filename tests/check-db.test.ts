import { describe, expect, it } from 'vitest';
import { connectionOptions, verifyDatabase } from '../scripts/check-db.mjs';

describe('database safety contract (fake client, no network)', () => {
  it('requires a PostgreSQL connection', () => {
    expect(() => connectionOptions('')).toThrow();
    expect(() => connectionOptions('https://localhost/db')).toThrow();
  });

  it('enforces certificate validation despite URL overrides', () => {
    const options = connectionOptions('postgresql://localhost/test?sslmode=disable&sslcert=ignored&uselibpqcompat=true');
    expect(options.ssl).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: 'localhost' });
    expect(new URL(options.connectionString).searchParams.has('sslmode')).toBe(false);
    expect(new URL(options.connectionString).searchParams.has('sslcert')).toBe(false);
  });

  it('executes SELECT 1 only and closes the connection', async () => {
    const calls: string[] = [];
    class FakeClient {
      async connect() { calls.push('connect'); }
      async query(sql: string) { calls.push(sql); return { rows: [{ '?column?': 1 }] }; }
      async end() { calls.push('end'); }
    }
    await verifyDatabase('postgresql://localhost/test', FakeClient);
    expect(calls).toEqual(['connect', 'SELECT 1', 'end']);
  });

  it('closes the connection on query failure', async () => {
    let closed = false;
    class FakeClient {
      async connect() {}
      async query() { throw new Error('synthetic failure'); }
      async end() { closed = true; }
    }
    await expect(verifyDatabase('postgresql://localhost/test', FakeClient)).rejects.toThrow();
    expect(closed).toBe(true);
  });
});
