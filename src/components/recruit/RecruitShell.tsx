import { getT } from '@/lib/i18n/server-t';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, ButtonLink, EmptyState } from '@/components/ui';
import type { RecruitOrg } from '@/lib/data/recruit';
import { ROLE_LABEL } from '@/lib/domain/recruit';

const TABS = [
  { href: '/app/recruit', label: 'Inicio', cap: null },
  { href: '/app/recruit/discover', label: 'Descubrir', cap: 'discover' },
  { href: '/app/recruit/trials', label: 'Trials', cap: 'candidates', clubOnly: true },
  { href: '/app/recruit/shortlists', label: 'Listas', cap: 'shortlist' },
  { href: '/app/recruit/candidates', label: 'Procesos', cap: 'candidates' },
  { href: '/app/recruit/needs', label: 'Necesidades', cap: 'needs' },
  { href: '/app/recruit/tasks', label: 'Tareas', cap: 'tasks' },
] as const;

/** Cabecera común del portal: organización, rol, estado de verificación y pestañas según permisos. */
export async function RecruitShell({ org, orgs, active, children }: { org: RecruitOrg | null; orgs: RecruitOrg[]; active: string; children: ReactNode }) {
  const tx = await getT();
  if (!org) {
    return (
      <EmptyState title={tx('Empieza tu espacio de recruiting')} action={<ButtonLink href="/app/verify/start">{tx('Verificar mi afiliación')}</ButtonLink>}>
        {tx('1 · Crea o reclama tu universidad · 2 · Verifica tu identidad institucional · 3 · Crea tu programa · 4 · Invita a tu staff · 5 · Define una necesidad · 6 · Descubre atletas o publica una oportunidad.')}
      </EmptyState>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-paper">{org.name}</span>
        <Badge tone={org.verified ? 'ok' : 'warn'}>{org.verified ? tx('Organización verificada') : tx('Verificación pendiente')}</Badge>
        <span className="text-muted">· {tx(ROLE_LABEL[org.role] ?? org.role)}</span>
        {orgs.length > 1 && <span className="ml-auto flex gap-2">{orgs.map((o) => <Link key={o.id} href={`/app/recruit?org=${o.id}`} className={`text-xs ${o.id === org.id ? 'font-semibold text-brass' : 'text-muted'}`}>{o.name}</Link>)}</span>}
      </div>
      <nav aria-label={tx('Portal de recruiting')} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {TABS.filter((t) => (!t.cap || org.caps.has(t.cap)) && (!('clubOnly' in t) || ['club', 'academy'].includes(org.type))).map((t) => (
            <li key={t.href}><Link href={t.href} aria-current={active === t.href ? 'page' : undefined} className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ${active === t.href ? 'border-brass text-brass' : 'border-transparent text-muted hover:text-paper'}`}>{tx(t.label)}</Link></li>
          ))}
        </ul>
      </nav>
      {!org.verified && (
        <p className="rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-sm text-paper" role="status">
          {tx('Acceso limitado mientras verificamos tu organización: puedes configurar programas, necesidades y oportunidades, pero no descubrir atletas, ver datos restringidos, contactar menores ni pedir documentación.')}{' '}<Link href="/app/verify" className="font-semibold text-brass underline">{tx('Ver mi verificación')}</Link>
        </p>
      )}
      {children}
    </div>
  );
}
