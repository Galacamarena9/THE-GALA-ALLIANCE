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
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Aplica el tema elegido antes de pintar (evita parpadeo). Preferencia de interfaz, sin datos personales. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js');try{var t=localStorage.getItem('tga_theme_v2');if(t==='dark'||t==='contrast')document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
