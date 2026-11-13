'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

/** Menú móvil de la cabecera pública: panel a pantalla completa con desenfoque. */
export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    // Cerrar al navegar sin efecto (patrón recomendado: ajustar estado durante el render).
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-paper transition-colors hover:bg-surface"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t border-line bg-ink/95 px-5 py-6 backdrop-blur-xl">
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="block rounded-xl px-4 py-3 text-base font-medium text-paper hover:bg-surface" onClick={() => setOpen(false)}>
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3">
            <Link href="/signup" className="btn-shine rounded-xl bg-brass px-4 py-3 text-center font-bold text-ink">Crear cuenta gratis</Link>
            <Link href="/login" className="rounded-xl border border-line-strong px-4 py-3 text-center text-paper">Iniciar sesión</Link>
          </div>
        </div>
      )}
    </div>
  );
}
