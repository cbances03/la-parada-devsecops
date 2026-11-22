import Link from 'next/link';

export type IconName = 'market' | 'overview' | 'users' | 'stall' | 'file' | 'shield' | 'arrow' | 'logout' | 'menu' | 'close' | 'search' | 'check' | 'refresh' | 'clock' | 'lock';

const paths: Record<IconName, string> = {
  market: 'M3 10h18M4 10v11h16V10M3 10l2-7h14l2 7M8 3l-1 7m5-7v7m4-7 1 7M8 21v-7h5v7',
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8 .13a4 4 0 0 1 0 7.75',
  stall: 'M3 10h18M4 10v11h16V10M3 10l2-7h14l2 7M8 14h8m-8 4h8',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8m-8 4h5',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6zM8 12l3 3 5-6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5M21 12H9',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'm6 6 12 12M6 18 18 6',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15M16 16l5 5',
  check: 'm5 12 4 4L19 6',
  refresh: 'M20 7v5h-5M4 17v-5h5m-4-4a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3 2',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function Brand({ light = false, onHome }: { light?: boolean; onHome?: () => void }) {
  return <Link href="/" onClick={onHome ? event => { event.preventDefault(); onHome(); } : undefined} className={`brand${light ? ' brand-light' : ''}`} aria-label="Mercado La Parada, inicio">
    <span className="brand-symbol"><Icon name="market" size={27} /></span>
    <span><strong>La Parada<span className="brand-dot">.</span></strong><small>GESTIÓN DEL MERCADO</small></span>
  </Link>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="file" size={26} /></span><h3>{title}</h3><p>{detail}</p></div>;
}
