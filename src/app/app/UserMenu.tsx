'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, ShieldCheck, Tag, User } from 'lucide-react';
import { ThemeToggle } from '@/components/growth';

/** Menú de perfil (avatar con iniciales): perfil, plan, privacidad, tema y salir. */
export function UserMenu({ name, roles, profileHref, signOut }: { name: string; roles: string; profileHref: string; signOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'G';
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-surface">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brass to-brass-deep text-xs font-bold text-ink">{initials}</span>
        <span className="hidden text-left text-xs leading-tight lg:block">
          <span className="block max-w-[140px] truncate font-medium text-paper">{name}</span>
          <span className="block max-w-[140px] truncate text-faint">{roles}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-faint lg:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-line-strong bg-surface p-2 shadow-[var(--shadow-premium)]">
          <div className="px-3 pb-3 pt-2">
            <p className="truncate text-sm font-medium text-paper">{name}</p>
            <p className="truncate text-xs text-faint">{roles}</p>
          </div>
          <Link role="menuitem" href={profileHref} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-paper"><User className="h-4 w-4" aria-hidden />Mi perfil</Link>
          <Link role="menuitem" href="/precios" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-paper"><Tag className="h-4 w-4" aria-hidden />Planes y servicios</Link>
          <Link role="menuitem" href="/app/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-paper"><ShieldCheck className="h-4 w-4" aria-hidden />Privacidad y datos</Link>
          <div className="my-2 flex items-center justify-between border-t border-line px-3 pt-3 text-xs text-faint">Tema <ThemeToggle /></div>
          <form action={signOut}>
            <button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-danger/10 hover:text-danger"><LogOut className="h-4 w-4" aria-hidden />Cerrar sesión</button>
          </form>
        </div>
      )}
    </div>
  );
}
