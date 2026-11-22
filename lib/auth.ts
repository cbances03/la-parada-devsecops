import { createHash, randomBytes } from 'node:crypto';

export type Role = 'administrador' | 'supervisor';
export type User = { id: string; email: string; role: Role };
export type Access = 'read' | 'write';
export const SESSION_SECONDS = 8 * 60 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export interface AuthStore {
  authenticate(email: string, password: string): Promise<User | null>;
  createSession(userId: string, tokenHash: string, expiresAt: Date, previousHash?: string): Promise<void>;
  findSession(tokenHash: string, now: Date): Promise<User | null>;
  revokeSession(tokenHash: string): Promise<void>;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function validToken(token: unknown): token is string {
  return typeof token === 'string' && tokenPattern.test(token);
}

export function createAuthService(store: AuthStore, clock = () => new Date()) {
  async function requireAccess(token: string | undefined, access: Access = 'read') {
    if (!validToken(token)) throw new AuthError(401, 'Inicia sesión para continuar.');
    const user = await store.findSession(hashToken(token), clock());
    if (!user || !['administrador', 'supervisor'].includes(user.role)) {
      throw new AuthError(401, 'La sesión no es válida o ha vencido.');
    }
    if (access === 'write' && user.role !== 'administrador') {
      throw new AuthError(403, 'No tienes permiso para realizar esta operación.');
    }
    return { id: user.id, email: user.email, role: user.role };
  }

  return {
    requireAccess,
    async login(input: unknown, previousToken?: string) {
      if (!input || typeof input !== 'object') throw new AuthError(400, 'Datos de acceso inválidos.');
      const { email, password } = input as Record<string, unknown>;
      if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          typeof password !== 'string' || !password.length || password.length > 128) {
        throw new AuthError(400, 'Ingresa un correo y una contraseña válidos.');
      }
      const user = await store.authenticate(email.trim().toLowerCase(), password);
      if (!user || !['administrador', 'supervisor'].includes(user.role)) {
        throw new AuthError(401, 'Credenciales inválidas o acceso temporalmente no disponible.');
      }
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(clock().getTime() + SESSION_SECONDS * 1000);
      await store.createSession(user.id, hashToken(token), expiresAt, validToken(previousToken) ? hashToken(previousToken) : undefined);
      return { token, user: { id: user.id, email: user.email, role: user.role } };
    },
    async logout(token: string | undefined) {
      if (validToken(token)) await store.revokeSession(hashToken(token));
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
