import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_SECONDS, type AuthService } from './auth';

import { privateHeaders as headers, sessionToken as readSessionToken, csrfCheck as checkCsrf, jsonBody, authFailure } from './http-security';

export function createAuthHandlers(service: AuthService, production = process.env.NODE_ENV === 'production') {
  const sessionName = production ? '__Host-lp_session' : 'lp_session';
  const csrfName = production ? '__Host-lp_csrf' : 'lp_csrf';
  const options = { httpOnly: true, secure: production, sameSite: 'strict' as const, path: '/' };
  const sessionToken = (request: NextRequest) => readSessionToken(request, production);
  const csrfCheck = (request: NextRequest) => checkCsrf(request, production);
  function handle(action: (request: NextRequest) => Promise<NextResponse>) {
    return async (request: NextRequest) => {
      try { return await action(request); }
      catch (error) { return authFailure(error); }
    };
  }

  return {
    csrf: handle(async () => {
      const csrfToken = randomBytes(32).toString('base64url');
      const response = NextResponse.json({ csrfToken }, { headers });
      response.cookies.set(csrfName, csrfToken, { ...options, maxAge: SESSION_SECONDS });
      return response;
    }),
    login: handle(async request => {
      csrfCheck(request);
      const result = await service.login(await jsonBody(request), sessionToken(request));
      const response = NextResponse.json({ user: result.user }, { headers });
      response.cookies.set(sessionName, result.token, { ...options, maxAge: SESSION_SECONDS });
      // Rotate CSRF state at the authentication boundary.
      response.cookies.set(csrfName, '', { ...options, maxAge: 0 });
      return response;
    }),
    logout: handle(async request => {
      csrfCheck(request);
      await service.logout(sessionToken(request));
      const response = new NextResponse(null, { status: 204, headers });
      response.cookies.set(sessionName, '', { ...options, maxAge: 0 });
      response.cookies.set(csrfName, '', { ...options, maxAge: 0 });
      return response;
    }),
    session: handle(async request => {
      const user = await service.requireAccess(sessionToken(request));
      return NextResponse.json({ user }, { headers });
    }),
    admin: handle(async request => {
      // This endpoint proves backend authorization without implementing E2–E5.
      await service.requireAccess(sessionToken(request), 'write');
      return NextResponse.json({ message: 'Permiso de administración verificado en el servidor.' }, { headers });
    }),
  };
}
