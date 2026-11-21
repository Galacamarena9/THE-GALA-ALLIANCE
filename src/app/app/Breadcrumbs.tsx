'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { breadcrumbsFor, type NavMode } from '@/lib/domain/navigation';

/** Migas de pan: «Atletas › Buscar talento» o «Recruiting › Procesos › ficha». En Inicio no se muestran. */
export function Breadcrumbs({ mode }: { mode: NavMode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const crumbs = breadcrumbsFor(mode, pathname, search);
  if (!crumbs.length || (crumbs.length === 1 && crumbs[0].href === '/app')) return null;
  const last = crumbs[crumbs.length - 1];
  const current = `${pathname}${search ? `?${search}` : ''}`;
  const deeper = last.href !== current && !last.aliases?.includes(pathname);
  return (
    <nav aria-label="Migas de pan" className="mb-4 text-[13px] text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1 && !deeper;
          return (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden />}
              {isLast ? <span aria-current="page" className="font-semibold text-paper">{c.label}</span> : <Link href={c.href} className="hover:text-brass">{c.label}</Link>}
            </li>
          );
        })}
        {deeper && (
          <li className="flex items-center gap-1"><ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden /><span aria-current="page" className="text-paper">Detalle</span></li>
        )}
      </ol>
    </nav>
  );
}
