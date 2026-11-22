import { Client } from 'pg';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runtime only: never print the input URL or raw driver errors.
export function connectionOptions(raw) {
  if (!raw || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error('Missing connection or insecure TLS runtime');
  }
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('Invalid PostgreSQL connection');
  }
  // pg URL SSL options can replace the explicit ssl object: remove overrides.
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('ssl') || key === 'uselibpqcompat') url.searchParams.delete(key);
  }
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: url.hostname },
    enableChannelBinding: true,
    connectionTimeoutMillis: 8000,
    query_timeout: 8000,
  };
}

export async function verifyDatabase(raw, ClientType = Client) {
  const client = new ClientType(connectionOptions(raw));
  try {
    await client.connect();
    const result = await client.query('SELECT 1');
    if (result.rows[0]?.['?column?'] !== 1) throw new Error('Unexpected result');
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await verifyDatabase(process.env.DATABASE_URL);
    console.log('PASS: Node -> PostgreSQL; TLS verified; SELECT 1 successful.');
  } catch {
    console.error('FAIL: connection verification. Check local environment, TLS and connectivity. Details hidden.');
    process.exitCode = 1;
  }
}
