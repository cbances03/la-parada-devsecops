'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from '../lib/auth';
import { requirementLabels, statusLabels, statuses, type Merchant, type Stall, type Dossier, type Indicators, type DossierFilter } from '../lib/market';
import { EmptyState, Icon } from './ui';

export type MarketView = 'overview' | 'merchants' | 'stalls' | 'dossiers';

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

export default function MarketPanel({ user, onSessionExpired, activeModule, onNavigate }: { user: User; onSessionExpired: () => void; activeModule: MarketView; onNavigate: (view: MarketView) => void }) {
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
      <div className="panel-toolbar"><span><span className="connection-dot" />Información del mercado</span>
        {!loading && <button className="button button-secondary button-small" disabled={busy} onClick={() => { setError(''); void load().catch(report); }}><Icon name="refresh" size={16} />Actualizar datos</button>}
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {(loading || message) && <p className={`notice ${loading ? 'notice-info' : 'notice-success'}`} role="status"><Icon name={loading ? 'clock' : 'check'} />{loading ? 'Cargando registros…' : message}</p>}

      <section hidden={activeModule !== 'overview'} aria-labelledby="indicators-title" className="overview-section">
        <div className="section-heading"><div><h2 id="indicators-title">El mercado, de un vistazo</h2><p>Consulta el estado de los expedientes y sus pendientes de cierre.</p></div><span className="subtle-tag">Seguimiento general</span></div>
        {indicators ? <dl className="indicators">
          <div className="metric-total"><dt><span className="metric-icon"><Icon name="file" /></span>Total expedientes</dt><dd>{indicators.total}</dd><span className="metric-note">Registros en seguimiento</span></div>
          {statuses.map(status => <div key={status} className={`metric-${status}`}><dt><span className="metric-icon"><Icon name={status === 'completo' ? 'check' : status === 'en_revision' ? 'search' : 'clock'} /></span>{statusLabels[status]}</dt><dd>{indicators[status]}</dd><span className="metric-note">{status === 'completo' ? 'Requisitos cumplidos' : status === 'en_revision' ? 'En proceso de revisión' : 'Por atender'}</span></div>)}
          <div className="metric-open"><dt><span className="metric-icon"><Icon name="overview" /></span>Pendientes de cierre</dt><dd>{indicators.pendientes}</dd><span className="metric-note">Pendientes y en revisión</span></div>
        </dl> : !loading && <EmptyState title="Sin indicadores disponibles" detail="Actualiza los datos para consultar el seguimiento del mercado." />}
        <div className="overview-grid">
          <div className="surface-card progress-card"><div className="card-title"><span className="soft-icon"><Icon name="overview" /></span><h3>Avance de expedientes</h3></div>
            {indicators && indicators.total > 0 ? <><div className="progress-heading"><strong>{Math.round(indicators.completo / indicators.total * 100)}<span>%</span></strong><span>de expedientes completos</span></div><progress max={indicators.total} value={indicators.completo} aria-label="Proporción de expedientes completos" /><p>{indicators.completo} de {indicators.total} expedientes tienen los requisitos cumplidos.</p></> : <div className="progress-empty"><Icon name="file" size={32} /><p>El avance se mostrará cuando existan expedientes registrados.</p></div>}
          </div>
          <div className="workspace-welcome"><span className="welcome-icon"><Icon name="market" size={30} /></span><p className="eyebrow">CADA REGISTRO CUENTA</p><h3>Un paso más hacia<br />un mercado organizado.</h3><p>{admin ? 'Mantén actualizado el padrón, organiza los puestos y acompaña cada expediente.' : 'Consulta los expedientes y encuentra los pendientes que necesitan atención.'}</p><button className="button button-primary" onClick={() => onNavigate('dossiers')}>Ver expedientes<Icon name="arrow" size={17} /></button></div>
        </div>
      </section>

      {admin && <>
        <section hidden={activeModule !== 'merchants'} aria-labelledby="merchants-title">
          <div className="section-heading"><div><h2 id="merchants-title">Padrón de comerciantes</h2><p>Registra y encuentra a las personas que dan vida al mercado.</p></div><span className="subtle-tag">Gestión administrativa</span></div>
          <div className="module-grid"><form className="surface-card registration-form" onSubmit={event => { void submit(event, '/api/merchants'); }}>
            <fieldset disabled={busy || loading}>
              <legend><Icon name="users" />Nuevo comerciante</legend>
              <label htmlFor="merchant-dni">DNI (ocho dígitos)</label>
              <input id="merchant-dni" name="dni" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required />
              <label htmlFor="merchant-name">Nombre completo</label>
              <input id="merchant-name" name="name" minLength={2} maxLength={120} required />
              <label htmlFor="merchant-trade">Rubro</label>
              <input id="merchant-trade" name="trade" minLength={2} maxLength={80} required />
              <button className="button button-primary button-block" type="submit">Registrar comerciante<Icon name="arrow" size={17} /></button>
            </fieldset>
          </form>
          <div className="surface-card list-card"><form className="search-form" onSubmit={event => { event.preventDefault(); setAppliedSearch(search); }}>
            <label htmlFor="merchant-search">Buscar por nombre o DNI</label>
            <input id="merchant-search" value={search} onChange={event => setSearch(event.target.value)} maxLength={80} />
            <div className="actions"><button className="button button-primary" disabled={busy || loading}><Icon name="search" size={16} />Buscar</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => { setSearch(''); setAppliedSearch(''); }}>Ver todos</button></div>
          </form>
          <div className="table-scroll"><table><caption>Comerciantes registrados</caption><thead><tr><th>DNI</th><th>Nombre</th><th>Rubro</th><th>Puesto</th></tr></thead>
            <tbody>{merchants.map(merchant => <tr key={merchant.id}><td className="mono-value">{merchant.dni}</td><td className="table-name">{merchant.name}</td><td>{merchant.trade}</td><td><span className={`status-badge ${merchant.stall_code ? 'status-completo' : 'status-pendiente'}`}>{merchant.stall_code ?? 'Sin asignar'}</span></td></tr>)}</tbody>
          </table></div>
          {!loading && !merchants.length && <EmptyState title={error ? 'Sin datos disponibles' : appliedSearch ? 'No encontramos coincidencias' : 'El padrón empieza aquí'} detail={error ? 'Reintenta la carga con «Actualizar datos».' : appliedSearch ? 'Prueba con otro nombre o DNI, o selecciona «Ver todos».' : 'Registra al primer comerciante con el formulario.'} />}
          </div></div>
        </section>

        <section hidden={activeModule !== 'stalls'} aria-labelledby="stalls-title">
          <div className="section-heading"><div><h2 id="stalls-title">Espacios con identidad</h2><p>Registra los puestos y vincula cada espacio con su comerciante.</p></div><span className="subtle-tag">Asignaciones sin duplicidades</span></div>
          <div className="form-grid">
            <form className="surface-card" onSubmit={event => { void submit(event, '/api/stalls'); }}><fieldset disabled={busy || loading}>
              <legend><Icon name="stall" />Nuevo puesto</legend>
              <label htmlFor="stall-code">Código único</label><input id="stall-code" name="code" maxLength={20} required />
              <label htmlFor="stall-sector">Sector</label><input id="stall-sector" name="sector" minLength={2} maxLength={80} required />
              <button className="button button-primary">Registrar puesto<Icon name="arrow" size={17} /></button>
            </fieldset></form>
            <form className="surface-card" onSubmit={event => { void submit(event, '/api/stalls/assign'); }}><fieldset disabled={busy || loading}>
              <legend><Icon name="users" />Asignar a un comerciante</legend>
              <label htmlFor="assignment-merchant">Comerciante sin puesto</label>
              <select id="assignment-merchant" name="merchantId" defaultValue="" required><option value="" disabled>Seleccionar</option>{merchants.filter(m => !m.stall_code).map(m => <option key={m.id} value={m.id}>{m.name} — {m.dni}</option>)}</select>
              <label htmlFor="assignment-stall">Puesto disponible</label>
              <select id="assignment-stall" name="stallId" defaultValue="" required><option value="" disabled>Seleccionar</option>{stalls.filter(s => !s.merchant_id).map(s => <option key={s.id} value={s.id}>{s.code} — {s.sector}</option>)}</select>
              <p className="field-help">Un puesto por comerciante. Usa «Ver todos» en Comerciantes si su filtro oculta opciones.</p>
              <button className="button button-primary">Asignar puesto<Icon name="arrow" size={17} /></button>
            </fieldset></form>
          </div>
          <div className="surface-card list-card"><div className="table-scroll"><table><caption>Puestos del mercado</caption><thead><tr><th>Código</th><th>Sector</th><th>Comerciante</th><th>Ocupación</th></tr></thead><tbody>{stalls.map(stall => <tr key={stall.id}><td className="table-name">{stall.code}</td><td>{stall.sector}</td><td>{stall.merchant_name ?? 'Sin asignar'}</td><td><span className={`status-badge ${stall.merchant_id ? 'status-en_revision' : 'status-completo'}`}>{stall.merchant_id ? 'Asignado' : 'Disponible'}</span></td></tr>)}</tbody></table></div>
          {!loading && !stalls.length && <EmptyState title={error ? 'Sin datos disponibles' : 'Un espacio para cada comerciante'} detail={error ? 'Reintenta la carga con «Actualizar datos».' : 'Registra el primer puesto para comenzar a organizar el mercado.'} />}</div>
        </section>
      </>}

      <section hidden={activeModule !== 'dossiers'} aria-labelledby="dossiers-title">
        <div className="section-heading"><div><h2 id="dossiers-title">Cada expediente, un avance</h2><p>Consulta requisitos y acompaña el proceso de formalización.</p></div><span className="subtle-tag">{admin ? 'Gestión de expedientes' : 'Acceso de solo lectura'}</span></div>
        <div className="surface-card filter-card">
        <label htmlFor="dossier-filter">Filtrar por estado</label>
        <select id="dossier-filter" value={filter} disabled={busy || loading} onChange={event => setFilter(event.target.value as DossierFilter)}>
          <option value="todos">Todos</option><option value="pendientes">Pendientes de cierre (incluye en revisión)</option>
          {statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select>
        {!admin && <p className="field-help"><Icon name="shield" size={15} />Consulta de solo lectura. Las modificaciones requieren rol administrador.</p>}
        </div>
        <div className="dossier-grid">{dossiers.map(dossier => <article key={dossier.id} className="surface-card dossier-card">
          <div className="dossier-header"><span className="dossier-avatar"><Icon name="file" size={22} /></span><div><h3>{dossier.name}</h3><p>DNI {dossier.dni}</p></div><span className={`status-badge status-${dossier.status}`}>{statusLabels[dossier.status]}</span></div>
          <p className="checklist-summary">{dossier.requirements.filter(r => r.fulfilled).length} de {dossier.requirements.length} requisitos cumplidos</p>
          <fieldset disabled={!admin || busy || loading || dossier.status === 'completo'}>
            <legend className="sr-only">Requisitos de seguimiento</legend>
            {dossier.requirements.map(requirement => <label className="check-label" key={requirement.code}>
              <input type="checkbox" checked={requirement.fulfilled} onChange={event => { void save('/api/dossiers/requirements', { dossierId: dossier.id, code: requirement.code, fulfilled: event.target.checked }, 'PATCH'); }} />
              {requirementLabels[requirement.code]}
            </label>)}
          </fieldset>
          {admin && <form className="dossier-state-form" onSubmit={event => {
            event.preventDefault();
            const status = new FormData(event.currentTarget).get('status');
            void save('/api/dossiers/status', { dossierId: dossier.id, status }, 'PATCH');
          }}>
            <label htmlFor={`status-${dossier.id}`}>Actualizar estado</label>
            <select key={dossier.status} id={`status-${dossier.id}`} name="status" defaultValue={dossier.status} disabled={busy}>
              {statuses.map(status => <option key={status} value={status} disabled={status === 'completo' && !dossier.requirements.every(r => r.fulfilled)}>{statusLabels[status]}</option>)}
            </select><button className="button button-secondary button-block" disabled={busy}>Guardar estado<Icon name="check" size={17} /></button>
            <p className="field-help">Completa los tres requisitos para cerrar. Reabre el expediente antes de quitar un requisito.</p>
          </form>}
        </article>)}</div>
        {!loading && !dossiers.length && <div className="surface-card"><EmptyState title={error ? 'Sin datos disponibles' : 'Sin expedientes para este filtro'} detail={error ? 'Reintenta la carga con «Actualizar datos».' : 'Selecciona otro estado. Los expedientes se crean al registrar comerciantes.'} /></div>}
      </section>
      <p className="workspace-disclaimer"><Icon name="shield" size={15} />Seguimiento administrativo académico. Los requisitos no sustituyen trámites ni autorizaciones municipales.</p>
    </div>
  );
}
