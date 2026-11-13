import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Documentos imprimibles: fondo blanco y sin la navegación de la app. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white text-neutral-900">{children}</div>;
}
