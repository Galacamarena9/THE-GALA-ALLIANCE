import type { Metadata } from 'next';
import './globals.css';
import { CookieBanner } from '@/components/CookieBanner';

export const metadata: Metadata = {
  title: {
    default: 'The Gala Alliance · Becas deportivas en EE. UU.',
    template: '%s · The Gala Alliance',
  },
  description:
    'El sistema operativo para deportistas-estudiantes internacionales: perfil verificable, encaje explicado, coste real y el siguiente paso, en un solo lugar.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="min-h-dvh">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
