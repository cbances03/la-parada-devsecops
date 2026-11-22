'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from '../lib/auth';
import MarketPanel from './market-panel';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const expireSession = useCallback(() => {
    setUser(null);
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

  return (
    <main>
      <h1>Mercado La Parada</h1>
      <p>Sistema de Gestión y Formalización · Acceso y seguridad</p>
      {loading ? <p role="status">Comprobando sesión…</p> : user ? (
        <section aria-labelledby="access-title">
          <h2 id="access-title">Acceso autorizado</h2>
          <p>Usuario: {user.email}</p>
          <p>Rol: <strong>{user.role}</strong></p>
          <p>{user.role === 'administrador'
            ? 'Permisos de gestión de comerciantes, puestos y expedientes.'
            : 'Permisos de solo lectura de expedientes e indicadores.'}</p>
          <div className="actions">
            {user.role === 'administrador' && <button disabled={busy} onClick={checkAdmin}>Verificar permiso administrativo</button>}
            <button disabled={busy} onClick={logout}>Cerrar sesión</button>
          </div>
        </section>
      ) : (
        <form onSubmit={login} aria-labelledby="login-title">
          <h2 id="login-title">Iniciar sesión</h2>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" name="email" type="email" autoComplete="username" maxLength={254} required disabled={busy} />
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" maxLength={128} required disabled={busy} />
          <button type="submit" disabled={busy}>{busy ? 'Validando…' : 'Ingresar'}</button>
          <p>El acceso es administrado. No hay registro público de usuarios.</p>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <p role="status">{message}</p>
      {user && <MarketPanel key={user.id} user={user} onSessionExpired={expireSession} />}
    </main>
  );
}
