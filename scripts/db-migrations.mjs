// Manual external-CMD tool. Default inspect is read-only; apply is explicit.
// No credentials or business rows are printed. No automatic baseline or repair.
import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectionOptions } from './check-db.mjs';

export const migrations = {
  '001': { file: '../migrations/001_access_security.sql', tables: ['users', 'sessions'] },
  '002': { file: '../migrations/002_market_management.sql', tables: ['merchants', 'stalls', 'dossiers', 'dossier_requirements'] },
};

export function migrationState(names, id) {
  const present = migrations[id].tables.filter(name => names.includes(name));
  return present.length === 0 ? 'AUSENTE' : present.length === migrations[id].tables.length ? 'OBJETOS_PRESENTES_REVISAR' : 'PARCIAL_BLOQUEADA';
}

export function assertPending(names, id) {
  if (!Object.hasOwn(migrations, id)) throw new Error('Migración desconocida.');
  if (migrationState(names, id) !== 'AUSENTE') throw new Error('Ya hay objetos de esta migración. No se reaplica ni repara automáticamente.');
  if (id === '002' && migrationState(names, '001') !== 'OBJETOS_PRESENTES_REVISAR') {
    throw new Error('Primero aplica o revisa 001.');
  }
}

async function relations(client) {
  const schema = await client.query('SELECT current_schema() AS schema');
  if (schema.rows[0]?.schema !== 'public') throw new Error('El esquema activo no es public. Revisa el destino antes de continuar.');
  const result = await client.query(
    `SELECT c.relname AS name, c.relkind AS kind FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' ORDER BY c.relname`,
  );
  return result.rows;
}

export async function inspectDatabase(client) {
  await client.query('BEGIN READ ONLY');
  try {
    const objects = await relations(client);
    const names = objects.map(row => row.name);
    const expected = Object.values(migrations).flatMap(m => m.tables);
    console.table(objects.filter(row => ['r', 'p', 'v', 'm', 'f'].includes(row.kind)));
    console.table(Object.keys(migrations).map(id => ({ migration: id, state: migrationState(names, id) })));
    const columns = await client.query(
      `SELECT table_name, column_name, data_type, is_nullable,
              column_default IS NOT NULL AS has_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position`, [expected],
    );
    console.table(columns.rows);
    const constraints = await client.query(
      `SELECT c.relname AS table_name, con.conname AS name, con.contype AS type,
              CASE WHEN con.contype IN ('p','u','f') THEN pg_get_constraintdef(con.oid)
                   ELSE 'CHECK: revisar contra SQL versionado; no se imprimen expresiones' END AS definition
         FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) ORDER BY c.relname, con.conname`, [expected],
    );
    console.table(constraints.rows);
    const indexes = await client.query(
      `SELECT tablename, indexname FROM pg_catalog.pg_indexes
        WHERE schemaname = 'public' AND tablename = ANY($1::text[]) ORDER BY tablename, indexname`, [expected],
    );
    console.table(indexes.rows);
    console.log('Presencia de objetos NO acredita una migración aplicada ni un esquema compatible. Si ya existen, comparar con el SQL; nunca reaplicar por defecto.');
  } finally { await client.query('ROLLBACK'); }
}

export async function applyMigration(client, id) {
  if (!Object.hasOwn(migrations, id)) throw new Error('Migración desconocida.');
  const sql = await readFile(new URL(migrations[id].file, import.meta.url), 'utf8');
  // The runner owns the transaction so inventory and DDL share the same lock.
  const body = sql.replace(/^\s*--[^\n]*\n/, '').replace(/^\s*BEGIN\s*;/i, '').replace(/COMMIT\s*;\s*$/i, '');
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL lock_timeout = \'5s\'');
    await client.query('SET LOCAL statement_timeout = \'15s\'');
    await client.query('SELECT pg_advisory_xact_lock(20261121, 2)');
    const objects = await relations(client);
    assertPending(objects.map(row => row.name), id);
    if (id === '002' && migrations['001'].tables.some(name => !objects.some(row => row.name === name && ['r', 'p'].includes(row.kind)))) {
      throw new Error('001 no tiene tablas válidas. Revisa el esquema.');
    }
    await client.query(body);
    await client.query('COMMIT');
    console.log(`PASS: migración ${id} confirmada. No se modificaron datos de tablas existentes.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode = 'inspect', id] = process.argv.slice(2);
  if (!['inspect', 'apply'].includes(mode) || (mode === 'apply' && !Object.hasOwn(migrations, id ?? '')) || (mode === 'inspect' && id)) {
    console.error('Uso: node --env-file=.env.local scripts/db-migrations.mjs inspect | apply 001 | apply 002');
    process.exitCode = 1;
  } else {
    let client;
    try {
      client = new Client(connectionOptions(process.env.DATABASE_URL));
      await client.connect();
      if (mode === 'inspect') await inspectDatabase(client);
      else await applyMigration(client, id);
    } catch {
      console.error('FAIL: operación no confirmada. Revisa esquema, permisos, objetos existentes y conexión TLS. No compartas credenciales ni errores sin sanear.');
      process.exitCode = 1;
    } finally { if (client) await client.end().catch(() => {}); }
  }
}
