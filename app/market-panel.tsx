'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from '../lib/auth';
import { requirementLabels, statusLabels, statuses, type Merchant, type Stall, type Dossier, type Indicators, type DossierFilter } from '../lib/market';

// Runtime-only API access; never place credentials or session tokens in JS storage.
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const csrf = await fetch('/api/auth/csrf', { cache: 'no-store' });
    if (!csrf.ok) throw new Error('No se pudo preparar la solicitud segura.');
    headers['X-CSRF-Token'] = (await csrf.json()).csrfToken;
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  const result = await response.json();
  if (response.status === 401) throw new Error('SESSION_EXPIRED');
  if (!response.ok) throw new Error(result.error ?? 'No se pudo completar la operación.');
  return result.data as T;
}

export default function MarketPanel({ user, onSessionExpired }: { user: User; onSessionExpired: () => void }) {
  const admin = user.role === 'administrador';
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filter, setFilter] = useState<DossierFilter>('todos');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const report = useCallback((failure: unknown) => {
    if (failure instanceof Error && failure.message === 'SESSION_EXPIRED') { onSessionExpired(); return; }
    setError(failure instanceof Error && failure.message !== 'Failed to fetch' ? failure.message : 'No se pudo comunicar con el servidor.');
  }, [onSessionExpired]);

  const load = useCallback(async () => {
    const [nextDossiers, nextIndicators, nextMerchants, nextStalls] = await Promise.all([
      request<Dossier[]>(`/api/dossiers?status=${encodeURIComponent(filter)}`),
      request<Indicators>('/api/indicators'),
      admin ? request<Merchant[]>(`/api/merchants?q=${encodeURIComponent(appliedSearch)}`) : Promise.resolve([]),
      admin ? request<Stall[]>('/api/stalls') : Promise.resolve([]),
    ]);
    setDossiers(nextDossiers); setIndicators(nextIndicators); setMerchants(nextMerchants); setStalls(nextStalls);
  }, [admin, filter, appliedSearch]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try { await load(); }
      catch (failure) { if (active) report(failure); }
      finally { if (active) setLoading(false); }
    }
    void refresh();
    return () => { active = false; };
  }, [load, report]);

  async function save(path: string, body: unknown, method = 'POST') {
    setBusy(true); setError(''); setMessage('');
    try {
      await request(path, method, body);
      setMessage('Cambio guardado.');
      // A refresh failure must not suggest the successful write was rolled back.
      try { await load(); }
      catch { setError('El cambio se guardó, pero no se pudo actualizar la vista. Recarga la página.'); }
      return true;
    } catch (failure) { report(failure); return false; }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await save(path, Object.fromEntries(new FormData(form)))) form.reset();
  }

  return (
    <div className="market-panel" aria-busy={busy || loading}>
      <h2>Gestión del mercado</h2>
      <p>Seguimiento administrativo de demostración. Los requisitos son una propuesta académica y no sustituyen trámites ni autorizaciones municipales.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <p role="status">{loading ? 'Cargando registros…' : message}</p>
      {!loading && <button disabled={busy} onClick={() => { setError(''); void load().catch(report); }}>Actualizar datos</button>}

      <section aria-labelledby="indicators-title">
        <h2 id="indicators-title">Indicadores de seguimiento</h2>
        {indicators ? <dl className="indicators">
          <div><dt>Total expedientes</dt><dd>{indicators.total}</dd></div>
          {statuses.map(status => <div key={status}><dt>{statusLabels[status]}</dt><dd>{indicators[status]}</dd></div>)}
          <div><dt>Pendientes de cierre</dt><dd>{indicators.pendientes}</dd></div>
        </dl> : <p>Sin datos disponibles.</p>}
      </section>

      {admin && <>
        <section aria-labelledby="merchants-title">
          <h2 id="merchants-title">Padrón de comerciantes</h2>
          <form onSubmit={event => { void submit(event, '/api/merchants'); }}>
            <fieldset disabled={busy || loading}>
              <legend>Registrar comerciante</legend>
              <label htmlFor="merchant-dni">DNI (ocho dígitos)</label>
              <input id="merchant-dni" name="dni" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required />
              <label htmlFor="merchant-name">Nombre completo</label>
              <input id="merchant-name" name="name" minLength={2} maxLength={120} required />
              <label htmlFor="merchant-trade">Rubro</label>
              <input id="merchant-trade" name="trade" minLength={2} maxLength={80} required />
              <button type="submit">Registrar comerciante</button>
            </fieldset>
          </form>
          <form onSubmit={event => { event.preventDefault(); setAppliedSearch(search); }}>
            <label htmlFor="merchant-search">Buscar por nombre o DNI</label>
            <input id="merchant-search" value={search} onChange={event => setSearch(event.target.value)} maxLength={80} />
            <div className="actions"><button disabled={busy || loading}>Buscar</button><button type="button" disabled={busy} onClick={() => { setSearch(''); setAppliedSearch(''); }}>Ver todos</button></div>
          </form>
          <div className="table-scroll"><table><caption>Comerciantes registrados</caption><thead><tr><th>DNI</th><th>Nombre</th><th>Rubro</th><th>Puesto</th></tr></thead>
            <tbody>{merchants.map(merchant => <tr key={merchant.id}><td>{merchant.dni}</td><td>{merchant.name}</td><td>{merchant.trade}</td><td>{merchant.stall_code ?? 'Sin asignar'}</td></tr>)}</tbody>
          </table></div>
          {!loading && !merchants.length && <p>No hay comerciantes para esta búsqueda.</p>}
        </section>

        <section aria-labelledby="stalls-title">
          <h2 id="stalls-title">Gestión de puestos</h2>
          <div className="form-grid">
            <form onSubmit={event => { void submit(event, '/api/stalls'); }}><fieldset disabled={busy || loading}>
              <legend>Registrar puesto</legend>
              <label htmlFor="stall-code">Código único</label><input id="stall-code" name="code" maxLength={20} required />
              <label htmlFor="stall-sector">Sector</label><input id="stall-sector" name="sector" minLength={2} maxLength={80} required />
              <button>Registrar puesto</button>
            </fieldset></form>
            <form onSubmit={event => { void submit(event, '/api/stalls/assign'); }}><fieldset disabled={busy || loading}>
              <legend>Asignar puesto</legend>
              <label htmlFor="assignment-merchant">Comerciante sin puesto</label>
              <select id="assignment-merchant" name="merchantId" defaultValue="" required><option value="" disabled>Seleccionar</option>{merchants.filter(m => !m.stall_code).map(m => <option key={m.id} value={m.id}>{m.name} — {m.dni}</option>)}</select>
              <label htmlFor="assignment-stall">Puesto disponible</label>
              <select id="assignment-stall" name="stallId" defaultValue="" required><option value="" disabled>Seleccionar</option>{stalls.filter(s => !s.merchant_id).map(s => <option key={s.id} value={s.id}>{s.code} — {s.sector}</option>)}</select>
              <p>Un puesto por comerciante. Usa «Ver todos» si el filtro del padrón oculta opciones.</p>
              <button>Asignar puesto</button>
            </fieldset></form>
          </div>
          <ul className="record-list">{stalls.map(stall => <li key={stall.id}><strong>{stall.code}</strong> · {stall.sector} · {stall.merchant_name ?? 'Disponible'}</li>)}</ul>
          {!loading && !stalls.length && <p>No hay puestos registrados.</p>}
        </section>
      </>}

      <section aria-labelledby="dossiers-title">
        <h2 id="dossiers-title">Expedientes de formalización</h2>
        <label htmlFor="dossier-filter">Filtrar por estado</label>
        <select id="dossier-filter" value={filter} disabled={busy || loading} onChange={event => setFilter(event.target.value as DossierFilter)}>
          <option value="todos">Todos</option><option value="pendientes">Pendientes de cierre (incluye en revisión)</option>
          {statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
        {!admin && <p>Consulta de solo lectura. Las modificaciones requieren rol administrador.</p>}
        {dossiers.map(dossier => <article key={dossier.id}>
          <h3>{dossier.name} · DNI {dossier.dni}</h3>
          <p>Estado: <strong>{statusLabels[dossier.status]}</strong></p>
          <fieldset disabled={!admin || busy || loading || dossier.status === 'completo'}>
            <legend>Requisitos de seguimiento</legend>
            {dossier.requirements.map(requirement => <label className="check-label" key={requirement.code}>
              <input type="checkbox" checked={requirement.fulfilled} onChange={event => { void save('/api/dossiers/requirements', { dossierId: dossier.id, code: requirement.code, fulfilled: event.target.checked }, 'PATCH'); }} />
              {requirementLabels[requirement.code]}
            </label>)}
          </fieldset>
          {admin && <form onSubmit={event => {
            event.preventDefault();
            const status = new FormData(event.currentTarget).get('status');
            void save('/api/dossiers/status', { dossierId: dossier.id, status }, 'PATCH');
          }}>
            <label htmlFor={`status-${dossier.id}`}>Actualizar estado</label>
            <select key={dossier.status} id={`status-${dossier.id}`} name="status" defaultValue={dossier.status} disabled={busy}>
              {statuses.map(status => <option key={status} value={status} disabled={status === 'completo' && !dossier.requirements.every(r => r.fulfilled)}>{statusLabels[status]}</option>)}
            </select><button disabled={busy}>Guardar estado</button>
            <p>Completa los tres requisitos para cerrar. Reabre el expediente antes de quitar un requisito.</p>
          </form>}
        </article>)}
        {!loading && !dossiers.length && <p>No hay expedientes para este filtro.</p>}
      </section>
    </div>
  );
}
