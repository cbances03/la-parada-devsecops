import { NextRequest, NextResponse } from 'next/server';
import { AuthError, type AuthService, type Access } from './auth';
import { MarketError } from './market-errors.mjs';
import { csrfCheck, jsonBody, privateHeaders, sessionToken } from './http-security';
import { merchantInput, merchantSearch, stallInput, assignmentInput, requirementInput, statusInput, dossierFilter, type MarketStore } from './market';

export function createMarketHandlers(auth: AuthService, store: MarketStore, production = process.env.NODE_ENV === 'production') {
  function endpoint(access: Access, mutate: boolean, action: (req: NextRequest) => Promise<unknown>) {
    return async (request: NextRequest) => {
      try {
        await auth.requireAccess(sessionToken(request, production), access);
        if (mutate) csrfCheck(request, production);
        const data = await action(request);
        return NextResponse.json({ data }, { status: request.method === 'POST' && !request.url.endsWith('/assign') ? 201 : 200, headers: privateHeaders });
      } catch (error) {
        let status = 503;
        let message = 'Servicio temporalmente no disponible.';
        if (error instanceof AuthError || error instanceof MarketError) {
          status = error.status; message = error.message;
        } else if (error && typeof error === 'object' && 'code' in error) {
          if (error.code === '23505') { status = 409; message = 'Ya existe ese DNI, código o asignación de comerciante.'; }
          if (error.code === '23503') { status = 400; message = 'El registro relacionado no existe.'; }
        }
        return NextResponse.json({ error: message }, { status, headers: privateHeaders });
      }
    };
  }
  return {
    merchants: endpoint('write', false, req => store.listMerchants(merchantSearch(req.nextUrl.searchParams.get('q')))),
    createMerchant: endpoint('write', true, async req => store.createMerchant(merchantInput(await jsonBody(req)))),
    stalls: endpoint('write', false, () => store.listStalls()),
    createStall: endpoint('write', true, async req => store.createStall(stallInput(await jsonBody(req)))),
    assignStall: endpoint('write', true, async req => store.assignStall(assignmentInput(await jsonBody(req)))),
    dossiers: endpoint('read', false, req => store.listDossiers(dossierFilter(req.nextUrl.searchParams.get('status')))),
    updateRequirement: endpoint('write', true, async req => store.updateRequirement(requirementInput(await jsonBody(req)))),
    updateStatus: endpoint('write', true, async req => store.updateStatus(statusInput(await jsonBody(req)))),
    indicators: endpoint('read', false, () => store.indicators()),
  };
}
