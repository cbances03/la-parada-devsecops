import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Mercado La Parada', description: 'Sistema de Gestión y Formalización' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
