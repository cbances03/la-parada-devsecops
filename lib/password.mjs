import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt: 32 MiB, r=8, p=3; salts are unique per password.
const prefix = 'scrypt$32768$8$3$';
export const dummyPasswordHash = `${prefix}${'0'.repeat(32)}$${'0'.repeat(128)}`;

function derive(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  }
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `${prefix}${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128 || typeof encoded !== 'string') return false;
  if (!/^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(encoded)) return false;
  const parts = encoded.split('$');
  const actual = await derive(password, parts[4]);
  return timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
}
