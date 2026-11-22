import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { requireSession } from '@/lib/session';
import { guardianLinks, loadFamilyChild } from '@/lib/data/family-home';
import { APPROVAL_LABEL, sortApprovals, type FamilyApproval } from '@/lib/domain/family';
import { Badge, EmptyState, Notice, PageHeader, buttonClass } from '@/components/ui';
import { TrialButton } from '@/components/trials/TrialButtons';

export const metadata: Metadata = { title: 'Aprobaciones' };

/**
 * Bandeja única de la familia: todo lo que espera vuestro permiso, de todos los hijos, en una sola lista.
 * Los datos pasan por la RLS con la sesión del tutor (loadFamilyChild); si un permiso está desactivado, esa parte no aparece.
 * Las participaciones se deciden aquí mismo; contactos y documentos abren su pantalla, donde se elige qué compartir.
 */
export default async function ApprovalsPage() {
  const session = await requireSession(['parent']);
  const links = (await guardianLinks(session)).filter((l) => l.active);
  const homes = await Promise.all(links.map((l) => loadFamilyChild(session, l)));
  const items = sortApprovals(homes.flatMap((h) => h.approvals));

  return (
    <>
      <PageHeader
        kicker="Familia · Aprobaciones"
        title={items.length ? `${items.length} ${items.length === 1 ? 'decisión espera' : 'decisiones esperan'} tu permiso` : 'Nada pendiente'}
        description="Contactos con tu hijo o hija, documentos que piden y actividades a las que quiere apuntarse. Nada sale sin tu decisión."
      />
      {!links.length && (
        <Notice>Aún no tienes un vínculo activo con tu hijo o hija. <Link href="/app/family" className="font-semibold underline">Ir al panel familiar</Link></Notice>
      )}
      {links.length > 0 && !items.length && (
        <EmptyState title="Todo al día">Cuando una organización quiera contactar, pida un documento o tu hijo o hija se apunte a algo que necesita tu permiso, aparecerá aquí.</EmptyState>
      )}
      {items.length > 0 && (
        <ol className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {items.map((a, i) => <Row key={`${a.kind}-${a.ref?.id ?? i}`} a={a} many={links.length > 1} />)}
        </ol>
      )}
      <p className="mt-6 flex items-start gap-2 text-xs text-faint">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
        Cada decisión queda registrada. Puedes cambiar quién puede contactar a tu hijo o hija en <Link href="/app/family/safety" className="underline">Seguridad y permisos</Link>.
      </p>
    </>
  );
}

function Row({ a, many }: { a: FamilyApproval; many: boolean }) {
  const tone = a.kind === 'contact' ? 'danger' : a.kind === 'document' ? 'warn' : 'neutral';
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <Badge tone={tone}>{APPROVAL_LABEL[a.kind]}</Badge>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-paper">{a.what}</p>
        {many && <p className="text-sm text-muted">Para {a.athleteName}</p>}
      </div>
      {a.ref ? (
        <div className="flex flex-wrap items-center gap-2">
          <TrialButton
            variant="primary"
            label="Aprobar"
            call={a.ref.type === 'registration'
              ? { kind: 'respond', registration: a.ref.id, action: 'guardian_approve', opportunity: a.ref.opportunity }
              : { kind: 'enrollment', enrollment: a.ref.id, action: 'guardian_approve', opportunity: a.ref.opportunity }}
          />
          <TrialButton
            variant="danger"
            label="Rechazar"
            confirm="¿Rechazar esta actividad? Tu hijo o hija verá que no la has aprobado."
            call={a.ref.type === 'registration'
              ? { kind: 'respond', registration: a.ref.id, action: 'guardian_decline', opportunity: a.ref.opportunity }
              : { kind: 'enrollment', enrollment: a.ref.id, action: 'guardian_decline', opportunity: a.ref.opportunity }}
          />
          <Link href={a.href} className="text-sm font-semibold text-paper underline underline-offset-4">Ver detalle</Link>
        </div>
      ) : (
        <Link href={a.href} className={buttonClass('primary', 'sm')}>Revisar y decidir <ArrowRight className="h-4 w-4" aria-hidden /></Link>
      )}
    </li>
  );
}
