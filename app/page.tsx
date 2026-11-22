'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from '../lib/auth';
import MarketPanel, { type MarketView } from './market-panel';
import { Brand, Icon, type IconName } from './ui';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [publicView, setPublicView] = useState<'landing' | 'login'>('landing');
  const [activeModule, setActiveModule] = useState<MarketView>('overview');
  const [navOpen, setNavOpen] = useState(false);
  const expireSession = useCallback(() => {
    setUser(null);
    setPublicView('login');
    setError('La sesión ha vencido. Inicia sesión nuevamente.');
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!response.ok && response.status !== 401) throw new Error('Servicio temporalmente no disponible.');
        const data = response.ok ? await response.json() : null;
        if (active) setUser(data?.user ?? null);
      } catch {
        if (active) setError('No se pudo comprobar la sesión. Inténtalo nuevamente.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  async function mutate(action: 'login' | 'logout', body?: { email: string; password: string }) {
    const csrf = await fetch('/api/auth/csrf', { cache: 'no-store' });
    if (!csrf.ok) throw new Error('No se pudo preparar la solicitud segura.');
    const { csrfToken } = await csrf.json();
    return fetch(`/api/auth/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get('email') ?? '');
    const password = String(values.get('password') ?? '');
    form.reset();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await mutate('login', { email, password });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUser(data.user);
      setActiveModule('overview');
      setMessage('Sesión iniciada.');
    } catch (failure) {
      setError(failure instanceof Error && failure.message !== 'Failed to fetch' ? failure.message : 'No se pudo iniciar sesión.');
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await mutate('logout');
      if (!response.ok) throw new Error('No se pudo revocar la sesión. Inténtalo nuevamente.');
      setUser(null);
      setPublicView('login');
      setNavOpen(false);
      setMessage('Sesión cerrada y revocada.');
    } catch {
      setError('No se pudo cerrar la sesión. Inténtalo nuevamente.');
    } finally { setBusy(false); }
  }

  async function checkAdmin() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/auth/admin', { cache: 'no-store' });
      const data = await response.json();
      if (response.status === 401) setUser(null);
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
    } catch (failure) {
      setError(failure instanceof Error && failure.message !== 'Failed to fetch' ? failure.message : 'No se pudo verificar el permiso.');
    } finally { setBusy(false); }
  }

  function showLogin() {
    setPublicView('login');
    setNavOpen(false);
  }

  const navigation: { key: MarketView; label: string; icon: IconName; admin?: boolean }[] = [
    { key: 'overview', label: 'Resumen general', icon: 'overview' },
    { key: 'merchants', label: 'Comerciantes', icon: 'users', admin: true },
    { key: 'stalls', label: 'Puestos del mercado', icon: 'stall', admin: true },
    { key: 'dossiers', label: 'Expedientes', icon: 'file' },
  ];
  const moduleTitle = navigation.find(item => item.key === activeModule)?.label ?? 'Resumen general';

  if (user) return (
    <div className="app-shell" onKeyDown={event => { if (event.key === 'Escape') setNavOpen(false); }}>
      <a href="#workspace" className="skip-link">Saltar al contenido</a>
      {navOpen && <button className="sidebar-backdrop" aria-label="Cerrar navegación" onClick={() => setNavOpen(false)} />}
      <aside id="app-sidebar" className={`sidebar${navOpen ? ' is-open' : ''}`}>
        <div className="sidebar-brand"><Brand light onHome={() => { setActiveModule('overview'); setNavOpen(false); }} /><button className="icon-button mobile-only" aria-label="Cerrar navegación" onClick={() => setNavOpen(false)}><Icon name="close" /></button></div>
        <div className="sidebar-caption">ESPACIO DE TRABAJO</div>
        <nav aria-label="Módulos del sistema">
          {navigation.filter(item => !item.admin || user.role === 'administrador').map(item => <button
            key={item.key} className={`nav-item${activeModule === item.key ? ' active' : ''}`} aria-current={activeModule === item.key ? 'page' : undefined}
            onClick={() => { setActiveModule(item.key); setNavOpen(false); document.getElementById('workspace-title')?.focus(); }}
          ><Icon name={item.icon} /><span>{item.label}</span>{activeModule === item.key && <span className="nav-active-dot" />}</button>)}
        </nav>
        <div className="sidebar-note"><Icon name="shield" size={22} /><div><strong>Acceso por roles</strong><p>{user.role === 'administrador' ? 'Gestión y seguimiento del mercado.' : 'Consulta de expedientes e indicadores.'}</p></div></div>
        <div className="sidebar-account">
          <span className="avatar">{user.email.slice(0, 2).toUpperCase()}</span>
          <div className="account-details"><strong title={user.email}>{user.email}</strong><span>{user.role === 'administrador' ? 'Administrador' : 'Supervisor'}</span></div>
        </div>
        <button className="logout-button" disabled={busy} onClick={logout}><Icon name="logout" />{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
        <p className="sidebar-footer">Mercado La Parada · La Victoria</p>
      </aside>
      <div className="workspace">
        <header className="workspace-topbar">
          <div className="breadcrumb"><button className="icon-button mobile-only" aria-label="Abrir navegación" aria-controls="app-sidebar" aria-expanded={navOpen} onClick={() => setNavOpen(true)}><Icon name="menu" /></button><span>La Parada</span><span aria-hidden="true">/</span><strong>{moduleTitle}</strong></div>
          <span className="role-chip"><Icon name="shield" size={15} />{user.role === 'administrador' ? 'Administrador' : 'Solo lectura'}</span>
        </header>
        <main id="workspace" className="workspace-content">
          <div className="workspace-heading"><div><p className="eyebrow">GESTIÓN Y FORMALIZACIÓN</p><h1 id="workspace-title" tabIndex={-1}>{moduleTitle}</h1><p>Información organizada para acompañar el avance del mercado.</p></div>
            {user.role === 'administrador' && <button className="button button-secondary" disabled={busy} onClick={checkAdmin}><Icon name="shield" size={17} />Verificar acceso</button>}
          </div>
          {error && <div className="notice notice-error" role="alert"><Icon name="shield" /><span>{error}</span></div>}
          {message && <p className="notice notice-success" role="status"><Icon name="check" />{message}</p>}
          <MarketPanel key={user.id} user={user} onSessionExpired={expireSession} activeModule={activeModule} onNavigate={setActiveModule} />
        </main>
      </div>
    </div>
  );

  return (
    <div className={`public-site${publicView === 'login' ? ' login-site' : ''}`}>
      <a href="#public-content" className="skip-link">Saltar al contenido</a>
      <header className="public-header"><Brand onHome={() => setPublicView('landing')} />
        {publicView === 'landing' ? <nav aria-label="Navegación principal"><a className="public-nav-link" href="#beneficios">El sistema</a><a className="public-nav-link" href="#como-funciona">Cómo funciona</a><button className="button button-primary" onClick={showLogin} disabled={loading}>Ingresar al sistema<Icon name="arrow" size={17} /></button></nav>
          : <button className="button button-quiet" onClick={() => setPublicView('landing')}>Volver al inicio<Icon name="arrow" size={17} /></button>}
      </header>
      <main id="public-content">
        {publicView === 'landing' ? <>
          <section className="hero">
            <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" />MERCADO LA PARADA · LA VICTORIA</p><h1>Un mercado más<br /><span>organizado.</span><br />Un mejor comienzo.</h1><p className="hero-description">Conectamos comerciantes, puestos y expedientes en un mismo espacio. Una gestión más clara para acompañar el camino hacia la formalización.</p>
              <div className="hero-actions"><button className="button button-primary button-large" onClick={showLogin} disabled={loading}>Ingresar al sistema<Icon name="arrow" /></button><a href="#beneficios" className="text-link">Conoce la plataforma</a></div>
              <p className="hero-assurance"><Icon name="shield" size={17} />Acceso para administradores y supervisores</p>
            </div>
            <div className="hero-visual" aria-label="Esquema del flujo de gestión: registrar, organizar y acompañar">
              <div className="visual-header"><span className="visual-dot" />UN MERCADO, UN MISMO ESPACIO</div>
              <div className="market-illustration" aria-hidden="true"><div className="market-roof" /><div className="market-awning">{[1, 2, 3, 4, 5, 6].map(n => <span key={n} />)}</div><div className="market-front"><div className="market-window"><span /><span /><span /></div><div className="market-door" /><div className="market-window"><span /><span /><span /></div></div><div className="market-ground" /></div>
              <h2>Tradición que avanza.<br />Gestión que acompaña.</h2>
              <div className="visual-flow">{[{ name: 'users' as const, title: 'Registrar', text: 'Identificar a cada comerciante' }, { name: 'stall' as const, title: 'Organizar', text: 'Vincular personas y espacios' }, { name: 'file' as const, title: 'Acompañar', text: 'Dar seguimiento a cada expediente' }].map(item => <div key={item.title}><span><Icon name={item.name} /></span><p><strong>{item.title}</strong><small>{item.text}</small></p><Icon name="check" size={17} /></div>)}</div>
              <div className="visual-footnote">Plataforma de gestión y seguimiento administrativo</div>
            </div>
          </section>
          <section id="beneficios" className="benefits-section"><p className="eyebrow">ORDEN PARA AVANZAR</p><h2>Lo importante, en un solo lugar.</h2><p className="section-intro">Herramientas sencillas para una gestión cotidiana más transparente.</p>
            <div className="benefit-grid">{[{ icon: 'users' as const, title: 'Comerciantes identificados', text: 'Un padrón centralizado para registrar, consultar y encontrar la información de cada comerciante.' }, { icon: 'stall' as const, title: 'Espacios organizados', text: 'Puestos identificados y asignaciones sin duplicidades para conocer la ocupación del mercado.' }, { icon: 'file' as const, title: 'Seguimiento claro', text: 'Requisitos, estados e indicadores para identificar pendientes y acompañar cada expediente.' }].map((item, i) => <article className="benefit-card" key={item.title}><span className="benefit-icon"><Icon name={item.icon} size={25} /></span><span className="benefit-number">0{i + 1}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
          </section>
          <section id="como-funciona" className="landing-callout"><div><p className="eyebrow">CADA ROL, UN PROPÓSITO</p><h2>Gestionar con confianza.<br />Supervisar con claridad.</h2><p>El administrador organiza los registros y expedientes. El supervisor consulta el avance y los indicadores con acceso de solo lectura.</p></div><button className="button button-primary button-large" onClick={showLogin} disabled={loading}>Acceder a mi espacio<Icon name="arrow" /></button></section>
        </> : <section className="login-layout">
          <div className="login-story"><p className="eyebrow">BIENVENIDO A LA PARADA</p><h1>El orden empieza<br />con un buen<br /><span>punto de encuentro.</span></h1><p>Tu espacio para gestionar el mercado y dar seguimiento a cada paso de la formalización.</p><div className="login-story-note"><Icon name="market" size={30} /><div><strong>Un mercado con historia.</strong><span>Una gestión con futuro.</span></div></div></div>
          <div className="login-card"><span className="login-lock"><Icon name="lock" size={25} /></span><p className="eyebrow">ACCESO AL SISTEMA</p><h2 id="login-title">Qué bueno verte de nuevo.</h2><p>Ingresa con tu cuenta autorizada para continuar.</p>
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            {message && <p className="notice notice-success" role="status">{message}</p>}
            <form onSubmit={login} aria-labelledby="login-title"><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="username" maxLength={254} placeholder="Tu correo electrónico" required disabled={busy || loading} />
              <label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" maxLength={128} placeholder="Tu contraseña" required disabled={busy || loading} />
              <button className="button button-primary button-block" type="submit" disabled={busy || loading}>{busy ? 'Validando acceso…' : 'Ingresar al sistema'}<Icon name="arrow" size={18} /></button>
            </form><p className="login-help"><Icon name="shield" size={17} />Acceso administrado. Si necesitas una cuenta, contacta al responsable del sistema.</p>
          </div>
        </section>}
        {publicView === 'landing' && error && <p className="notice notice-error public-notice" role="alert">{error}</p>}
        {loading && <p className="public-loading" role="status">Comprobando sesión…</p>}
      </main>
      <footer className="public-footer"><span>Mercado La Parada<span className="brand-dot">.</span></span><p>Gestión y formalización · Proyecto académico</p><small>Seguimiento administrativo; no sustituye autorizaciones municipales.</small></footer>
    </div>
  );
}
