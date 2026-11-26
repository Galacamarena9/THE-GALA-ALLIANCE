import type { Metadata } from 'next';
import './globals.css';
import { CookieBanner } from '@/components/CookieBanner';
import { BRAND } from '@/content/brand';
import { siteUrl } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: BRAND.metaTitle,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.metaDescription,
  applicationName: BRAND.name,
  robots: { index: true, follow: true },
  // Vista previa al compartir (WhatsApp, LinkedIn, X). Imagen local, sin logos de terceros.
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    locale: 'es_ES',
    title: `${BRAND.name} · ${BRAND.claim}`,
    description: BRAND.secondary,
    images: [{ url: '/media/hero-bg-poster.jpg', alt: BRAND.network }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} · ${BRAND.claim}`,
    description: BRAND.secondary,
    images: ['/media/hero-bg-poster.jpg'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Aplica el tema elegido antes de pintar (evita parpadeo). Preferencia de interfaz, sin datos personales. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js');try{var t=localStorage.getItem('tga_theme_v4');if(t==='dark'||t==='contrast')document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
