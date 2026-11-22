// Administrative provisioning only; no public registration endpoint.
// Run manually AFTER an authorized migration. Never pass passwords as arguments.
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hashPassword } from '../lib/password.mjs';
import { getAuthPool } from '../lib/auth-store.mjs';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Usa una terminal interactiva; no pases credenciales por argumentos ni archivos.');
  process.exitCode = 1;
} else {
  let muted = false;
  let database;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  try {
    const email = (await terminal.question('Correo del nuevo usuario: ')).trim().toLowerCase();
    const role = (await terminal.question('Rol (administrador/supervisor): ')).trim();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['administrador', 'supervisor'].includes(role)) {
      throw new Error('Invalid user');
    }
    process.stdout.write('Contraseña (12–128 caracteres; entrada oculta): ');
    muted = true;
    const password = await terminal.question('');
    process.stdout.write('\nConfirmar contraseña (entrada oculta): ');
    const confirmation = await terminal.question('');
    muted = false;
    process.stdout.write('\n');
    if (password !== confirmation) throw new Error('Passwords differ');
    const encoded = await hashPassword(password);
    database = getAuthPool();
    await database.query('INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)', [randomUUID(), email, encoded, role]);
    console.log('Usuario creado. No se mostraron contraseñas ni datos de conexión.');
  } catch {
    process.stderr.write('\nNo se creó el usuario. Revisa datos, duplicados, migración y conexión autorizada. Detalles ocultos.\n');
    process.exitCode = 1;
  } finally {
    muted = false;
    terminal.close();
    if (database) await database.end();
  }
}
