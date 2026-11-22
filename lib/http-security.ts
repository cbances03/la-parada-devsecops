import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AuthError, validToken } from './auth';

export const privateHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Cookie' };

export function sessionToken(request: NextRequest, production = process.env.NODE_ENV === 'production') {
  return request.cookies.get(production ? '__Host-lp_session' : 'lp_session')?.value;
}

export function csrfCheck(request: NextRequest, production = process.env.NODE_ENV === 'production') {
  const site = request.headers.get('sec-fetch-site');
  if (request.headers.get('origin') !== new URL(request.url).origin || (site && site !== 'same-origin')) {
    throw new AuthError(403, 'Origen de la solicitud no permitido.');
  }
  const cookie = request.cookies.get(production ? '__Host-lp_csrf' : 'lp_csrf')?.value;
  const header = request.headers.get('x-csrf-token');
  if (!validToken(cookie) || !validToken(header) || !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    throw new AuthError(403, 'Token CSRF inválido. Recarga e inténtalo nuevamente.');
  }
}

export async function jsonBody(request: NextRequest) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new AuthError(415, 'Se requiere JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError(400, 'Solicitud inválida.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) {
      await reader.cancel();
      throw new AuthError(413, 'Solicitud demasiado grande.');
    }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new AuthError(400, 'Solicitud inválida.'); }
}

export function authFailure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof AuthError ? error.message : 'Servicio temporalmente no disponible.' },
    { status: error instanceof AuthError ? error.status : 503, headers: privateHeaders },
  );
}
