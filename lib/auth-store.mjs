import { Pool } from 'pg';
import { connectionOptions } from '../scripts/check-db.mjs';
import { dummyPasswordHash, verifyPassword } from './password.mjs';

let pool;
// No connection or environment loading at import/build time.
export function getAuthPool() {
  if (!pool) {
    pool = new Pool({ ...connectionOptions(process.env.DATABASE_URL), max: 5, idleTimeoutMillis: 10000 });
    pool.on('error', ignorePoolError);
  }
  return pool;
}

function ignorePoolError() {
  // Raw database errors may contain connection details; never log them.
}

// Injection permits offline tests of SQL and transaction behavior.
export function createAuthStore(getPool = getAuthPool, verify = verifyPassword) {
  return {
    async authenticate(email, password) {
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `SELECT id, email, role, active, password_hash, locked_until,
                  locked_until > CURRENT_TIMESTAMP AS locked
             FROM users WHERE email = $1 FOR UPDATE`, [email],
        );
        const user = result.rows[0];
        const valid = await verify(password, user?.password_hash ?? dummyPasswordHash);
        if (!user || !user.active || user.locked) {
          await client.query('COMMIT');
          return null;
        }
        if (!valid) {
          // Lock account for 15 minutes after five consecutive failures.
          await client.query(
            `UPDATE users SET
               failed_login_attempts = CASE WHEN locked_until <= CURRENT_TIMESTAMP THEN 1 ELSE failed_login_attempts + 1 END,
               locked_until = CASE
                 WHEN locked_until <= CURRENT_TIMESTAMP THEN NULL
                 WHEN failed_login_attempts + 1 >= 5 THEN CURRENT_TIMESTAMP + interval '15 minutes'
                 ELSE NULL END
             WHERE id = $1`, [user.id],
          );
          await client.query('COMMIT');
          return null;
        }
        await client.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
        await client.query('COMMIT');
        return { id: user.id, email: user.email, role: user.role };
      } catch {
        await client.query('ROLLBACK');
        throw new Error('Authentication storage unavailable');
      } finally {
        client.release();
      }
    },
    async createSession(userId, tokenHash, expiresAt, previousHash) {
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        if (previousHash) {
          await client.query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1 AND revoked_at IS NULL', [previousHash]);
        }
        await client.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]);
        await client.query('COMMIT');
      } catch {
        await client.query('ROLLBACK');
        throw new Error('Session storage unavailable');
      } finally {
        client.release();
      }
    },
    async findSession(tokenHash, now) {
      const result = await getPool().query(
        `SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2 AND u.active = true`,
        [tokenHash, now],
      );
      return result.rows[0] ?? null;
    },
    async revokeSession(tokenHash) {
      await getPool().query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);
    },
  };
}

export const authStore = createAuthStore();
